/**
 * Utility functions for generating metadata from image names and descriptions
 */

// Common cuisine types
const CUISINE_KEYWORDS = {
  'italian': ['pasta', 'pizza', 'risotto', 'bruschetta', 'tiramisu', 'lasagna', 'carbonara', 'gnocchi'],
  'chinese': ['noodles', 'fried rice', 'dumplings', 'wonton', 'chow mein', 'kung pao', 'sweet sour', 'spring roll'],
  'indian': ['curry', 'biryani', 'tandoori', 'naan', 'dal', 'masala', 'tikka', 'samosa', 'butter chicken'],
  'mexican': ['taco', 'burrito', 'quesadilla', 'enchilada', 'guacamole', 'salsa', 'nachos', 'fajita'],
  'japanese': ['sushi', 'ramen', 'tempura', 'teriyaki', 'miso', 'sashimi', 'udon', 'yakitori'],
  'thai': ['pad thai', 'tom yum', 'green curry', 'red curry', 'mango sticky rice', 'papaya salad'],
  'french': ['croissant', 'ratatouille', 'coq au vin', 'bouillabaisse', 'quiche', 'crepe', 'escargot'],
  'american': ['burger', 'hot dog', 'bbq', 'ribs', 'mac cheese', 'apple pie', 'buffalo wings'],
  'mediterranean': ['hummus', 'falafel', 'tzatziki', 'gyro', 'olive', 'feta', 'tabbouleh'],
  'african': ['jollof', 'injera', 'couscous', 'tagine', 'bobotie', 'peri peri', 'suya'],
  'cameroonian': ['ndole', 'eru', 'achu', 'kokki', 'pepper soup', 'plantain', 'fufu', 'bobolo']
};

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

/**
 * Extract cuisine type from text
 */
function extractCuisine(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return cuisine;
    }
  }
  
  return null;
}

/**
 * Extract dish categories from text
 */
function extractCategories(text: string): string[] {
  const lowerText = text.toLowerCase();
  const categories: string[] = [];
  
  for (const [category, keywords] of Object.entries(DISH_CATEGORIES)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      categories.push(category);
    }
  }
  
  return categories;
}

/**
 * Extract dietary information from text
 */
function extractDietary(text: string): string[] {
  const lowerText = text.toLowerCase();
  const dietary: string[] = [];
  
  for (const [diet, keywords] of Object.entries(DIETARY_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      dietary.push(diet);
    }
  }
  
  return dietary;
}

/**
 * Generate tags from text by extracting meaningful words
 */
function generateTags(text: string): string[] {
  const lowerText = text.toLowerCase();
  
  // Remove common words and extract meaningful terms
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'];
  
  // Split by common separators and clean up
  const words = lowerText
    .replace(/[_-]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  
  return words.slice(0, 10); // Limit to 10 tags
}

/**
 * Generate search keywords from text
 */
function generateSearchKeywords(text: string, dishName?: string, description?: string): string[] {
  const allText = [text, dishName, description].filter(Boolean).join(' ').toLowerCase();
  
  // Extract meaningful keywords
  const keywords = allText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  
  return keywords.slice(0, 15); // Limit to 15 keywords
}

/**
 * Calculate quality score based on metadata richness
 */
function calculateQualityScore(metadata: any): number {
  let score = 3; // Base score
  
  // Increase score based on metadata richness
  if (metadata.dishName && metadata.dishName.length > 0) score += 0.5;
  if (metadata.tags && metadata.tags.length > 3) score += 0.5;
  if (metadata.cuisine) score += 0.5;
  if (metadata.searchKeywords && metadata.searchKeywords.length > 5) score += 0.5;
  if (metadata.dietary && metadata.dietary.length > 0) score += 0.5;
  
  return Math.min(5, Math.max(1, Math.round(score)));
}

/**
 * Main function to generate metadata from image name and description
 */
export function generateImageMetadata(
  imageName: string,
  dishName?: string,
  description?: string,
  existingMetadata?: any
): {
  dishName: string;
  tags: string[];
  cuisine: string | null;
  dietary: string[];
  searchKeywords: string[];
  quality: number;
  customMetadata: Record<string, string>;
} {
  // Use dish name if provided, otherwise extract from image name
  const finalDishName = dishName || imageName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  
  // Combine all text for analysis
  const allText = [imageName, dishName, description].filter(Boolean).join(' ');
  
  // Generate metadata
  const tags = generateTags(allText);
  const cuisine = extractCuisine(allText);
  const categories = extractCategories(allText);
  const dietary = extractDietary(allText);
  const searchKeywords = generateSearchKeywords(allText, dishName, description);
  
  // Create custom metadata
  const customMetadata: Record<string, string> = {
    ...existingMetadata?.customMetadata,
    originalName: imageName,
    generatedAt: new Date().toISOString(),
    categories: categories.join(', '),
    ...(description && { description })
  };
  
  // Calculate quality score
  const metadata = {
    dishName: finalDishName,
    tags,
    cuisine,
    dietary,
    searchKeywords,
    customMetadata
  };
  
  const quality = calculateQualityScore(metadata);
  
  return {
    ...metadata,
    quality
  };
}

/**
 * Generate metadata for a dish image
 */
export function generateDishMetadata(
  imageName: string,
  dishName: string,
  description?: string,
  price?: number,
  category?: string
): {
  dishName: string;
  tags: string[];
  cuisine: string | null;
  dietary: string[];
  searchKeywords: string[];
  quality: number;
  customMetadata: Record<string, string>;
} {
  // Combine all available information
  const allText = [imageName, dishName, description, category].filter(Boolean).join(' ');
  
  // Generate metadata
  const tags = generateTags(allText);
  const cuisine = extractCuisine(allText);
  const categories = extractCategories(allText);
  const dietary = extractDietary(allText);
  const searchKeywords = generateSearchKeywords(allText, dishName, description);
  
  // Create custom metadata with dish-specific information
  const customMetadata: Record<string, string> = {
    originalName: imageName,
    generatedAt: new Date().toISOString(),
    categories: categories.join(', '),
    ...(description && { description }),
    ...(price && { price: price.toString() }),
    ...(category && { category })
  };
  
  // Calculate quality score
  const metadata = {
    dishName,
    tags,
    cuisine,
    dietary,
    searchKeywords,
    customMetadata
  };
  
  const quality = calculateQualityScore(metadata);
  
  return {
    ...metadata,
    quality
  };
}
