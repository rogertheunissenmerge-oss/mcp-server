/**
 * Tool: search_ingredients
 *
 * Search for ingredients in the SommelierX database.
 * Useful for discovering available ingredients before using
 * the pair_wine_with_ingredients tool.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { IngredientListResult, IngredientItem } from './types.js';

/** Zod schema for tool input validation. */
export const searchIngredientsSchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100)
    .describe('Search term for ingredients (e.g. "mushroom", "cheese", "salmon")'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type SearchIngredientsInput = z.infer<typeof searchIngredientsSchema>;

/**
 * Execute the search_ingredients tool.
 *
 * Calls /api/v1/ingredients?search=... and formats the results.
 */
export async function executeSearchIngredients(
  client: SommelierXClient,
  config: ServerConfig,
  input: SearchIngredientsInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  let result: IngredientListResult;
  try {
    result = await client.get<IngredientListResult>('/api/v1/ingredients', {
      search: input.query,
      language,
      perPage: '20',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error searching ingredients: ${message}`;
  }

  return formatIngredientResults(input.query, result.data, result.total);
}

/**
 * Format the ingredient search results into a human-readable string.
 */
function formatIngredientResults(
  query: string,
  ingredients: IngredientItem[],
  total: number,
): string {
  const lines: string[] = [];

  lines.push(`Ingredient search results for "${query}" (${total} total):`);
  lines.push('');

  if (ingredients.length === 0) {
    lines.push('No ingredients found matching your search.');
    lines.push('Try a different search term or language.');
    return lines.join('\n');
  }

  for (const ingredient of ingredients) {
    const groupSuffix = ingredient.group ? ` [${ingredient.group}]` : '';
    lines.push(`- ${ingredient.name} (id: ${ingredient.id})${groupSuffix}`);
  }

  if (total > ingredients.length) {
    lines.push('');
    lines.push(`Showing ${ingredients.length} of ${total} results. Refine your search for more specific results.`);
  }

  return lines.join('\n');
}
