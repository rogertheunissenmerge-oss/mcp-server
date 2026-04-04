/**
 * HTTP client for the SommelierX Public API v1.
 *
 * Uses native Node.js fetch (available since Node 18).
 * Handles authentication, error responses, and timeout.
 */

import type { ServerConfig } from './config.js';

/** Timeout for all API requests (milliseconds). */
const REQUEST_TIMEOUT_MS = 15_000;

/** Standard error shape returned by the SommelierX API. */
interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    docs_url: string;
  };
  meta?: {
    tier: string;
    calls_remaining_today: number;
  };
}

/** Standard success shape returned by the SommelierX API. */
interface ApiSuccessBody<T = unknown> {
  data: T;
  meta: {
    tier: string;
    calls_remaining_today: number;
    rate_limit_reset: string;
  };
}

/**
 * Error thrown when the SommelierX API returns a non-2xx status.
 * Carries the parsed error body for structured error messages.
 */
export class SommelierXApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly callsRemaining: number | undefined;

  constructor(statusCode: number, body: ApiErrorBody) {
    const remaining = body.meta?.calls_remaining_today;
    const suffix = remaining !== undefined ? ` (${remaining} calls remaining today)` : '';
    super(`${body.error.message}${suffix}`);
    this.name = 'SommelierXApiError';
    this.statusCode = statusCode;
    this.errorCode = body.error.code;
    this.callsRemaining = remaining;
  }
}

/**
 * HTTP client for the SommelierX API.
 * Wraps native fetch with authentication, JSON parsing, and error handling.
 */
export class SommelierXClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(config: ServerConfig) {
    this.baseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Build common headers for API requests.
   * Includes Authorization header when an API key is configured.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'SommelierX-MCP-Server/1.0',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Perform a GET request against the SommelierX API.
   *
   * @param path - API path (e.g. "/api/v1/search")
   * @param params - Query parameters
   * @returns Parsed response data (unwrapped from the envelope)
   * @throws SommelierXApiError on non-2xx responses
   */
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      return await this.handleResponse<T>(response);
    } catch (error: unknown) {
      if (error instanceof SommelierXApiError) throw error;
      throw this.wrapNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Perform a POST request against the SommelierX API.
   *
   * @param path - API path (e.g. "/api/v1/pairing/calculate")
   * @param body - Request body (will be JSON-serialized)
   * @returns Parsed response data (unwrapped from the envelope)
   * @throws SommelierXApiError on non-2xx responses
   */
  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return await this.handleResponse<T>(response);
    } catch (error: unknown) {
      if (error instanceof SommelierXApiError) throw error;
      throw this.wrapNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Parse the API response. Unwraps the standard envelope on success,
   * or throws a structured error on failure.
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const text = await response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new SommelierXApiError(response.status, {
        error: {
          message: `Invalid JSON response from API (status ${response.status})`,
          code: 'INVALID_RESPONSE',
          docs_url: 'https://docs.sommelierx.com/errors/INVALID_RESPONSE',
        },
      });
    }

    if (!response.ok) {
      const errorBody = parsed as ApiErrorBody;
      if (errorBody?.error?.message) {
        throw new SommelierXApiError(response.status, errorBody);
      }
      throw new SommelierXApiError(response.status, {
        error: {
          message: `API request failed with status ${response.status}`,
          code: 'REQUEST_FAILED',
          docs_url: 'https://docs.sommelierx.com/errors/REQUEST_FAILED',
        },
      });
    }

    // Unwrap the standard envelope if present
    const successBody = parsed as ApiSuccessBody<T>;
    if (successBody.data !== undefined) {
      return successBody.data;
    }

    // Some endpoints may not use the envelope (direct JSON)
    return parsed as T;
  }

  /**
   * Wrap network-level errors (timeouts, DNS failures, etc.)
   * into a user-friendly SommelierXApiError.
   */
  private wrapNetworkError(error: unknown): SommelierXApiError {
    const message = error instanceof Error ? error.message : 'Unknown network error';

    if (message.includes('abort')) {
      return new SommelierXApiError(408, {
        error: {
          message: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. The SommelierX API may be temporarily unavailable.`,
          code: 'TIMEOUT',
          docs_url: 'https://docs.sommelierx.com/errors/TIMEOUT',
        },
      });
    }

    return new SommelierXApiError(503, {
      error: {
        message: `Could not connect to SommelierX API: ${message}`,
        code: 'CONNECTION_ERROR',
        docs_url: 'https://docs.sommelierx.com/errors/CONNECTION_ERROR',
      },
    });
  }
}
