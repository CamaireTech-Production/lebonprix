/**
 * Theme system with CSS variables
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { defaultTokens, generateCSSVariables, DesignTokens } from './tokens';

export interface Theme {
  name: string;
  tokens: DesignTokens;
  isDark: boolean;
}

export interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Predefined themes
export const themes: Record<string, Theme> = {
  light: {
    name: 'Light',
    isDark: false,
    tokens: defaultTokens,
  },
  dark: {
    name: 'Dark',
    isDark: true,
    tokens: {
      ...defaultTokens,
      colors: {
        ...defaultTokens.colors,
        background: '#0F172A',
        surface: '#1E293B',
        surfaceHover: '#334155',
        surfaceActive: '#475569',
        textPrimary: '#F8FAFC',
        textSecondary: '#CBD5E1',
        textTertiary: '#94A3B8',
        textInverse: '#0F172A',
        border: '#334155',
        borderLight: '#475569',
        borderDark: '#1E293B',
      },
    },
  },
  restaurant: {
    name: 'Restaurant',
    isDark: false,
    tokens: {
      ...defaultTokens,
      colors: {
        ...defaultTokens.colors,
        primary: '#DC2626',
        primaryHover: '#B91C1C',
        primaryActive: '#991B1B',
        primaryLight: '#FEE2E2',
        primaryDark: '#7F1D1D',
        secondary: '#059669',
        secondaryHover: '#047857',
        secondaryActive: '#065F46',
        secondaryLight: '#D1FAE5',
        secondaryDark: '#064E3B',
      },
    },
  },
  elegant: {
    name: 'Elegant',
    isDark: false,
    tokens: {
      ...defaultTokens,
      colors: {
        ...defaultTokens.colors,
        primary: '#7C3AED',
        primaryHover: '#6D28D9',
        primaryActive: '#5B21B6',
        primaryLight: '#EDE9FE',
        primaryDark: '#4C1D95',
        secondary: '#6B7280',
        secondaryHover: '#4B5563',
        secondaryActive: '#374151',
        secondaryLight: '#F3F4F6',
        secondaryDark: '#1F2937',
      },
    },
  },
};

// Theme provider component
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  storageKey = 'restaurant-theme'
}) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return themes[parsed.name] || themes[defaultTheme];
        } catch {
          return themes[defaultTheme];
        }
      }
    }
    return themes[defaultTheme];
  });

  // Apply theme to document
  useEffect(() => {
    const cssVariables = generateCSSVariables(currentTheme.tokens);
    
    // Create or update style element
    let styleElement = document.getElementById('theme-variables');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'theme-variables';
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = cssVariables;
    
    // Apply dark mode class to document
    if (currentTheme.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify({
        name: currentTheme.name,
        isDark: currentTheme.isDark
      }));
    }
  }, [currentTheme, storageKey]);

  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
  };

  const toggleDarkMode = () => {
    const newTheme = currentTheme.isDark ? themes.light : themes.dark;
    setCurrentTheme(newTheme);
  };

  const contextValue: ThemeContextType = {
    currentTheme,
    setTheme,
    toggleDarkMode,
    isDark: currentTheme.isDark,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme selector component
export interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className }) => {
  const { currentTheme, setTheme, toggleDarkMode } = useTheme();

  return (
    <div className={`theme-selector ${className}`}>
      <div className="flex items-center space-x-4">
        <button
          onClick={toggleDarkMode}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {currentTheme.isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
        
        <select
          value={currentTheme.name}
          onChange={(e) => {
            const theme = themes[e.target.value];
            if (theme) setTheme(theme);
          }}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {Object.entries(themes).map(([key, theme]) => (
            <option key={key} value={key}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Custom theme creator
export interface CustomThemeCreatorProps {
  onThemeCreate: (theme: Theme) => void;
  className?: string;
}

export const CustomThemeCreator: React.FC<CustomThemeCreatorProps> = ({
  onThemeCreate,
  className
}) => {
  const [themeName, setThemeName] = useState('');
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  const handleCreateTheme = () => {
    if (!themeName.trim()) return;

    const customTheme: Theme = {
      name: themeName,
      isDark: false,
      tokens: {
        ...defaultTokens,
        colors: {
          ...defaultTokens.colors,
          ...customColors,
        },
      },
    };

    onThemeCreate(customTheme);
    setThemeName('');
    setCustomColors({});
  };

  return (
    <div className={`custom-theme-creator ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Create Custom Theme</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Theme Name
          </label>
          <input
            type="text"
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter theme name"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(defaultTokens.colors).map(([key, value]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </label>
              <input
                type="color"
                value={customColors[key] || value}
                onChange={(e) => setCustomColors(prev => ({
                  ...prev,
                  [key]: e.target.value
                }))}
                className="w-full h-10 border border-gray-300 rounded-md"
              />
            </div>
          ))}
        </div>
        
        <button
          onClick={handleCreateTheme}
          disabled={!themeName.trim()}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Theme
        </button>
      </div>
    </div>
  );
};

// Theme preview component
export interface ThemePreviewProps {
  theme: Theme;
  className?: string;
}

export const ThemePreview: React.FC<ThemePreviewProps> = ({
  theme,
  className
}) => {
  return (
    <div className={`theme-preview ${className}`}>
      <div className="p-4 border rounded-lg" style={{ backgroundColor: theme.tokens.colors.background }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: theme.tokens.colors.textPrimary }}>
          {theme.name}
        </h3>
        <p className="text-sm mb-4" style={{ color: theme.tokens.colors.textSecondary }}>
          {theme.isDark ? 'Dark theme' : 'Light theme'}
        </p>
        
        <div className="space-y-2">
          <div
            className="p-2 rounded"
            style={{
              backgroundColor: theme.tokens.colors.primary,
              color: theme.tokens.colors.textInverse
            }}
          >
            Primary Button
          </div>
          <div
            className="p-2 rounded border"
            style={{
              backgroundColor: theme.tokens.colors.surface,
              color: theme.tokens.colors.textPrimary,
              borderColor: theme.tokens.colors.border
            }}
          >
            Surface Card
          </div>
        </div>
      </div>
    </div>
  );
};

