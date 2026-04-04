/**
 * Tool registry — barrel export for all MCP tools.
 */

export {
  pairWineWithIngredientsSchema,
  executePairWineWithIngredients,
} from './pair-wine-with-ingredients.js';

export {
  pairWineWithMealSchema,
  executePairWineWithMeal,
} from './pair-wine-with-meal.js';

export {
  findMealsForWineSchema,
  executeFindMealsForWine,
} from './find-meals-for-wine.js';

export {
  pairWineWithRecipeUrlSchema,
  executePairWineWithRecipeUrl,
} from './pair-wine-with-recipe-url.js';

export {
  searchIngredientsSchema,
  executeSearchIngredients,
} from './search-ingredients.js';

export {
  searchMealsSchema,
  executeSearchMeals,
} from './search-meals.js';

export {
  groupPairingSchema,
  executeGroupPairing,
} from './group-pairing.js';
