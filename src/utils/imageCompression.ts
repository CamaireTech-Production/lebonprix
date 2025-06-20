import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

const defaultOptions: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true
};

export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  try {
    const compressionOptions = {
      ...defaultOptions,
      ...options
    };

    // Compress the image
    const compressedFile = await imageCompression(file, compressionOptions);

    // Create a new file with the compressed data
    return new File(
      [compressedFile],
      file.name,
      {
        type: file.type,
        lastModified: file.lastModified
      }
    );
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const validateImage = async (file: File): Promise<{ isValid: boolean; error?: string }> => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return {
      isValid: false,
      error: 'File must be an image'
    };
  }

  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    return {
      isValid: false,
      error: 'Image size must be less than 5MB'
    };
  }

  // Check image dimensions
  try {
    const dimensions = await getImageDimensions(file);
    if (dimensions.width > 4096 || dimensions.height > 4096) {
      return {
        isValid: false,
        error: 'Image dimensions must be less than 4096x4096'
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to validate image dimensions'
    };
  }

  return { isValid: true };
}; 