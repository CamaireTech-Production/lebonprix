// Legacy storage service wrapper for backward compatibility
import { uploadImage as uploadImageNew, uploadImages, base64ToBlob, extractFilenameFromBase64 } from './imageUpload';
import { getRestaurantMedia, getAllMedia, searchMedia, getImageSuggestions, getDiverseImageSuggestions } from './mediaService';
import { FirestoreService } from '../firestoreService';
import { MediaItem } from '../../types';

// Re-export new functions with legacy names for backward compatibility
export { 
  uploadImage: uploadImageNew,
  uploadImages,
  base64ToBlob,
  extractFilenameFromBase64,
  getRestaurantMedia,
  getAllMedia,
  searchMedia,
  getImageSuggestions,
  getDiverseImageSuggestions
};

// Legacy functions that need to be updated
export async function updateImageMetadata(
  mediaId: string,
  newMetadata: { 
    dishName?: string;
    quality?: number;
    customMetadata?: Record<string, string>;
  }
): Promise<{ id: string; updated: boolean }> {
  try {
    await FirestoreService.updateMedia('', mediaId, newMetadata);
    return { id: mediaId, updated: true };
  } catch (error) {
    console.error('Error updating image metadata:', error);
    throw new Error(`Failed to update image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteMediaItem(mediaId: string): Promise<boolean> {
  try {
    await FirestoreService.deleteMedia('', mediaId);
    return true;
  } catch (error) {
    console.error('Error deleting media item:', error);
    throw new Error(`Failed to delete media item: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

