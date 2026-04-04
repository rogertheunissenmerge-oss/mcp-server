/**
 * Tool: pair_wine_with_meal
 *
 * Takes a meal/dish name, searches for it in the database,
 * then calculates wine pairings for the matched meal.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { MealListResult, MealPairingResult, WineMatch } from './types.js';

/** Zod schema for tool input validation. */
export const pairWineWithMealSchema = z.object({
  meal_name: z
    .string()
    .min(2, 'Meal name must be at least 2 characters')
    .max(200)
    .describe('Name of the dish or meal (e.g. "risotto ai funghi", "grilled salmon")'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type PairWineWithMealInput = z.infer<typeof pairWineWithMealSchema>;

/**
 * Execute the pair_wine_with_meal tool.
 *
 * Flow:
 * 1. Search for the meal by name via /api/v1/meals?search=
 * 2. Use the first match's ID to call /api/v1/pairing/by-meal/:mealId
 * 3. Format the response for the LLM
 */
export async function executePairWineWithMeal(
  client: SommelierXClient,
  config: ServerConfig,
  input: PairWineWithMealInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  // Step 1: Search for the meal
  let mealResult: MealListResult;
  try {
    mealResult = await client.get<MealListResult>('/api/v1/meals', {
      search: input.meal_name,
      language,
      perPage: '5',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error searching for meal: ${message}`;
  }

  if (!mealResult.data || mealResult.data.length === 0) {
    return [
      `Could not find a meal matching "${input.meal_name}" in the SommelierX database.`,
      '',
      'Try using the search_meals tool to find available meals,',
      'or use pair_wine_with_ingredients with the dish\'s individual ingredients.',
    ].join('\n');
  }

  const meal = mealResult.data[0];

  // Step 2: Get wine pairings for this meal
  let pairingResult: MealPairingResult;
  try {
    pairingResult = await client.post<MealPairingResult>(`/api/v1/pairing/by-meal/${meal.id}`, {
      language,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error calculating wine pairing for "${meal.name}": ${message}`;
  }

  return formatMealPairingResponse(meal, pairingResult.results);
}

/**
 * Format the meal pairing results into a human-readable string.
 */
function formatMealPairingResponse(
  meal: { name: string; description?: string },
  wines: WineMatch[],
): string {
  const lines: string[] = [];

  lines.push(`Wine pairing for: ${meal.name}`);
  if (meal.description) {
    lines.push(meal.description);
  }
  lines.push('');

  const topWines = wines.slice(0, 5);

  if (topWines.length === 0) {
    lines.push('No wine matches found for this meal.');
    return lines.join('\n');
  }

  lines.push('Top wine matches:');
  lines.push('');

  for (let i = 0; i < topWines.length; i++) {
    const wine = topWines[i];
    const rank = i + 1;

    lines.push(`${rank}. ${wine.name} (${wine.color})`);
    lines.push(`   Match: ${wine.score.match_percentage}%`);

    if (wine.region) {
      lines.push(`   Region: ${wine.region}`);
    }

    if (wine.grapes && wine.grapes.length > 0) {
      lines.push(`   Grapes: ${wine.grapes.join(', ')}`);
    }

    if (wine.score.basic_score !== undefined) {
      const parts: string[] = [];
      parts.push(`basic ${wine.score.basic_score}`);
      parts.push(`balance ${wine.score.balance_score ?? 0}`);
      if (wine.score.aromatic_score != null) {
        parts.push(`aromatic ${wine.score.aromatic_score}`);
      }
      lines.push(`   Score breakdown: ${parts.join(' | ')}`);
    }

    if (wine.description) {
      lines.push(`   ${wine.description}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
