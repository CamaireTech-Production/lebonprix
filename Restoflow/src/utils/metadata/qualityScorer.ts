/**
 * Quality scoring utilities for metadata
 */

export interface QualityScoreResult {
  score: number;
  factors: string[];
  suggestions: string[];
}

/**
 * Calculate quality score for image metadata
 */
export function calculateQualityScore(metadata: any): QualityScoreResult {
  const factors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  let maxScore = 0;
  
  // Dish name quality (30 points)
  maxScore += 30;
  if (metadata.dishName && metadata.dishName.trim().length > 0) {
    score += 20;
    factors.push('Has dish name');
    
    if (metadata.dishName.length >= 3 && metadata.dishName.length <= 50) {
      score += 10;
      factors.push('Dish name length is appropriate');
    } else {
      suggestions.push('Dish name should be 3-50 characters long');
    }
  } else {
    suggestions.push('Add a descriptive dish name');
  }
  
  // Description quality (25 points)
  maxScore += 25;
  if (metadata.description && metadata.description.trim().length > 0) {
    score += 15;
    factors.push('Has description');
    
    if (metadata.description.length >= 10 && metadata.description.length <= 200) {
      score += 10;
      factors.push('Description length is appropriate');
    } else {
      suggestions.push('Description should be 10-200 characters long');
    }
  } else {
    suggestions.push('Add a description to help customers understand the dish');
  }
  
  // Price information (20 points)
  maxScore += 20;
  if (metadata.price && typeof metadata.price === 'number' && metadata.price > 0) {
    score += 20;
    factors.push('Has price information');
  } else {
    suggestions.push('Add price information');
  }
  
  // Category information (15 points)
  maxScore += 15;
  if (metadata.category && metadata.category.trim().length > 0) {
    score += 15;
    factors.push('Has category information');
  } else {
    suggestions.push('Add category information');
  }
  
  // Tags quality (10 points)
  maxScore += 10;
  if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
    score += 5;
    factors.push('Has tags');
    
    if (metadata.tags.length >= 2 && metadata.tags.length <= 10) {
      score += 5;
      factors.push('Appropriate number of tags');
    } else {
      suggestions.push('Add 2-10 relevant tags');
    }
  } else {
    suggestions.push('Add relevant tags to improve discoverability');
  }
  
  // Calculate final score as percentage
  const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  
  return {
    score: finalScore,
    factors,
    suggestions
  };
}

/**
 * Calculate quality score for restaurant metadata
 */
export function calculateRestaurantQualityScore(restaurant: any): QualityScoreResult {
  const factors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  let maxScore = 0;
  
  // Restaurant name (20 points)
  maxScore += 20;
  if (restaurant.name && restaurant.name.trim().length > 0) {
    score += 20;
    factors.push('Has restaurant name');
  } else {
    suggestions.push('Add restaurant name');
  }
  
  // Email (15 points)
  maxScore += 15;
  if (restaurant.email && restaurant.email.trim().length > 0) {
    score += 15;
    factors.push('Has email address');
  } else {
    suggestions.push('Add email address');
  }
  
  // Phone (15 points)
  maxScore += 15;
  if (restaurant.phone && restaurant.phone.trim().length > 0) {
    score += 15;
    factors.push('Has phone number');
  } else {
    suggestions.push('Add phone number');
  }
  
  // Address (20 points)
  maxScore += 20;
  if (restaurant.address && restaurant.address.trim().length > 0) {
    score += 20;
    factors.push('Has address');
  } else {
    suggestions.push('Add restaurant address');
  }
  
  // Description (15 points)
  maxScore += 15;
  if (restaurant.description && restaurant.description.trim().length > 0) {
    score += 15;
    factors.push('Has description');
  } else {
    suggestions.push('Add restaurant description');
  }
  
  // Business hours (15 points)
  maxScore += 15;
  if (restaurant.businessHours && Object.keys(restaurant.businessHours).length > 0) {
    score += 15;
    factors.push('Has business hours');
  } else {
    suggestions.push('Add business hours');
  }
  
  // Calculate final score as percentage
  const finalScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  
  return {
    score: finalScore,
    factors,
    suggestions
  };
}

/**
 * Get quality level from score
 */
export function getQualityLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Get quality color from score
 */
export function getQualityColor(score: number): string {
  if (score >= 90) return '#10B981'; // Green
  if (score >= 70) return '#3B82F6'; // Blue
  if (score >= 50) return '#F59E0B'; // Yellow
  return '#EF4444'; // Red
}

/**
 * Get quality emoji from score
 */
export function getQualityEmoji(score: number): string {
  if (score >= 90) return '🌟';
  if (score >= 70) return '👍';
  if (score >= 50) return '👌';
  return '⚠️';
}

