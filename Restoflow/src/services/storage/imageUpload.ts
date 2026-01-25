import { storage } from '../../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { generateImageMetadata, generateDishMetadata } from '../../utils/metadataGenerator';

export interface ImageUploadMetadata {
  dishName?: string;
  restaurantId: string;
  type: 'dish' | 'logo' | 'menu';
  dishId?: string;
  originalName: string;
  description?: string;
  price?: number;
  category?: string;
}

export interface ImageUploadResult {
  id: string;
  url: string;
  path: string;
}

/**
 * Upload image to Firebase Storage with metadata
 */
export async function uploadImage(
  file: File | Blob,
  path: string,
  metadata: ImageUploadMetadata
): Promise<ImageUploadResult> {
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
    
    return {
      id: uuidv4(),
      url: downloadURL,
      path: fullPath
    };
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload multiple images in batch
 */
export async function uploadImages(
  files: File[],
  path: string,
  metadata: Omit<ImageUploadMetadata, 'originalName'> & { originalNames: string[] }
): Promise<ImageUploadResult[]> {
  const uploadPromises = files.map((file, index) => 
    uploadImage(file, path, {
      ...metadata,
      originalName: metadata.originalNames[index] || file.name
    })
  );
  
  return Promise.all(uploadPromises);
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

