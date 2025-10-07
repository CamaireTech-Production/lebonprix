// src/services/firebaseStorageService.ts
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { StorageResult } from '../types/migration';

export class FirebaseStorageService {
  async uploadProductImage(
    blob: Blob,
    userId: string,
    productId: string,
    imageIndex: number
  ): Promise<StorageResult> {
    try {
      // 1. Generate smart file path
      const filePath = this.generateImagePath(userId, productId, imageIndex);
      const storageRef = ref(storage, filePath);
      
      // 2. Set metadata
      const metadata = {
        contentType: blob.type,
        customMetadata: {
          userId,
          productId,
          imageIndex: imageIndex.toString(),
          uploadedAt: new Date().toISOString()
        }
      };
      
      // 3. Upload with retry logic
      const snapshot = await this.uploadWithRetry(storageRef, blob, metadata);
      
      // 4. Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        size: blob.size
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  private generateImagePath(
    userId: string,
    productId: string,
    imageIndex: number
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    return `products/${userId}/${productId}/image_${imageIndex}_${timestamp}_${randomId}.jpg`;
  }

  private async uploadWithRetry(
    ref: any,
    blob: Blob,
    metadata: any,
    maxRetries: number = 3
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await uploadBytes(ref, blob, metadata);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async deleteProductImages(imagePaths: string[]): Promise<void> {
    const deletePromises = imagePaths.map(async (path) => {
      try {
        const imageRef = ref(storage, path);
        await deleteObject(imageRef);
      } catch (error) {
        console.warn(`Failed to delete image ${path}:`, error);
        // Don't throw - continue with other deletions
      }
    });
    
    await Promise.all(deletePromises);
  }

  async uploadProductImages(
    base64Images: string[],
    userId: string,
    productId: string
  ): Promise<StorageResult[]> {
    const uploadPromises = base64Images.map(async (image, index) => {
      // Convert base64 to blob
      const base64String = image.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      return this.uploadProductImage(blob, userId, productId, index);
    });
    
    return Promise.all(uploadPromises);
  }
}
