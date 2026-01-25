/**
 * Cuisine detection utilities
 */

// Common cuisine types and their keywords
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

export interface CuisineDetectionResult {
  cuisine: string | null;
  confidence: number;
  keywords: string[];
}

/**
 * Extract cuisine type from text
 */
export function extractCuisine(text: string): CuisineDetectionResult {
  if (!text || typeof text !== 'string') {
    return { cuisine: null, confidence: 0, keywords: [] };
  }
  
  const textLower = text.toLowerCase();
  const matchedCuisines: Array<{ cuisine: string; score: number; keywords: string[] }> = [];
  
  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    const matchedKeywords: string[] = [];
    let score = 0;
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        score += 1;
      }
    }
    
    if (score > 0) {
      matchedCuisines.push({
        cuisine,
        score,
        keywords: matchedKeywords
      });
    }
  }
  
  if (matchedCuisines.length === 0) {
    return { cuisine: null, confidence: 0, keywords: [] };
  }
  
  // Sort by score (highest first)
  matchedCuisines.sort((a, b) => b.score - a.score);
  
  const bestMatch = matchedCuisines[0];
  const confidence = Math.min((bestMatch.score / 3) * 100, 100); // Max confidence of 100%
  
  return {
    cuisine: bestMatch.cuisine,
    confidence: Math.round(confidence),
    keywords: bestMatch.keywords
  };
}

/**
 * Get all possible cuisines for a text
 */
export function getAllCuisines(text: string): Array<{ cuisine: string; confidence: number; keywords: string[] }> {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const textLower = text.toLowerCase();
  const results: Array<{ cuisine: string; confidence: number; keywords: string[] }> = [];
  
  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    const matchedKeywords: string[] = [];
    let score = 0;
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        score += 1;
      }
    }
    
    if (score > 0) {
      const confidence = Math.min((score / 3) * 100, 100);
      results.push({
        cuisine,
        confidence: Math.round(confidence),
        keywords: matchedKeywords
      });
    }
  }
  
  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if text contains cuisine keywords
 */
export function hasCuisineKeywords(text: string): boolean {
  const result = extractCuisine(text);
  return result.cuisine !== null;
}

/**
 * Get cuisine keywords for a specific cuisine
 */
export function getCuisineKeywords(cuisine: string): string[] {
  return CUISINE_KEYWORDS[cuisine.toLowerCase()] || [];
}

/**
 * Get all available cuisines
 */
export function getAvailableCuisines(): string[] {
  return Object.keys(CUISINE_KEYWORDS);
}

