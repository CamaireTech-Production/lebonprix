import { MediaItem } from '../../types';

export interface ImageSuggestion extends MediaItem {
  relevanceScore: number;
  matchType: 'exact' | 'partial' | 'tag' | 'cuisine' | 'keyword';
  matchReason: string;
}

/**
 * Helper function to extract clean words from text (for matching)
 */
function extractCleanWords(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !isStopWord(word));
}

/**
 * Helper function to check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = [
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'among', 'within', 'without', 'under', 'over',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'can', 'this', 'that', 'these', 'those', 'a', 'an', 'as', 'if',
    'than', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'very', 'just', 'now', 'here', 'there',
    'what', 'who', 'which', 'whom', 'whose', 'where', 'when', 'why', 'how',
    'plat', 'dish', 'food', 'cuisine', 'meal', 'avec', 'sans', 'pour', 'dans'
  ];
  return stopWords.includes(word.toLowerCase());
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity percentage between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Check if two words are similar enough to be considered a match
 * Uses fuzzy matching with configurable threshold
 */
function isFuzzyMatch(word1: string, word2: string, threshold: number = 70): boolean {
  const similarity = calculateSimilarity(word1, word2);
  return similarity >= threshold;
}

/**
 * Calculate relevance score for an image based on dish name matching
 * Returns a percentage-based score for ALL images, not just exact matches
 */
