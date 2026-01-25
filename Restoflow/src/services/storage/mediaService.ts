import { FirestoreService } from '../firestoreService';
import { MediaItem } from '../../types';
import { calculateRelevanceScore, ImageSuggestion } from './imageSearch';

/**
 * Get all media items for a restaurant
 */
export async function getRestaurantMedia(restaurantId: string): Promise<MediaItem[]> {
  try {
    return await FirestoreService.getMediaByRestaurant(restaurantId);
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
    return await FirestoreService.getAllMedia();
  } catch (error) {
    console.error('Error fetching all media:', error);
    throw new Error(`Failed to fetch all media: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

