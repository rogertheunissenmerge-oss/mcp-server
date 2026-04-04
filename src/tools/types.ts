/**
 * Shared types for MCP tool responses.
 *
 * These types represent the data returned by the SommelierX API
 * after it has been unwrapped from the standard API envelope.
 */

/** A single wine match result from pairing endpoints. */
export interface WineMatch {
  metaWineId: number;
  name: string;
  color: string;
  region?: string;
  grapes?: string[];
  score: {
    match_percentage: number;
    basic_score?: number;
    balance_score?: number;
    aromatic_score?: number | null;
  };
  description?: string;
  glassType?: string;
}

/** Result from pairing/calculate. */
export interface PairingResult {
  results: WineMatch[];
}

/** Result from pairing/by-meal. */
export interface MealPairingResult {
  mealId: number;
  results: WineMatch[];
}

/** A single meal match from reverse pairing. */
export interface MealMatch {
  id: number;
  name: string;
  description?: string;
  score: {
    match_percentage: number;
    basic_score?: number;
    balance_score?: number;
    aromatic_score?: number | null;
  };
}

/** Paginated result from by-wine/meals. */
export interface MealsByWineResult {
  data: MealMatch[];
  total: number;
  page: number;
  perPage: number;
}

/** Search result item. */
export interface SearchResultItem {
  id: number;
  name: string;
  type: string;
  description?: string;
}

/** Search results response. */
export interface SearchResults {
  meals?: SearchResultItem[];
  ingredients?: SearchResultItem[];
}

/** Ingredient from search/list. */
export interface IngredientItem {
  id: number;
  name: string;
  group?: string;
  description?: string;
}

/** Paginated ingredient list. */
export interface IngredientListResult {
  data: IngredientItem[];
  total: number;
  page: number;
  perPage: number;
}

/** Meal from search/list. */
export interface MealItem {
  id: number;
  name: string;
  description?: string;
  ingredients?: Array<{
    id: number;
    name: string;
    amount?: string;
  }>;
}

/** Paginated meal list. */
export interface MealListResult {
  data: MealItem[];
  total: number;
  page: number;
  perPage: number;
}

/** Group pairing result. */
export interface GroupPairingResult {
  results: Array<WineMatch & {
    mealScores?: Array<{
      mealId: number;
      mealName: string;
      match_percentage: number;
    }>;
  }>;
}

/** Recipe extraction result. */
export interface RecipeExtractResult {
  name: string;
  source: string;
  ingredients: Array<{
    id?: number;
    name: string;
    amount?: string;
    matched?: boolean;
  }>;
}
