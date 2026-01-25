/**
 * Dish classification utilities
 */

// Common dish types and categories
const DISH_CATEGORIES = {
  'appetizer': ['starter', 'appetizer', 'snack', 'finger food', 'canape', 'bruschetta'],
  'main': ['main course', 'entree', 'main dish', 'platter', 'combo'],
  'dessert': ['dessert', 'sweet', 'cake', 'pie', 'ice cream', 'pudding', 'tart'],
  'beverage': ['drink', 'beverage', 'juice', 'smoothie', 'cocktail', 'mocktail'],
  'soup': ['soup', 'broth', 'stew', 'bisque', 'chowder'],
  'salad': ['salad', 'greens', 'mixed', 'fresh'],
  'seafood': ['fish', 'shrimp', 'crab', 'lobster', 'salmon', 'tuna', 'seafood'],
  'meat': ['beef', 'chicken', 'pork', 'lamb', 'steak', 'meat'],
  'vegetarian': ['vegetarian', 'veggie', 'plant based', 'vegan'],
  'grilled': ['grilled', 'bbq', 'barbecue', 'charred'],
  'fried': ['fried', 'crispy', 'deep fried', 'pan fried'],
  'baked': ['baked', 'roasted', 'oven', 'casserole']
};

// Dietary restrictions and preferences
const DIETARY_KEYWORDS = {
  'vegetarian': ['vegetarian', 'veggie', 'plant based'],
  'vegan': ['vegan', 'dairy free', 'egg free'],
  'gluten free': ['gluten free', 'gf', 'celiac'],
  'spicy': ['spicy', 'hot', 'chili', 'pepper', 'jalapeno', 'habanero'],
  'mild': ['mild', 'not spicy', 'gentle'],
  'healthy': ['healthy', 'light', 'low fat', 'low calorie', 'fresh'],
  'organic': ['organic', 'natural', 'farm fresh']
};

export interface DishClassificationResult {
  category: string | null;
  dietary: string[];
  cookingMethod: string | null;
  confidence: number;
  keywords: string[];
}

/**
 * Classify dish based on name and description
 */
export function classifyDish(name: string, description?: string): DishClassificationResult {
  const text = `${name} ${description || ''}`.toLowerCase();
  const matchedKeywords: string[] = [];
  let category: string | null = null;
  let cookingMethod: string | null = null;
  const dietary: string[] = [];
  
  // Find category
  for (const [cat, keywords] of Object.entries(DISH_CATEGORIES)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        if (!category || keywords.length > DISH_CATEGORIES[category].length) {
          category = cat;
        }
        matchedKeywords.push(keyword);
      }
    }
  }
  
  // Find cooking method
  const cookingMethods = ['grilled', 'fried', 'baked', 'steamed', 'boiled', 'roasted'];
  for (const method of cookingMethods) {
    if (text.includes(method)) {
      cookingMethod = method;
      matchedKeywords.push(method);
      break;
    }
  }
  
  // Find dietary restrictions
  for (const [diet, keywords] of Object.entries(DIETARY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        if (!dietary.includes(diet)) {
          dietary.push(diet);
        }
        matchedKeywords.push(keyword);
      }
    }
  }
  
  // Calculate confidence based on number of matches
  const confidence = Math.min((matchedKeywords.length / 5) * 100, 100);
  
  return {
    category,
    dietary,
    cookingMethod,
    confidence: Math.round(confidence),
    keywords: matchedKeywords
  };
}

/**
 * Extract dietary information from text
 */
export function extractDietaryInfo(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const textLower = text.toLowerCase();
  const dietary: string[] = [];
  
  for (const [diet, keywords] of Object.entries(DIETARY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        if (!dietary.includes(diet)) {
          dietary.push(diet);
        }
      }
    }
  }
  
  return dietary;
}

/**
 * Get dish category keywords
 */
export function getDishCategoryKeywords(category: string): string[] {
  return DISH_CATEGORIES[category.toLowerCase()] || [];
}

/**
 * Get all available dish categories
 */
export function getAvailableDishCategories(): string[] {
  return Object.keys(DISH_CATEGORIES);
}

/**
 * Get dietary restriction keywords
 */
export function getDietaryKeywords(diet: string): string[] {
  return DIETARY_KEYWORDS[diet.toLowerCase()] || [];
}

/**
 * Get all available dietary restrictions
 */
export function getAvailableDietaryRestrictions(): string[] {
  return Object.keys(DIETARY_KEYWORDS);
}

