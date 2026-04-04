/**
 * Tool: find_meals_for_wine
 *
 * Reverse pairing: given a wine type/style name, find the best
 * matching meals/dishes. Searches for the wine type first, then
 * uses the matched wine ID to get meal recommendations.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { MealsByWineResult, MealMatch } from './types.js';

/** Wine type item from /api/v1/wines/types. */
interface WineTypeItem {
  id: number;
  name: string;
  color?: string;
  region?: string;
}

/**
 * Wine types list response.
 * The API client unwraps the envelope, so the response is either
 * an array of wine types or an object with a data property.
 */
type WineTypesResponse = WineTypeItem[] | { data: WineTypeItem[] };

/** Zod schema for tool input validation. */
export const findMealsForWineSchema = z.object({
  wine_type: z
    .string()
    .min(2, 'Wine type must be at least 2 characters')
    .max(200)
    .describe('Name of the wine type or style (e.g. "Barolo", "Chardonnay", "Rioja Reserva")'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type FindMealsForWineInput = z.infer<typeof findMealsForWineSchema>;

/**
 * Find a wine type by name from the full list of wine types.
 * Uses case-insensitive substring matching.
 */
async function findWineType(
  client: SommelierXClient,
  query: string,
  language: string,
): Promise<WineTypeItem | null> {
  try {
    const response = await client.get<WineTypesResponse>('/api/v1/wines/types', { language });

    // Normalize response: client may return array or object with .data
    let wineTypes: WineTypeItem[];
    if (Array.isArray(response)) {
      wineTypes = response;
    } else if ('data' in response && Array.isArray(response.data)) {
      wineTypes = response.data;
    } else {
      return null;
    }

    const queryLower = query.toLowerCase();

    // Try exact match first
    const exact = wineTypes.find((w) => w.name.toLowerCase() === queryLower);
    if (exact) return exact;

    // Try starts-with match
    const startsWith = wineTypes.find((w) => w.name.toLowerCase().startsWith(queryLower));
    if (startsWith) return startsWith;

    // Try substring match
    const contains = wineTypes.find((w) => w.name.toLowerCase().includes(queryLower));
    if (contains) return contains;

    // Try reverse: query contains wine name
    const reverseMatch = wineTypes.find((w) => queryLower.includes(w.name.toLowerCase()));
    if (reverseMatch) return reverseMatch;

    return null;
  } catch {
    return null;
  }
}

/**
 * Execute the find_meals_for_wine tool.
 *
 * Flow:
 * 1. Get all wine types and find the best match for the query
 * 2. Call /api/v1/pairing/by-wine/:wineId/meals
 * 3. Format the response
 */
export async function executeFindMealsForWine(
  client: SommelierXClient,
  config: ServerConfig,
  input: FindMealsForWineInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  // Step 1: Find the wine type
  const wineType = await findWineType(client, input.wine_type, language);

  if (!wineType) {
    return [
      `Could not find a wine type matching "${input.wine_type}" in the SommelierX database.`,
      '',
      'Try using a more specific wine style name like "Barolo", "Chablis", or "Rioja Reserva".',
      'Common wine types include: Chardonnay, Sauvignon Blanc, Pinot Noir, Cabernet Sauvignon,',
      'Merlot, Syrah, Riesling, Champagne, Prosecco, and many regional styles.',
    ].join('\n');
  }

  // Step 2: Get meal recommendations
  let mealsResult: MealsByWineResult;
  try {
    mealsResult = await client.get<MealsByWineResult>(
      `/api/v1/pairing/by-wine/${wineType.id}/meals`,
      { language, perPage: '10' },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error finding meals for "${wineType.name}": ${message}`;
  }

  return formatMealsForWineResponse(wineType, mealsResult.data);
}

/**
 * Format the meal recommendations into a human-readable string.
 */
function formatMealsForWineResponse(
  wineType: WineTypeItem,
  meals: MealMatch[],
): string {
  const lines: string[] = [];

  const colorSuffix = wineType.color ? ` (${wineType.color})` : '';
  lines.push(`Dishes that pair well with ${wineType.name}${colorSuffix}:`);
  lines.push('');

  if (meals.length === 0) {
    lines.push('No meal recommendations found for this wine type.');
    return lines.join('\n');
  }

  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i];
    const rank = i + 1;

    lines.push(`${rank}. ${meal.name}`);
    lines.push(`   Match: ${meal.score.match_percentage}%`);

    if (meal.description) {
      lines.push(`   ${meal.description}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