export function calculateRelevanceScore(
  dishName: string,
  mediaItem: MediaItem
): { score: number; matchType: ImageSuggestion['matchType']; reason: string } {
  const dishWords = extractCleanWords(dishName);
  const dishNameLower = dishName.toLowerCase();
  
  // Get all searchable text from media item
  const mediaName = mediaItem.dishName?.toLowerCase() || '';
  const originalName = mediaItem.originalFileName.toLowerCase();
  const tags = mediaItem.metadata?.tags || [];
  const cuisine = mediaItem.metadata?.cuisine || '';
  const keywords = mediaItem.metadata?.searchKeywords || [];
  
  let totalScore = 0;
  let maxPossibleScore = 0;
  let matchReasons: string[] = [];
  
  // Exact dish name match (highest priority - 100 points)
  if (mediaName === dishNameLower) {
    return { score: 100, matchType: 'exact', reason: `Exact match: "${mediaItem.dishName}"` };
  }
  
  // Partial dish name match (90 points)
  if (mediaName.includes(dishNameLower) || dishNameLower.includes(mediaName)) {
    return { score: 90, matchType: 'partial', reason: `Partial name match: "${mediaItem.dishName}"` };
  }
  
  // Calculate word matching score (percentage-based with fuzzy matching)
  let wordMatches = 0;
  let matchedWords: string[] = [];
  
  dishWords.forEach(word => {
    maxPossibleScore += 20; // Each word can contribute up to 20 points
    
    // Check exact match first
    if (mediaName.includes(word) || originalName.includes(word)) {
      wordMatches += 20;
      matchedWords.push(word);
    } else {
      // Check fuzzy match for each word in the media name
      const mediaWords = extractCleanWords(mediaName + ' ' + originalName);
      let bestSimilarity = 0;
      let bestMatch = '';
      
      mediaWords.forEach(mediaWord => {
        const similarity = calculateSimilarity(word, mediaWord);
        if (similarity > bestSimilarity && similarity >= 70) { // 70% similarity threshold
          bestSimilarity = similarity;
          bestMatch = mediaWord;
        }
      });
      
      if (bestSimilarity > 0) {
        // Scale the score based on similarity percentage
        const scaledScore = Math.round((bestSimilarity / 100) * 20);
        wordMatches += scaledScore;
        matchedWords.push(`${word}~${bestMatch}(${bestSimilarity}%)`);
      }
    }
  });
  
  if (wordMatches > 0) {
    totalScore += wordMatches;
    matchReasons.push(`Name matches: ${matchedWords.join(', ')}`);
  }
  
  // Calculate tag matching score (percentage-based with fuzzy matching)
  let tagMatches = 0;
  let matchedTags: string[] = [];
  
  dishWords.forEach(word => {
    maxPossibleScore += 15; // Each word can contribute up to 15 points from tags
    
    tags.forEach(tag => {
      // Check exact match first
      if (tag.toLowerCase().includes(word) || word.includes(tag.toLowerCase())) {
        tagMatches += 15;
        matchedTags.push(tag);
      } else {
        // Check fuzzy match
        const similarity = calculateSimilarity(word, tag);
        if (similarity >= 70) { // 70% similarity threshold
          const scaledScore = Math.round((similarity / 100) * 15);
          tagMatches += scaledScore;
          matchedTags.push(`${tag}(${similarity}%)`);
        }
      }
    });
  });
  
  if (tagMatches > 0) {
    totalScore += tagMatches;
    matchReasons.push(`Tag matches: ${[...new Set(matchedTags)].join(', ')}`);
  }
  
  // Calculate cuisine matching score (with fuzzy matching)
  if (cuisine) {
    maxPossibleScore += 10;
    dishWords.forEach(word => {
      // Check exact match first
      if (cuisine.toLowerCase().includes(word) || word.includes(cuisine.toLowerCase())) {
        totalScore += 10;
        matchReasons.push(`Cuisine match: ${cuisine}`);
      } else {
        // Check fuzzy match
        const similarity = calculateSimilarity(word, cuisine);
        if (similarity >= 70) { // 70% similarity threshold
          const scaledScore = Math.round((similarity / 100) * 10);
          totalScore += scaledScore;
          matchReasons.push(`Cuisine match: ${cuisine}(${similarity}%)`);
        }
      }
    });
  }
  
  // Calculate keyword matching score (percentage-based with fuzzy matching)
  let keywordMatches = 0;
  let matchedKeywords: string[] = [];
  
  dishWords.forEach(word => {
    maxPossibleScore += 8; // Each word can contribute up to 8 points from keywords
    
    keywords.forEach(keyword => {
      // Check exact match first
      if (keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase())) {
        keywordMatches += 8;
        matchedKeywords.push(keyword);
      } else {
        // Check fuzzy match
        const similarity = calculateSimilarity(word, keyword);
        if (similarity >= 70) { // 70% similarity threshold
          const scaledScore = Math.round((similarity / 100) * 8);
          keywordMatches += scaledScore;
          matchedKeywords.push(`${keyword}(${similarity}%)`);
        }
      }
    });
  });
  
  if (keywordMatches > 0) {
    totalScore += keywordMatches;
    matchReasons.push(`Keyword matches: ${[...new Set(matchedKeywords)].slice(0, 3).join(', ')}`);
  }
  
  // Calculate final percentage score
  const baseScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  
  // Apply quality multiplier (quality is 1-5, so we use it as a multiplier)
  const quality = mediaItem.quality || 3; // Default to 3 if no quality is set
  const qualityMultiplier = quality / 5; // Convert 1-5 scale to 0.2-1.0 multiplier
  
  // Calculate final score with quality consideration
  // Quality affects the final score: higher quality = higher final score
  const finalScore = Math.round(baseScore * qualityMultiplier);
  
  // Determine match type based on score
  let matchType: ImageSuggestion['matchType'] = 'keyword';
  if (finalScore >= 80) matchType = 'exact';
  else if (finalScore >= 60) matchType = 'partial';
  else if (finalScore >= 40) matchType = 'tag';
  else if (finalScore >= 20) matchType = 'cuisine';
  
  // Add quality info to match reason
  const qualityInfo = quality !== 3 ? ` (Quality: ${quality}/5)` : '';
  const reason = matchReasons.length > 0 
    ? matchReasons.join('; ') + qualityInfo
    : `Low relevance match${qualityInfo}`;
  
  return { 
    score: finalScore, 
    matchType, 
    reason
  };
}

