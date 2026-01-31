import { collection, query as firebaseQuery, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../core/firebase';
import { logError } from '../../utils/core/logger';
import type { Product } from '../../types/models';

interface SearchCache {
  results: Product[];
  timestamp: number;
  ttl: number;
}

class SearchCacheManager {
  static cacheSearch(companyId: string, query: string, results: Product[]): void {
    const cacheKey = `search_${companyId}_${query.toLowerCase()}`;
    const cacheData: SearchCache = {
      results,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5 minutes
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache search results:', error);
    }
  }

  static getCachedSearch(companyId: string, query: string): Product[] | null {
    const cacheKey = `search_${companyId}_${query.toLowerCase()}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const cacheData: SearchCache = JSON.parse(cached);
      if (Date.now() - cacheData.timestamp > cacheData.ttl) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cacheData.results;
    } catch (error) {
      console.warn('Failed to retrieve cached search results:', error);
      return null;
    }
  }

  static clearCompanyCache(companyId: string): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`search_${companyId}_`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear search cache:', error);
    }
  }
}

/**
 * Create search index for product
 */
export const createSearchIndex = (product: {
  name: string;
  reference?: string;
  barCode?: string;
  category?: string;
}): string[] => {
  const terms = new Set<string>();

  // Add name words (minimum 3 characters)
  product.name
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 2)
    .forEach(word => terms.add(word));

  // Add full name as single term
  if (product.name.length > 2) {
    terms.add(product.name.toLowerCase());
  }

  // Add reference
  if (product.reference && product.reference.length > 1) {
    terms.add(product.reference.toLowerCase());
  }

  // Add barcode
  if (product.barCode && product.barCode.length > 1) {
    terms.add(product.barCode.toLowerCase());
  }

  // Add category
  if (product.category && product.category.length > 2) {
    terms.add(product.category.toLowerCase());
  }

  return Array.from(terms);
};

/**
 * Search products in Firebase using indexed search
 */
export const searchProductsInFirebase = async (companyId: string, query: string): Promise<Product[]> => {
  try {
    // Check cache first
    const cachedResults = SearchCacheManager.getCachedSearch(companyId, query);
    if (cachedResults) {
      return cachedResults;
    }

    const searchTerms = query.toLowerCase()
      .split(' ')
      .filter(term => term.length > 2)
      .slice(0, 3); // Limit to 3 terms for performance

    if (searchTerms.length === 0) {
      return [];
    }

    // Create queries for each search term
    const queries = searchTerms.map(term =>
      firebaseQuery(
        collection(db, 'products'),
        where('companyId', '==', companyId),
        where('searchIndex', 'array-contains', term),
        where('isAvailable', '==', true),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
    );

    // Execute queries in parallel
    const snapshots = await Promise.all(queries.map(q => getDocs(q)));

    // Merge and deduplicate results
    const allProducts = snapshots.flatMap(snapshot =>
      snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() as Omit<Product, 'id'>
      }))
    ) as Product[];

    // Remove duplicates by ID
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.id, p])).values()
    );

    // Apply client-side filtering for deleted products and exact matches
    const finalResults = uniqueProducts.filter(product =>
      product.isDeleted !== true &&
      (
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        (product.reference && product.reference.toLowerCase().includes(query.toLowerCase())) ||
        (product.barCode && product.barCode.toLowerCase().includes(query.toLowerCase()))
      )
    );

    // Cache the results
    SearchCacheManager.cacheSearch(companyId, query, finalResults);

    return finalResults;
  } catch (error) {
    logError('Error searching products in Firebase', error);
    return [];
  }
};

/**
 * Local search function for instant results
 */
export const localProductSearch = (query: string, products: Product[]): Product[] => {
  if (!query.trim()) return products;

  const searchTerm = query.toLowerCase();
  return products.filter(product =>
    product.name.toLowerCase().includes(searchTerm) ||
    (product.reference && product.reference.toLowerCase().includes(searchTerm)) ||
    (product.barCode && product.barCode.toLowerCase().includes(searchTerm))
  );
};

/**
 * Clear search cache for a company
 */
export const clearSearchCache = (companyId: string): void => {
  SearchCacheManager.clearCompanyCache(companyId);
};

const SearchService = {
  searchProductsInFirebase,
  localProductSearch,
  createSearchIndex,
  clearSearchCache
};

export default SearchService;
