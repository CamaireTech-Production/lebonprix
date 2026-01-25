import { storage, db } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { MediaItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { generateImageMetadata, generateDishMetadata } from '../utils/metadataGenerator';

/**
 * Upload image to Firebase Storage with metadata
 */
export async function uploadImage(
  file: File | Blob,
  path: string,
  metadata: { 
    dishName?: string, 
    restaurantId: string, 
    type: 'dish' | 'logo' | 'menu',
    dishId?: string,
    originalName: string,
    description?: string,
    price?: number,
    category?: string
  }
): Promise<{ id: string; url: string; path: string }> {
  try {
    const fileExtension = metadata.originalName.split('.').pop() || 'jpg';
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const fullPath = `${path}/${uniqueFileName}`;
    const storageRef = ref(storage, fullPath);
    
    // Generate rich metadata from image name and description
    const generatedMetadata = metadata.type === 'dish' 
      ? generateDishMetadata(metadata.originalName, metadata.dishName || '', metadata.description, metadata.price, metadata.category)
      : generateImageMetadata(metadata.originalName, metadata.dishName, metadata.description);
    
    // Create metadata object for Firebase Storage
    const storageMetadata = {
      customMetadata: {
        dishName: generatedMetadata.dishName,
        restaurantId: metadata.restaurantId,
        type: metadata.type,
        dishId: metadata.dishId || '',
        originalName: metadata.originalName
      }
    };
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file, storageMetadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    // Save reference in Firestore with generated metadata
    const mediaRef = await addDoc(collection(db, 'media'), {
      url: downloadURL,
      originalFileName: metadata.originalName,
      dishName: generatedMetadata.dishName,
      restaurantId: metadata.restaurantId,
      type: metadata.type,
      uploadDate: serverTimestamp(),
      size: file.size,
      storagePath: fullPath,
      quality: generatedMetadata.quality,
      metadata: {
        dishId: metadata.dishId || '',
        originalName: metadata.originalName,
        contentType: file.type || 'image/jpeg',
        customMetadata: metadata,
        // Add generated metadata
        dishName: generatedMetadata.dishName,
        dishDescription: metadata.description,
        dishPrice: metadata.price,
        tags: generatedMetadata.tags,
        cuisine: generatedMetadata.cuisine,
        dietary: generatedMetadata.dietary,
        searchKeywords: generatedMetadata.searchKeywords,
        ...generatedMetadata.customMetadata
      }
    });
    
    return {
      id: mediaRef.id,
      url: downloadURL,
      path: fullPath
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update metadata for an existing image
 */
export async function updateImageMetadata(
  mediaId: string,
  newMetadata: { 
    dishName?: string,
    quality?: number,
    customMetadata?: Record<string, string>
  }
): Promise<{ id: string; updated: boolean }> {
  try {
    // Get the media item from Firestore
    const mediaRef = doc(db, 'media', mediaId);
    const mediaDoc = await getDoc(mediaRef);
    
    if (!mediaDoc.exists()) {
      throw new Error('Media not found');
    }
    
    const mediaData = mediaDoc.data();
    
    // Only update Firestore document - no need to update Storage metadata
    // This avoids permission issues with Firebase Storage
    await updateDoc(mediaRef, {
      dishName: newMetadata.dishName || mediaData.dishName,
      quality: newMetadata.quality !== undefined ? newMetadata.quality : mediaData.quality,
      'metadata.customMetadata': {
        ...mediaData.metadata.customMetadata,
        ...newMetadata.customMetadata,
        dishName: newMetadata.dishName || mediaData.metadata.customMetadata?.dishName || ''
      }
    });
    
    return {
      id: mediaId,
      updated: true
    };
  } catch (error) {
    console.error('Error updating image metadata:', error);
    throw new Error(`Failed to update image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all media items for a restaurant
 */
export async function getRestaurantMedia(restaurantId: string): Promise<MediaItem[]> {
  try {
    const mediaQuery = query(
      collection(db, 'media'),
      where('restaurantId', '==', restaurantId)
    );
    
    const snapshot = await getDocs(mediaQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MediaItem));
  } catch (error) {
    console.error('Error fetching restaurant media:', error);
    throw new Error(`Failed to fetch restaurant media: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all media items (for admin)
 */
export async function getAllMedia(): Promise<MediaItem[]> {
  try {
    const mediaQuery = query(collection(db, 'media'));
    const snapshot = await getDocs(mediaQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as MediaItem));
  } catch (error) {
    console.error('Error fetching all media:', error);
    throw new Error(`Failed to fetch all media: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a media item
 */
export async function deleteMediaItem(mediaId: string): Promise<boolean> {
  try {
    // Get the media item from Firestore
    const mediaRef = doc(db, 'media', mediaId);
    const mediaDoc = await getDoc(mediaRef);
    
    if (!mediaDoc.exists()) {
      throw new Error('Media not found');
    }
    
    const mediaData = mediaDoc.data();
    const storageReference = ref(storage, mediaData.storagePath);
    
    // Delete from Storage
    await deleteObject(storageReference);
    
    // Delete from Firestore
    await deleteDoc(mediaRef);
    
    return true;
  } catch (error) {
    console.error('Error deleting media item:', error);
    throw new Error(`Failed to delete media item: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert base64 to Blob
 */
export function base64ToBlob(base64: string): Promise<Blob> {
  return fetch(base64).then(res => res.blob());
}

/**
 * Extract filename from base64 data URL or return default
 */
export function extractFilenameFromBase64(base64: string, defaultName: string = 'image'): string {
  try {
    // Try to extract MIME type from base64
    const mimeMatch = base64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    return `${defaultName}.${extension}`;
  } catch {
    return `${defaultName}.jpg`;
  }
}

/**
 * Search media by dish name or metadata
 */
export async function searchMedia(
  restaurantId: string,
  searchTerm: string
): Promise<MediaItem[]> {
  try {
    const allMedia = await getRestaurantMedia(restaurantId);
    
    if (!searchTerm.trim()) {
      return allMedia;
    }
    
    const term = searchTerm.toLowerCase();
    return allMedia.filter(item => 
      item.dishName?.toLowerCase().includes(term) ||
      item.originalFileName.toLowerCase().includes(term) ||
      item.metadata.originalName.toLowerCase().includes(term) ||
      Object.values(item.metadata.customMetadata || {}).some(value => 
        value.toLowerCase().includes(term)
      )
    );
  } catch (error) {
    console.error('Error searching media:', error);
    throw new Error(`Failed to search media: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Interface for image suggestion result
 */
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
function calculateRelevanceScore(
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

/**
 * Get intelligent image suggestions for a dish name
 */
export async function getImageSuggestions(
  restaurantId: string,
  dishName: string,
  limit: number = 12
): Promise<ImageSuggestion[]> {
  try {
    if (!dishName.trim()) {
      return [];
    }
    
    // Get all media for the restaurant
    const allMedia = await getRestaurantMedia(restaurantId);
    
    // Filter only dish images
    const dishImages = allMedia.filter(item => item.type === 'dish');
    
    // Calculate relevance scores and create suggestions
    const suggestions: ImageSuggestion[] = dishImages
      .map(item => {
        const { score, matchType, reason } = calculateRelevanceScore(dishName, item);
        return {
          ...item,
          relevanceScore: score,
          matchType,
          matchReason: reason
        };
      })
      .filter(suggestion => suggestion.relevanceScore > 0) // Only include items with some relevance
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance (highest first)
      .slice(0, limit); // Limit results
    
    return suggestions;
  } catch (error) {
    console.error('Error getting image suggestions:', error);
    throw new Error(`Failed to get image suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get diverse image suggestions across different restaurants (for broader suggestions)
 */
export async function getDiverseImageSuggestions(
  currentRestaurantId: string,
  dishName: string,
  limit: number = 8
): Promise<ImageSuggestion[]> {
  try {
    if (!dishName.trim()) {
      return [];
    }
    
    // Get all media from all restaurants
    const allMedia = await getAllMedia();
    
    // Filter only dish images, excluding current restaurant
    const dishImages = allMedia.filter(item => 
      item.type === 'dish' && item.restaurantId !== currentRestaurantId
    );
    
    // Calculate relevance scores and create suggestions
    const suggestions: ImageSuggestion[] = dishImages
      .map(item => {
        const { score, matchType, reason } = calculateRelevanceScore(dishName, item);
        return {
          ...item,
          relevanceScore: score,
          matchType,
          matchReason: reason
        };
      })
      .filter(suggestion => suggestion.relevanceScore > 0) // Show all images with any relevance
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
    
    return suggestions;
  } catch (error) {
    console.error('Error getting diverse image suggestions:', error);
    throw new Error(`Failed to get diverse image suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
