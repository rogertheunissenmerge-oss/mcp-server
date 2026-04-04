#!/usr/bin/env node

/**
 * SommelierX MCP Server
 *
 * Model Context Protocol server that provides wine-food pairing intelligence
 * to AI assistants like Claude, Cursor, and other MCP-compatible clients.
 *
 * Usage:
 *   npx @sommelierx/mcp-server
 *
 * Configuration (environment variables):
 *   SOMMELIERX_API_KEY  - API key for Pro/Enterprise access (optional, free tier without)
 *   SOMMELIERX_API_URL  - API base URL (default: https://api.sommelierx.com)
 *   SOMMELIERX_LANGUAGE - Default language code (default: en)
 *
 * Authentication:
 *   1. API key: set SOMMELIERX_API_KEY env var (Bearer sk_live_...)
 *   2. x402 payment: pay per call with USDC on Base (no API key needed)
 *      See https://docs.sommelierx.com/x402 for details
 *
 * MCP client configuration example (Claude Desktop):
 *   {
 *     "mcpServers": {
 *       "sommelierx": {
 *         "command": "npx",
 *         "args": ["@sommelierx/mcp-server"],
 *         "env": {
 *           "SOMMELIERX_API_KEY": "sk_live_your_key_here"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveConfig } from './config.js';
import { SommelierXClient } from './client.js';
import {
  pairWineWithIngredientsSchema,
  executePairWineWithIngredients,
  pairWineWithMealSchema,
  executePairWineWithMeal,
  findMealsForWineSchema,
  executeFindMealsForWine,
  pairWineWithRecipeUrlSchema,
  executePairWineWithRecipeUrl,
  searchIngredientsSchema,
  executeSearchIngredients,
  searchMealsSchema,
  executeSearchMeals,
  groupPairingSchema,
  executeGroupPairing,
} from './tools/index.js';

/**
 * Create and configure the MCP server with all wine-pairing tools.
 */
function createServer(): McpServer {
  const config = resolveConfig();
  const client = new SommelierXClient(config);

  const server = new McpServer({
    name: 'SommelierX',
    version: '1.1.0',
  });

  // ── Tool 1: pair_wine_with_ingredients ──

  server.tool(
    'pair_wine_with_ingredients',
    'Find the best wine pairings for a list of ingredients. Provide ingredient names in natural language (e.g. "salmon", "lemon", "dill") and get the top 5 wine matches with scores. The server automatically resolves ingredient names to the database. Best for: "What wine goes with these ingredients?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.02/call (PRO)',
    pairWineWithIngredientsSchema.shape,
    async (input) => {
      const parsed = pairWineWithIngredientsSchema.parse(input);
      const result = await executePairWineWithIngredients(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Tool 2: pair_wine_with_meal ──

  server.tool(
    'pair_wine_with_meal',
    'Find the best wine pairings for a specific dish or meal. Provide the meal name (e.g. "risotto ai funghi", "grilled salmon") and get the top 5 wine matches. The server searches for the meal in the database. Best for: "What wine goes with this dish?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.01/call',
    pairWineWithMealSchema.shape,
    async (input) => {
      const parsed = pairWineWithMealSchema.parse(input);
      const result = await executePairWineWithMeal(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Tool 3: find_meals_for_wine ──

  server.tool(
    'find_meals_for_wine',
    'Find dishes that pair well with a specific wine type or style. Provide a wine name (e.g. "Barolo", "Chardonnay", "Rioja") and get the top 10 matching dishes with scores. Best for: "I have a Barolo, what should I cook?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.01/call',
    findMealsForWineSchema.shape,
    async (input) => {
      const parsed = findMealsForWineSchema.parse(input);
      const result = await executeFindMealsForWine(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Tool 4: pair_wine_with_recipe_url ──

  server.tool(
    'pair_wine_with_recipe_url',
    'Extract ingredients from a recipe URL and find wine pairings. Provide a URL to a recipe page and get the recipe name, extracted ingredients, and top 5 wine matches. Requires Pro tier. Best for: "What wine goes with this recipe?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.02/call (PRO)',
    pairWineWithRecipeUrlSchema.shape,
    async (input) => {
      const parsed = pairWineWithRecipeUrlSchema.parse(input);
      const result = await executePairWineWithRecipeUrl(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Tool 5: search_ingredients ──

  server.tool(
    'search_ingredients',
    'Search for ingredients in the SommelierX database. Returns ingredient names, IDs, and groups. Use this to discover available ingredients before using pair_wine_with_ingredients. Best for: "What mushroom ingredients are available?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.005/call',
    searchIngredientsSchema.shape,
    async (input) => {
      const parsed = searchIngredientsSchema.parse(input);
      const result = await executeSearchIngredients(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Tool 6: search_meals ──

  server.tool(
    'search_meals',
    'Search for meals and dishes in the SommelierX database. Returns meal names, IDs, and descriptions. Use this to discover available meals before using pair_wine_with_meal or group_pairing. Best for: "What pasta dishes are in the database?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.005/call',
    searchMealsSchema.shape,
    async (input) => {
      const parsed = searchMealsSchema.parse(input);
      const result = await executeSearchMeals(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  // ── Tool 7: group_pairing ──

  server.tool(
    'group_pairing',
    'Find the best wine that pairs well with multiple dishes at once. Provide 2-10 meal names and get wines that score well across all of them. Requires Pro tier. Best for: "What single wine works for a 3-course dinner?" | Auth: API key (Bearer sk_live_...) or x402 payment (USDC on Base) | Price: $0.03/call (PRO)',
    groupPairingSchema.shape,
    async (input) => {
      const parsed = groupPairingSchema.parse(input);
      const result = await executeGroupPairing(client, config, parsed);
      return { content: [{ type: 'text' as const, text: result }] };
    },
  );

  return server;
}

/**
 * Start the MCP server on stdio transport.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol messages)
  process.stderr.write('SommelierX MCP server started on stdio\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Fatal error starting MCP server: ${message}\n`);
  process.exit(1);
});
