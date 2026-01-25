/**
 * Integration tests for storage services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { uploadImage } from '../../services/storage/imageUpload';
import { getRestaurantMedia } from '../../services/storage/mediaService';
import { searchImages } from '../../services/storage/imageSearch';

// Mock Firebase
vi.mock('../../firebase/config', () => ({
  storage: {
    ref: vi.fn(() => ({
      put: vi.fn(() => ({
        ref: {
          getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/image.jpg'))
        }
      }))
    }))
  },
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(() => Promise.resolve()),
        get: vi.fn(() => Promise.resolve({
          exists: true,
          data: () => ({
            id: 'media-1',
            url: 'https://example.com/image.jpg',
            restaurantId: 'rest-1',
            metadata: {
              size: 1024,
              type: 'image/jpeg'
            }
          })
        }))
      })),
      where: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({
          docs: [
            {
              id: 'media-1',
              data: () => ({
                url: 'https://example.com/image.jpg',
                restaurantId: 'rest-1',
                metadata: {
                  size: 1024,
                  type: 'image/jpeg'
                }
              })
            }
          ]
        }))
      }))
    }))
  }
}));

describe('Storage Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Image Upload Flow', () => {
    it('should upload image and save metadata', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const restaurantId = 'rest-1';
      
      const result = await uploadImage(mockFile, restaurantId);
      
      expect(result).toEqual({
        success: true,
        url: 'https://example.com/image.jpg',
        metadata: expect.objectContaining({
          size: expect.any(Number),
          type: 'image/jpeg'
        })
      });
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const restaurantId = 'rest-1';
      
      // Mock upload failure
      const { storage } = await import('../../firebase/config');
      vi.mocked(storage.ref).mockImplementation(() => {
        throw new Error('Upload failed');
      });
      
      const result = await uploadImage(mockFile, restaurantId);
      
      expect(result).toEqual({
        success: false,
        error: 'Upload failed'
      });
    });

    it('should validate file type', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const restaurantId = 'rest-1';
      
      const result = await uploadImage(mockFile, restaurantId);
      
      expect(result).toEqual({
        success: false,
        error: 'Invalid file type. Only images are allowed.'
      });
    });

    it('should validate file size', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 10 * 1024 * 1024 }); // 10MB
      const restaurantId = 'rest-1';
      
      const result = await uploadImage(mockFile, restaurantId);
      
      expect(result).toEqual({
        success: false,
        error: 'File size too large. Maximum size is 5MB.'
      });
    });
  });

  describe('Media Retrieval Flow', () => {
    it('should retrieve restaurant media', async () => {
      const restaurantId = 'rest-1';
      
      const result = await getRestaurantMedia(restaurantId);
      
      expect(result).toEqual({
        success: true,
        media: expect.arrayContaining([
          expect.objectContaining({
            id: 'media-1',
            url: 'https://example.com/image.jpg',
            restaurantId: 'rest-1'
          })
        ])
      });
    });

    it('should handle retrieval errors', async () => {
      const restaurantId = 'rest-1';
      
      // Mock retrieval failure
      const { db } = await import('../../firebase/config');
      vi.mocked(db.collection).mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const result = await getRestaurantMedia(restaurantId);
      
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });

    it('should filter media by type', async () => {
      const restaurantId = 'rest-1';
      const mediaType = 'image/jpeg';
      
      const result = await getRestaurantMedia(restaurantId, mediaType);
      
      expect(result).toEqual({
        success: true,
        media: expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              type: 'image/jpeg'
            })
          })
        ])
      });
    });
  });

  describe('Image Search Flow', () => {
    it('should search images by query', async () => {
      const restaurantId = 'rest-1';
      const query = 'food';
      
      const result = await searchImages(restaurantId, query);
      
      expect(result).toEqual({
        success: true,
        images: expect.arrayContaining([
          expect.objectContaining({
            id: 'media-1',
            url: 'https://example.com/image.jpg',
            score: expect.any(Number)
          })
        ])
      });
    });

    it('should handle search errors', async () => {
      const restaurantId = 'rest-1';
      const query = 'food';
      
      // Mock search failure
      const { db } = await import('../../firebase/config');
      vi.mocked(db.collection).mockImplementation(() => {
        throw new Error('Search failed');
      });
      
      const result = await searchImages(restaurantId, query);
      
      expect(result).toEqual({
        success: false,
        error: 'Search failed'
      });
    });

    it('should return empty results for no matches', async () => {
      const restaurantId = 'rest-1';
      const query = 'nonexistent';
      
      // Mock empty results
      const { db } = await import('../../firebase/config');
      vi.mocked(db.collection).mockReturnValue({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            docs: []
          }))
        }))
      } as any);
      
      const result = await searchImages(restaurantId, query);
      
      expect(result).toEqual({
        success: true,
        images: []
      });
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full image workflow', async () => {
      // 1. Upload image
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const restaurantId = 'rest-1';
      
      const uploadResult = await uploadImage(mockFile, restaurantId);
      expect(uploadResult.success).toBe(true);
      
      // 2. Retrieve media
      const mediaResult = await getRestaurantMedia(restaurantId);
      expect(mediaResult.success).toBe(true);
      expect(mediaResult.media).toHaveLength(1);
      
      // 3. Search images
      const searchResult = await searchImages(restaurantId, 'test');
      expect(searchResult.success).toBe(true);
      expect(searchResult.images).toHaveLength(1);
    });

    it('should handle concurrent operations', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const restaurantId = 'rest-1';
      
      // Start multiple operations concurrently
      const operations = [
        uploadImage(mockFile, restaurantId),
        getRestaurantMedia(restaurantId),
        searchImages(restaurantId, 'test')
      ];
      
      const results = await Promise.all(operations);
      
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });
  });
});

