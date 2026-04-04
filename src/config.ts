/**
 * Configuration for the SommelierX MCP server.
 *
 * Reads settings from environment variables. The API key is optional:
 * without one, the server operates in free tier mode (10 calls/day).
 *
 * Environment variables:
 *   SOMMELIERX_API_KEY  - API key for authenticated access (sk_live_...)
 *   SOMMELIERX_API_URL  - Base URL for the SommelierX API (default: https://api.sommelierx.com)
 */

/** Shape of the resolved configuration. */
export interface ServerConfig {
  /** Base URL for the SommelierX API (no trailing slash). */
  apiBaseUrl: string;
  /** Optional API key for authenticated (Pro/Enterprise) access. */
  apiKey: string | undefined;
  /** Default language for API requests. */
  defaultLanguage: string;
}

/**
 * Resolve configuration from environment variables and CLI arguments.
 * CLI arguments take precedence over environment variables.
 *
 * @returns Resolved configuration object.
 */
export function resolveConfig(): ServerConfig {
  const apiBaseUrl = (
    process.env.SOMMELIERX_API_URL ?? 'https://api.sommelierx.com'
  ).replace(/\/+$/, '');

  const apiKey = process.env.SOMMELIERX_API_KEY || undefined;

  const defaultLanguage = process.env.SOMMELIERX_LANGUAGE ?? 'en';

  return {
    apiBaseUrl,
    apiKey,
    defaultLanguage,
  };
}
