// Re-export all storage services for easy importing
export * from './imageUpload';
export * from './imageSearch';
export * from './mediaService';

// Legacy compatibility - maintain the old interface
export { 
  uploadImage,
  uploadImages,
  base64ToBlob,
  extractFilenameFromBase64,
  getRestaurantMedia,
  getAllMedia,
  searchMedia,
  getImageSuggestions,
  getDiverseImageSuggestions
} from './legacyStorageService';

