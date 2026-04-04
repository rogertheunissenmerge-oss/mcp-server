/**
 * Tool: pair_wine_with_recipe_url
 *
 * Takes a recipe URL, extracts ingredients via the SommelierX API,
 * then calculates wine pairings based on the extracted ingredients.
 *
 * This is the end-to-end flow: URL -> ingredients -> wine pairing.
 * Requires Pro tier API key.
 */

import { z } from 'zod';
import type { SommelierXClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import { SommelierXApiError } from '../client.js';
import type {
  RecipeExtractResult,
  PairingResult,
  WineMatch,
} from './types.js';

/** Zod schema for tool input validation. */
export const pairWineWithRecipeUrlSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe('URL of a recipe page (e.g. "https://www.allrecipes.com/recipe/...")'),
  language: z
    .string()
    .min(2)
    .max(10)
    .optional()
    .describe('Language code for results (e.g. "en", "nl", "fr"). Defaults to "en".'),
});

export type PairWineWithRecipeUrlInput = z.infer<typeof pairWineWithRecipeUrlSchema>;

/**
 * Execute the pair_wine_with_recipe_url tool.
 *
 * Flow:
 * 1. Call /api/v1/recipes/extract with the URL
 * 2. Filter to ingredients that were matched to database IDs
 * 3. Call /api/v1/pairing/calculate with the matched ingredients
 * 4. Format the combined response
 */
export async function executePairWineWithRecipeUrl(
  client: SommelierXClient,
  config: ServerConfig,
  input: PairWineWithRecipeUrlInput,
): Promise<string> {
  const language = input.language ?? config.defaultLanguage;

  // Step 1: Extract ingredients from the recipe URL
  let recipe: RecipeExtractResult;
  try {
    recipe = await client.post<RecipeExtractResult>('/api/v1/recipes/extract', {
      url: input.url,
      language,
    });
  } catch (error: unknown) {
    if (error instanceof SommelierXApiError) {
      if (error.statusCode === 403) {
        return [
          'Recipe extraction requires a Pro or Enterprise API key.',
          'The current MCP server is running without an API key or with a Free tier key.',
          '',
          'To use this feature:',
          '1. Get a Pro API key at https://api.sommelierx.com',
          '2. Set the SOMMELIERX_API_KEY environment variable in your MCP config',
          '',
          'Alternative: use pair_wine_with_ingredients and provide the ingredients manually.',
        ].join('\n');
      }
      return `Error extracting recipe: ${error.message}`;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Error extracting recipe: ${message}`;
  }

  // Step 2: Filter to matched ingredients with database IDs
  const matchedIngredients = recipe.ingredients.filter(
    (ing) => ing.id !== undefined && ing.id !== null && ing.matched !== false,
  );

  if (matchedIngredients.length === 0) {
    return [
      `Extracted recipe "${recipe.name}" from ${recipe.source}`,
      `Found ${recipe.ingredients.length} ingredients, but none could be matched to the database.`,
      '',
      'Try using pair_wine_with_ingredients with the ingredient names directly.',
    ].join('\n');
  }

  // Step 3: Calculate pairing
  const pairingInput = matchedIngredients.map((ing) => ({
    id: ing.id as number,
    amount: 'medium' as const,
  }));

  let pairingResult: PairingResult;
  try {
    pairingResult = await client.post<PairingResult>('/api/v1/pairing/calculate', {
      ingredients: pairingInput,
      language,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `Extracted recipe "${recipe.name}" but pairing calculation failed: ${message}`;
  }

  return formatRecipePairingResponse(recipe, matchedIngredients, pairingResult.results);
}

/**
 * Format the recipe + pairing results into a human-readable string.
 */
function formatRecipePairingResponse(
  recipe: RecipeExtractResult,
  matchedIngredients: RecipeExtractResult['ingredients'],
  wines: WineMatch[],
): string {
  const lines: string[] = [];

  lines.push(`Recipe: ${recipe.name}`);
  lines.push(`Source: ${recipe.source}`);
  lines.push('');

  lines.push(`Ingredients (${matchedIngredients.length} matched):`);
  for (const ing of matchedIngredients) {
    const amountSuffix = ing.amount ? ` (${ing.amount})` : '';
    lines.push(`  - ${ing.name}${amountSuffix}`);
  }
  lines.push('');

  const topWines = wines.slice(0, 5);

  if (topWines.length === 0) {
    lines.push('No wine matches found for this recipe.');
    return lines.join('\n');
  }

  lines.push('Wine recommendations:');
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

    lines.push('');
  }

  return lines.join('\n');
}
