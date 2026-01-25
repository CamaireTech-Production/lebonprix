/**
 * Restaurant data validation utilities
 */

import { Restaurant } from '../../types';
import { validateEmail } from './emailValidator';
import { validatePhone } from './phoneValidator';

export interface RestaurantValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate restaurant data
 */
export function validateRestaurant(restaurant: Partial<Restaurant>): RestaurantValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!restaurant.name || restaurant.name.trim().length === 0) {
    errors.push('Restaurant name is required');
  } else if (restaurant.name.trim().length < 2) {
    errors.push('Restaurant name must be at least 2 characters long');
  } else if (restaurant.name.trim().length > 100) {
    errors.push('Restaurant name must be less than 100 characters');
  }
  
  if (!restaurant.email || restaurant.email.trim().length === 0) {
    errors.push('Email is required');
  } else {
    const emailResult = validateEmail(restaurant.email);
    if (!emailResult.isValid) {
      errors.push(...emailResult.errors);
    }
  }
  
  // Optional but validated fields
  if (restaurant.phone) {
    const phoneResult = validatePhone(restaurant.phone);
    if (!phoneResult.isValid) {
      errors.push(...phoneResult.errors);
    }
  }
  
  if (restaurant.address) {
    if (restaurant.address.length > 500) {
      errors.push('Address must be less than 500 characters');
    }
  }
  
  if (restaurant.description) {
    if (restaurant.description.length > 1000) {
      warnings.push('Description is quite long, consider shortening it');
    }
  }
  
  // Business hours validation
  if (restaurant.businessHours) {
    const hours = restaurant.businessHours;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      if (hours[day]) {
        const dayHours = hours[day];
        if (dayHours.open && dayHours.close) {
          if (dayHours.open >= dayHours.close) {
            errors.push(`${day} opening time must be before closing time`);
          }
        }
      }
    }
  }
  
  // Settings validation
  if (restaurant.settings) {
    const settings = restaurant.settings;
    
    if (settings.currency && !isValidCurrency(settings.currency)) {
      errors.push('Invalid currency code');
    }
    
    if (settings.language && !isValidLanguage(settings.language)) {
      errors.push('Invalid language code');
    }
    
    if (settings.timezone && !isValidTimezone(settings.timezone)) {
      errors.push('Invalid timezone');
    }
  }
  
  // Customization validation
  if (restaurant.customization) {
    const customization = restaurant.customization;
    
    if (customization.primaryColor && !isValidColor(customization.primaryColor)) {
      errors.push('Invalid primary color format');
    }
    
    if (customization.secondaryColor && !isValidColor(customization.secondaryColor)) {
      errors.push('Invalid secondary color format');
    }
    
    if (customization.fontFamily && !isValidFontFamily(customization.fontFamily)) {
      warnings.push('Font family may not be supported on all devices');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate restaurant name
 */
export function validateRestaurantName(name: string): RestaurantValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!name || name.trim().length === 0) {
    errors.push('Restaurant name is required');
  } else if (name.trim().length < 2) {
    errors.push('Restaurant name must be at least 2 characters long');
  } else if (name.trim().length > 100) {
    errors.push('Restaurant name must be less than 100 characters');
  } else if (name.trim().length < 5) {
    warnings.push('Consider using a more descriptive restaurant name');
  }
  
  // Check for inappropriate content
  const inappropriateWords = ['test', 'demo', 'sample', 'example'];
  if (inappropriateWords.some(word => name.toLowerCase().includes(word))) {
    warnings.push('Consider using a more professional restaurant name');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate restaurant settings
 */
export function validateRestaurantSettings(settings: any): RestaurantValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (settings.currency && !isValidCurrency(settings.currency)) {
    errors.push('Invalid currency code');
  }
  
  if (settings.language && !isValidLanguage(settings.language)) {
    errors.push('Invalid language code');
  }
  
  if (settings.timezone && !isValidTimezone(settings.timezone)) {
    errors.push('Invalid timezone');
  }
  
  if (settings.maxOrderValue && (settings.maxOrderValue < 0 || settings.maxOrderValue > 10000)) {
    warnings.push('Maximum order value seems unusually high or low');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper functions
function isValidCurrency(currency: string): boolean {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'XAF', 'XOF'];
  return validCurrencies.includes(currency.toUpperCase());
}

function isValidLanguage(language: string): boolean {
  const validLanguages = ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar'];
  return validLanguages.includes(language.toLowerCase());
}

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function isValidColor(color: string): boolean {
  // Check if it's a valid hex color
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

function isValidFontFamily(fontFamily: string): boolean {
  const validFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Tahoma',
    'Courier New', 'Monaco', 'Lucida Console', 'Trebuchet MS', 'Comic Sans MS',
    'Impact', 'Arial Black', 'Palatino', 'Garamond', 'Bookman', 'Avant Garde'
  ];
  
  return validFonts.some(font => 
    fontFamily.toLowerCase().includes(font.toLowerCase())
  );
}

