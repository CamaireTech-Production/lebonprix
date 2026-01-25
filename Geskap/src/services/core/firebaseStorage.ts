// src/services/core/firebaseStorage.ts
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { StorageResult } from '../../types/migration';

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload image: ${errorMessage}`);
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

  async uploadProductImagesFromFiles(
    files: File[],
    userId: string,
    productId: string
  ): Promise<StorageResult[]> {
    const uploadPromises = files.map(async (file, index) => {
      return this.uploadProductImage(file, userId, productId, index);
    });
    
    return Promise.all(uploadPromises);
  }

  async uploadCategoryImage(
    blob: Blob,
    userId: string,
    categoryId: string
  ): Promise<StorageResult> {
    try {
      // Validate blob size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (blob.size > maxSize) {
        throw new Error(`Image size (${(blob.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`);
      }

      // Generate file path for category - use simpler path structure
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const filePath = `categories/${userId}/category_${categoryId}_image_${timestamp}_${randomId}.jpg`;
      const storageRef = ref(storage, filePath);
      
      // Set metadata - keep it minimal to avoid header size issues
      const metadata = {
        contentType: blob.type || 'image/jpeg',
        customMetadata: {
          userId: userId.substring(0, 50), // Limit metadata size
          categoryId: categoryId.substring(0, 50),
          uploadedAt: new Date().toISOString().substring(0, 20) // Shorter timestamp
        }
      };
      
      console.log('Starting category image upload:', {
        filePath,
        size: blob.size,
        contentType: metadata.contentType
      });
      
      // Upload with retry logic
      const snapshot = await this.uploadWithRetry(storageRef, blob, metadata);
      
      console.log('Upload successful, getting download URL...');
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Category image uploaded successfully:', downloadURL);
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        size: blob.size
      };
    } catch (error: any) {
      console.error('Error uploading category image:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to upload category image';
      if (error.code) {
        errorMessage += ` (${error.code})`;
      }
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  async uploadExpenseImage(
    blob: Blob,
    userId: string,
    expenseId: string
  ): Promise<StorageResult> {
    try {
      // Validate blob size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (blob.size > maxSize) {
        throw new Error(`Image size (${(blob.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`);
      }

      // Generate file path for expense - use simpler path structure
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const filePath = `expenses/${userId}/expense_${expenseId}_image_${timestamp}_${randomId}.jpg`;
      const storageRef = ref(storage, filePath);
      
      // Set metadata - keep it minimal to avoid header size issues
      const metadata = {
        contentType: blob.type || 'image/jpeg',
        customMetadata: {
          userId: userId.substring(0, 50), // Limit metadata size
          expenseId: expenseId.substring(0, 50),
          uploadedAt: new Date().toISOString().substring(0, 20) // Shorter timestamp
        }
      };
      
      console.log('Starting expense image upload:', {
        filePath,
        size: blob.size,
        contentType: metadata.contentType
      });
      
      // Upload with retry logic
      const snapshot = await this.uploadWithRetry(storageRef, blob, metadata);
      
      console.log('Upload successful, getting download URL...');
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Expense image uploaded successfully:', downloadURL);
      
      return {
        url: downloadURL,
        path: snapshot.ref.fullPath,
        size: blob.size
      };
    } catch (error: any) {
      console.error('Error uploading expense image:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to upload expense image';
      if (error.code) {
        errorMessage += ` (${error.code})`;
      }
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  async deleteImage(imagePath: string): Promise<void> {
    try {
      const imageRef = ref(storage, imagePath);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete image: ${errorMessage}`);
    }
  }
}

