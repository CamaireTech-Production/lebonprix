// src/services/imageProcessor.ts
import { ImageMetadata } from '../types/migration';

export class ImageProcessor {
  async processBase64Image(base64Data: string): Promise<{
    blob: Blob;
    metadata: ImageMetadata;
  }> {
    // 1. Validate base64 format
    if (!this.validateBase64Image(base64Data)) {
      throw new Error('Invalid base64 image data');
    }
    
    // 2. Extract image type and data
    const [header, data] = base64Data.split(',');
    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    
    // 3. Convert to blob
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    
    // 4. Compress if needed (optional)
    const compressedBlob = await this.compressImage(blob);
    
    return {
      blob: compressedBlob,
      metadata: {
        originalSize: byteArray.length,
        compressedSize: compressedBlob.size,
        format: mimeType
      }
    };
  }

  private validateBase64Image(base64Data: string): boolean {
    // Check if string starts with data:image/ or is pure base64
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    const pureBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    
    return base64Regex.test(base64Data) || 
           (base64Data.length > 100 && pureBase64Regex.test(base64Data));
  }

  private async compressImage(blob: Blob, maxSizeKB: number = 500): Promise<Blob> {
    if (blob.size <= maxSizeKB * 1024) {
      return blob;
    }
    
    // Use Canvas API for compression
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob((compressedBlob) => {
          resolve(compressedBlob || blob);
        }, 'image/jpeg', 0.8);
      };
      
      img.src = URL.createObjectURL(blob);
    });
  }
}
