/**
 * Tool: group_pairing
 *
 * Find the best wine(s) that pair well across multiple dishes.
 * Useful for dinner parties or multi-course meals where you want
 * a single wine that works with everything.
 *
 * Requires Pro tier API key.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import { SommelierXApiError } from '../client.js';
import type { MealListResult, GroupPairingResult, WineMatch } from './types.js';

/** Zod schema for tool input validation. */
export const groupPairingSchema = z.object({
  meal_names: z
    .array(z.string().min(2))
    .min(2, 'At least 2 meals are required for group pairing')
    .max(10, 'Maximum 10 meals allowed')
    .describe('List of meal/dish names (e.g. ["Caesar salad", "grilled lamb", "chocolate mousse"])'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type GroupPairingInput = z.infer<typeof groupPairingSchema>;

/** Resolved meal with its database ID. */
interface ResolvedMeal {
  name: string;
  id: number | null;
  matched: boolean;
}

/**
 * Search for a meal by name and return the best match.
 */
async function resolveMeal(
  client: SommelierXClient,
  name: string,
  language: string,
): Promise<ResolvedMeal> {
  try {
    const result = await client.get<MealListResult>('/api/v1/meals', {
      search: name,
      language,
      perPage: '1',
    });

    if (result.data && result.data.length > 0) {
      return { name, id: result.data[0].id, matched: true };
    }

    return { name, id: null, matched: false };
  } catch {
    return { name, id: null, matched: false };
  }
}

/**
 * Execute the group_pairing tool.
 *
 * Flow:
 * 1. Resolve each meal name to a database ID
 * 2. Call /api/v1/pairing/group with the resolved meal IDs
 * 3. Format the response
 */
export async function executeGroupPairing(
  client: SommelierXClient,
  config: ServerConfig,
  input: GroupPairingInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  // Step 1: Resolve all meal names
  const resolved = await Promise.all(
    input.meal_names.map((name) => resolveMeal(client, name, language)),
  );

  const matched = resolved.filter((r): r is ResolvedMeal & { id: number } => r.matched && r.id !== null);
  const unmatched = resolved.filter((r) => !r.matched);

  if (matched.length < 2) {
    const foundCount = matched.length;
    return [
      `Could only find ${foundCount} of ${input.meal_names.length} meals in the database.`,
      `Group pairing requires at least 2 matched meals.`,
      '',
      `Found: ${matched.map((m) => m.name).join(', ') || 'none'}`,
      `Not found: ${unmatched.map((u) => u.name).join(', ')}`,
      '',
      'Use search_meals to find the correct meal names.',
    ].join('\n');
  }

  // Step 2: Call group pairing
  const mealIds = matched.map((m) => m.id);

  let result: GroupPairingResult;
  try {
    result = await client.post<GroupPairingResult>('/api/v1/pairing/group', {
      mealIds,
      language,
    });
  } catch (error: unknown) {
    if (error instanceof SommelierXApiError && error.statusCode === 403) {
      return [
        'Group pairing requires a Pro or Enterprise API key.',
        'The current MCP server is running without an API key or with a Free tier key.',
        '',
        'To use this feature:',
        '1. Get a Pro API key at https://api.sommelierx.com',
        '2. Set the SOMMELIERX_API_KEY environment variable in your MCP config',
      ].join('\n');
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error calculating group pairing: ${message}`;
  }

  return formatGroupPairingResponse(matched, unmatched, result.results);
}

/**
 * Format the group pairing results into a human-readable string.
 */
function formatGroupPairingResponse(
  matched: ResolvedMeal[],
  unmatched: ResolvedMeal[],
  wines: Array<WineMatch & { mealScores?: Array<{ mealId: number; mealName: string; match_percentage: number }> }>,
): string {
  const lines: string[] = [];

  lines.push(`Group wine pairing for: ${matched.map((m) => m.name).join(', ')}`);

  if (unmatched.length > 0) {
    lines.push(`Note: Could not find these meals: ${unmatched.map((u) => u.name).join(', ')}`);
  }

  lines.push('');

  const topWines = wines.slice(0, 5);

  if (topWines.length === 0) {
    lines.push('No wines found that pair well with all of these dishes.');
    return lines.join('\n');
  }

  lines.push('Best wines across all dishes:');
  lines.push('');

  for (let i = 0; i < topWines.length; i++) {
    const wine = topWines[i];
    const rank = i + 1;

    lines.push(`${rank}. ${wine.name} (${wine.color})`);
    lines.push(`   Overall match: ${wine.score.match_percentage}%`);

    if (wine.region) {
      lines.push(`   Region: ${wine.region}`);
    }

    if (wine.grapes && wine.grapes.length > 0) {
      lines.push(`   Grapes: ${wine.grapes.join(', ')}`);
    }

    // Show per-meal breakdown if available
    if (wine.mealScores && wine.mealScores.length > 0) {
      lines.push('   Per-dish scores:');
      for (const ms of wine.mealScores) {
        lines.push(`     - ${ms.mealName}: ${ms.match_percentage}%`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
