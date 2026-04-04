/**
 * Tool: search_meals
 *
 * Search for meals/dishes in the SommelierX database.
 * Useful for discovering available meals before using
 * the pair_wine_with_meal or group_pairing tools.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { MealListResult, MealItem } from './types.js';

/** Zod schema for tool input validation. */
export const searchMealsSchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100)
    .describe('Search term for meals/dishes (e.g. "risotto", "steak", "sushi")'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type SearchMealsInput = z.infer<typeof searchMealsSchema>;

/**
 * Execute the search_meals tool.
 *
 * Calls /api/v1/meals?search=... and formats the results.
 */
export async function executeSearchMeals(
  client: SommelierXClient,
  config: ServerConfig,
  input: SearchMealsInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  let result: MealListResult;
  try {
    result = await client.get<MealListResult>('/api/v1/meals', {
      search: input.query,
      language,
      perPage: '20',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error searching meals: ${message}`;
  }

  return formatMealResults(input.query, result.data, result.total);
}

/**
 * Format the meal search results into a human-readable string.
 */
function formatMealResults(
  query: string,
  meals: MealItem[],
  total: number,
): string {
  const lines: string[] = [];

  lines.push(`Meal search results for "${query}" (${total} total):`);
  lines.push('');

  if (meals.length === 0) {
    lines.push('No meals found matching your search.');
    lines.push('Try a different search term or language.');
    return lines.join('\n');
  }

  for (const meal of meals) {
    lines.push(`- ${meal.name} (id: ${meal.id})`);
    if (meal.description) {
      lines.push(`  ${meal.description}`);
    }
  }

  if (total > meals.length) {
    lines.push('');
    lines.push(`Showing ${meals.length} of ${total} results. Refine your search for more specific results.`);
  }

  return lines.join('\n');
}
