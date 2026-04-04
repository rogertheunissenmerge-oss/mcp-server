/**
 * Tool: pair_wine_with_ingredients
 *
 * Takes a list of ingredient names in natural language, resolves them
 * to database IDs via the search API, then calculates wine pairings.
 *
 * This implements the "search-first-then-pair" flow described in the PRD:
 * the MCP server handles ingredient resolution so the LLM does not need to.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type {
  IngredientListResult,
  PairingResult,
  WineMatch,
} from './types.js';

/** Zod schema for tool input validation. */
export const pairWineWithIngredientsSchema = z.object({
  ingredients: z
    .array(z.string().min(1))
    .min(1, 'At least one ingredient is required')
    .max(20, 'Maximum 20 ingredients allowed')
    .describe('List of ingredient names (e.g. ["salmon", "lemon", "dill"])'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type PairWineWithIngredientsInput = z.infer<typeof pairWineWithIngredientsSchema>;

/** Result of ingredient resolution: which matched and which did not. */
interface ResolvedIngredient {
  name: string;
  id: number | null;
  matched: boolean;
}

/**
 * Resolve a single ingredient name to a database ID by searching the API.
 * Returns the best match (first result) or null if no match is found.
 */
async function resolveIngredient(
  client: SommelierXClient,
  name: string,
  language: string,
): Promise<ResolvedIngredient> {
  try {
    const result = await client.get<IngredientListResult>('/api/v1/ingredients', {
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
 * Execute the pair_wine_with_ingredients tool.
 *
 * Flow:
 * 1. Resolve each ingredient name to a database ID via /api/v1/ingredients?search=
 * 2. Filter to only matched ingredients
 * 3. Call /api/v1/pairing/calculate with the resolved IDs
 * 4. Format the response for the LLM
 */
export async function executePairWineWithIngredients(
  client: SommelierXClient,
  config: ServerConfig,
  input: PairWineWithIngredientsInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  // Step 1: Resolve all ingredients in parallel
  const resolved = await Promise.all(
    input.ingredients.map((name) => resolveIngredient(client, name, language)),
  );

  const matched = resolved.filter((r): r is ResolvedIngredient & { id: number } => r.matched && r.id !== null);
  const unmatched = resolved.filter((r) => !r.matched);

  if (matched.length === 0) {
    return formatNoMatchResponse(input.ingredients, language);
  }

  // Step 2: Calculate pairings with matched ingredients
  const pairingInput = matched.map((r) => ({ id: r.id, amount: 'medium' as const }));

  try {
    const result = await client.post<PairingResult>('/api/v1/pairing/calculate', {
      ingredients: pairingInput,
      language,
    });

    return formatPairingResponse(result.results, matched, unmatched);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error calculating wine pairing: ${message}`;
  }
}

/**
 * Format the pairing results into a human-readable string for the LLM.
 */
function formatPairingResponse(
  wines: WineMatch[],
  matched: ResolvedIngredient[],
  unmatched: ResolvedIngredient[],
): string {
  const lines: string[] = [];

  lines.push(`Wine pairing for: ${matched.map((m) => m.name).join(', ')}`);

  if (unmatched.length > 0) {
    lines.push(`Note: Could not find these ingredients in the database: ${unmatched.map((u) => u.name).join(', ')}`);
  }

  lines.push('');

  const topWines = wines.slice(0, 5);

  if (topWines.length === 0) {
    lines.push('No wine matches found for these ingredients.');
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

/**
 * Format a response when no ingredients could be resolved.
 */
function formatNoMatchResponse(ingredients: string[], language: string): string {
  return [
    `Could not find any of these ingredients in the SommelierX database: ${ingredients.join(', ')}`,
    '',
    `Try using more common ingredient names in ${language === 'en' ? 'English' : language}.`,
    'You can use the search_ingredients tool to find the correct ingredient names.',
  ].join('\n');
}
