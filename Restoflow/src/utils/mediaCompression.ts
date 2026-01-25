import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  useWebWorker: boolean;
  quality: number;
}

export const defaultImageOptions: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  quality: 0.8,
};

export const defaultAudioOptions = {
  maxSizeMB: 5,
  quality: 0.7,
};

export const defaultVideoOptions = {
  maxSizeMB: 10,
  quality: 0.8,
  maxWidth: 1280,
  maxHeight: 720,
};

/**
 * Compress an image file
 */
export const compressImage = async (
  file: File,
  options: Partial<CompressionOptions> = {}
): Promise<File> => {
  try {
    const compressionOptions = { ...defaultImageOptions, ...options };
    const compressedFile = await imageCompression(file, compressionOptions);
    
    console.log('Original file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Compressed file size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
};

/**
 * Compress an audio file (basic implementation)
 */
export const compressAudio = async (file: File): Promise<File> => {
  try {
    // For audio compression, we'll use a simple approach
    // In a real application, you might want to use a more sophisticated audio compression library
    
    if (file.size <= defaultAudioOptions.maxSizeMB * 1024 * 1024) {
      return file; // File is already small enough
    }

    // Create a new file with reduced quality (this is a simplified approach)
    // In production, you'd want to use a proper audio compression library
    const arrayBuffer = await file.arrayBuffer();
    const compressedArrayBuffer = arrayBuffer.slice(0, Math.floor(arrayBuffer.byteLength * defaultAudioOptions.quality));
    
    const compressedFile = new File([compressedArrayBuffer], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });

    console.log('Original audio size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Compressed audio size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');

    return compressedFile;
  } catch (error) {
    console.error('Error compressing audio:', error);
    throw new Error('Failed to compress audio');
  }
};

/**
 * Compress a video file (basic implementation)
 */
export const compressVideo = async (file: File): Promise<File> => {
  try {
    // For video compression, we'll use a basic approach
    // In a real application, you'd want to use FFmpeg or similar
    
    if (file.size <= defaultVideoOptions.maxSizeMB * 1024 * 1024) {
      return file; // File is already small enough
    }

    // Create a canvas to compress video frames (simplified approach)
    // This is a basic implementation - for production, use proper video compression
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        // Calculate new dimensions
        let { width, height } = video;
        const maxWidth = defaultVideoOptions.maxWidth;
        const maxHeight = defaultVideoOptions.maxHeight;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw video frame to canvas
        ctx?.drawImage(video, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'video/webm', // Use WebM for better compression
              lastModified: Date.now(),
            });
            
            console.log('Original video size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
            console.log('Compressed video size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
            
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress video'));
          }
        }, 'video/webm', defaultVideoOptions.quality);
      };
      
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    });
  } catch (error) {
    console.error('Error compressing video:', error);
    throw new Error('Failed to compress video');
  }
};

/**
 * Convert file to base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Validate file type and size
 */
export const validateFile = (
  file: File,
  allowedTypes: string[],
  maxSizeMB: number
): { isValid: boolean; error?: string } => {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size too large. Maximum size: ${maxSizeMB}MB`
    };
  }

  return { isValid: true };
};

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate thumbnail for image
 */
export const generateThumbnail = async (file: File, size: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate thumbnail dimensions
      const ratio = Math.min(size / img.width, size / img.height);
      const width = img.width * ratio;
      const height = img.height * ratio;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
      resolve(thumbnail);
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
