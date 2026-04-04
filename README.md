# @sommelierx/mcp-server

Wine pairing intelligence for AI assistants. Connect Claude, Cursor, Windsurf, or any MCP-compatible client to a sommelier-grade pairing algorithm that matches wines to your ingredients, dishes, and recipes.

## Quick Start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sommelierx": {
      "command": "npx",
      "args": ["@sommelierx/mcp-server"]
    }
  }
}
```

That is it. Ask Claude _"What wine goes with grilled salmon?"_ and it will use SommelierX to answer.

### With a Pro API key

For recipe extraction, group pairing, and score breakdowns:

```json
{
  "mcpServers": {
    "sommelierx": {
      "command": "npx",
      "args": ["@sommelierx/mcp-server"],
      "env": {
        "SOMMELIERX_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

### Cursor / Windsurf / Other MCP Clients

The same configuration works. Add the `command` and `args` to your client's MCP settings.

## Available Tools

| Tool | What it does | Tier |
|------|-------------|------|
| `pair_wine_with_ingredients` | Find wines for a list of ingredients (e.g. "salmon, lemon, dill") | Free |
| `pair_wine_with_meal` | Find wines for a dish name (e.g. "risotto ai funghi") | Free |
| `find_meals_for_wine` | Find dishes that pair with a wine style (e.g. "Barolo") | Free |
| `search_ingredients` | Search the ingredient database | Free |
| `search_meals` | Search the meal database | Free |
| `pair_wine_with_recipe_url` | Extract ingredients from a recipe URL and pair wines | Pro |
| `group_pairing` | Find the best wine across multiple dishes (e.g. 3-course dinner) | Pro |

## Authentication

SommelierX supports two authentication methods. You can use either one -- no need to configure both.

### Option 1: API Key (subscription)

Set the `SOMMELIERX_API_KEY` environment variable in your MCP client config. The key format is `sk_live_...`. You get a monthly call allowance based on your tier (Free / Pro / Enterprise).

```json
{
  "mcpServers": {
    "sommelierx": {
      "command": "npx",
      "args": ["@sommelierx/mcp-server"],
      "env": {
        "SOMMELIERX_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

Get your API key at [api.sommelierx.com](https://api.sommelierx.com).

### Option 2: x402 Payment (pay per call)

No API key needed. Your AI agent pays per call using USDC on the Base network via the [Coinbase x402 protocol](https://www.x402.org/). When a request lacks an API key, the server returns a `402 Payment Required` response with a payment payload. x402-compatible agents handle this automatically.

This is ideal for:
- AI agents that manage their own wallet
- Pay-as-you-go usage without a subscription
- Agent-to-agent commerce (no human in the loop)

### Pricing (per call)

| Tool | Price | Tier |
|------|-------|------|
| `pair_wine_with_meal` | $0.01 | Free |
| `find_meals_for_wine` | $0.01 | Free |
| `search_ingredients` | $0.005 | Free |
| `search_meals` | $0.005 | Free |
| `pair_wine_with_ingredients` | $0.02 | Pro |
| `pair_wine_with_recipe_url` | $0.02 | Pro |
| `group_pairing` | $0.03 | Pro |

With an API key, calls are deducted from your tier allowance. With x402, each call is charged at the listed price.

## Example Conversations

**Basic pairing:**
> "What wine pairs well with salmon, asparagus, and hollandaise sauce?"

**Reverse pairing:**
> "I have a bottle of Barolo. What should I cook?"

**Recipe URL:**
> "What wine goes with this recipe? https://www.allrecipes.com/recipe/..."

**Dinner party:**
> "I'm planning a 3-course dinner: Caesar salad, rack of lamb, and chocolate mousse. What single wine works for all courses?"

## How It Works

1. You ask your AI assistant a wine question
2. The assistant calls the appropriate SommelierX tool
3. The MCP server translates your input into structured API calls
4. SommelierX's pairing algorithm (17 food DNA dimensions x 19 wine DNA dimensions) calculates matches
5. You get scored wine recommendations based on real sommelier expertise

### Ingredient Resolution

When you use `pair_wine_with_ingredients`, the server automatically resolves natural language ingredient names to database entries. The AI assistant does not need to know database IDs -- it passes ingredient names directly.

## Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `SOMMELIERX_API_KEY` | No | -- | API key for Pro/Enterprise access. Without a key, free tier (50 calls/day). |
| `SOMMELIERX_API_URL` | No | `https://api.sommelierx.com` | API base URL. |
| `SOMMELIERX_LANGUAGE` | No | `en` | Default language for results (`en`, `nl`, `fr`, `de`, `es`, `it`). |

## API Tiers

| Tier | Daily Limit | Per-Minute Limit | Features |
|------|------------|------------------|----------|
| **Free** | 50 calls | 2/min | Basic pairing, search, ingredient/meal lookup |
| **Pro** ($49/mo) | 500 calls | 20/min | + Recipe URL extraction, group pairing, score breakdowns |
| **Enterprise** | 10,000 calls | 100/min | + Custom limits, SLA |

Get your API key at [api.sommelierx.com](https://api.sommelierx.com)

## API Documentation

Full API documentation is available at [docs.sommelierx.com](https://docs.sommelierx.com).

The OpenAPI specification is served at `https://api.sommelierx.com/api/v1/openapi.json`.

## Development

```bash
npm install
npm run build
npm run dev       # development mode with hot reload
npm run typecheck # type checking without emit
```

## Requirements

- Node.js >= 18.0.0

## License

MIT
