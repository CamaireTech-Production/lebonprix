export interface PresetThemeColors {
  primary: string;
  secondary: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  logoColor: string;
  iconColor: string;
  cardBackground: string;
  cardBorder: string;
  searchBackground: string;
  searchText: string;
  searchBorder: string;
  categoryHeaderBackground: string;
  categoryHeaderText: string;
  categoryHeaderBorder: string;
  restaurantNameColor: string;
  transitionButtonColor: string;
  transitionButtonBackground: string;
  bodyLinesColor: string;
  separatorColor: string;
}

export const PRESET_THEMES: Record<string, PresetThemeColors> = {
  warm: {
    primary: '#F97316', // Orange-500
    secondary: '#F59E0B', // Amber-500
    background: '#FFFBEB', // Amber-50
    textPrimary: '#92400E', // Amber-800
    textSecondary: '#B45309', // Amber-700
    logoColor: '#F97316',
    iconColor: '#B45309',
    cardBackground: '#FFFFFF',
    cardBorder: '#FED7AA', // Orange-200
    searchBackground: '#FEF3C7', // Amber-100
    searchText: '#92400E',
    searchBorder: '#FCD34D', // Amber-300
    categoryHeaderBackground: '#FEF3C7',
    categoryHeaderText: '#92400E',
    categoryHeaderBorder: '#FCD34D',
    restaurantNameColor: '#92400E',
    transitionButtonColor: '#FFFFFF',
    transitionButtonBackground: '#F97316',
    bodyLinesColor: '#FED7AA',
    separatorColor: '#FCD34D'
  },
  cool: {
    primary: '#3B82F6', // Blue-500
    secondary: '#06B6D4', // Cyan-500
    background: '#EFF6FF', // Blue-50
    textPrimary: '#1E40AF', // Blue-800
    textSecondary: '#1D4ED8', // Blue-700
    logoColor: '#3B82F6',
    iconColor: '#1D4ED8',
    cardBackground: '#FFFFFF',
    cardBorder: '#93C5FD', // Blue-300
    searchBackground: '#DBEAFE', // Blue-100
    searchText: '#1E40AF',
    searchBorder: '#60A5FA', // Blue-400
    categoryHeaderBackground: '#DBEAFE',
    categoryHeaderText: '#1E40AF',
    categoryHeaderBorder: '#60A5FA',
    restaurantNameColor: '#1E40AF',
    transitionButtonColor: '#FFFFFF',
    transitionButtonBackground: '#3B82F6',
    bodyLinesColor: '#93C5FD',
    separatorColor: '#60A5FA'
  },
  elegant: {
    primary: '#8B5CF6', // Violet-500
    secondary: '#EC4899', // Pink-500
    background: '#FAF5FF', // Violet-50
    textPrimary: '#6B21A8', // Violet-800
    textSecondary: '#7C3AED', // Violet-700
    logoColor: '#8B5CF6',
    iconColor: '#7C3AED',
    cardBackground: '#FFFFFF',
    cardBorder: '#C4B5FD', // Violet-300
    searchBackground: '#EDE9FE', // Violet-100
    searchText: '#6B21A8',
    searchBorder: '#A78BFA', // Violet-400
    categoryHeaderBackground: '#EDE9FE',
    categoryHeaderText: '#6B21A8',
    categoryHeaderBorder: '#A78BFA',
    restaurantNameColor: '#6B21A8',
    transitionButtonColor: '#FFFFFF',
    transitionButtonBackground: '#8B5CF6',
    bodyLinesColor: '#C4B5FD',
    separatorColor: '#A78BFA'
  },
  nature: {
    primary: '#10B981', // Emerald-500
    secondary: '#059669', // Emerald-600
    background: '#ECFDF5', // Emerald-50
    textPrimary: '#064E3B', // Emerald-900
    textSecondary: '#065F46', // Emerald-800
    logoColor: '#10B981',
    iconColor: '#065F46',
    cardBackground: '#FFFFFF',
    cardBorder: '#6EE7B7', // Emerald-300
    searchBackground: '#D1FAE5', // Emerald-100
    searchText: '#064E3B',
    searchBorder: '#34D399', // Emerald-400
    categoryHeaderBackground: '#D1FAE5',
    categoryHeaderText: '#064E3B',
    categoryHeaderBorder: '#34D399',
    restaurantNameColor: '#064E3B',
    transitionButtonColor: '#FFFFFF',
    transitionButtonBackground: '#10B981',
    bodyLinesColor: '#6EE7B7',
    separatorColor: '#34D399'
  },
  monochrome: {
    primary: '#6B7280', // Gray-500
    secondary: '#9CA3AF', // Gray-400
    background: '#F9FAFB', // Gray-50
    textPrimary: '#111827', // Gray-900
    textSecondary: '#374151', // Gray-700
    logoColor: '#6B7280',
    iconColor: '#374151',
    cardBackground: '#FFFFFF',
    cardBorder: '#D1D5DB', // Gray-300
    searchBackground: '#F3F4F6', // Gray-100
    searchText: '#111827',
    searchBorder: '#9CA3AF',
    categoryHeaderBackground: '#F3F4F6',
    categoryHeaderText: '#111827',
    categoryHeaderBorder: '#9CA3AF',
    restaurantNameColor: '#111827',
    transitionButtonColor: '#FFFFFF',
    transitionButtonBackground: '#6B7280',
    bodyLinesColor: '#D1D5DB',
    separatorColor: '#9CA3AF'
  },
  vibrant: {
    primary: '#EF4444', // Red-500
    secondary: '#F59E0B', // Amber-500
    background: '#FEF2F2', // Red-50
    textPrimary: '#991B1B', // Red-800
    textSecondary: '#B91C1C', // Red-700
    logoColor: '#EF4444',
    iconColor: '#B91C1C',
    cardBackground: '#FFFFFF',
    cardBorder: '#FCA5A5', // Red-300
    searchBackground: '#FEE2E2', // Red-100
    searchText: '#991B1B',
    searchBorder: '#F87171', // Red-400
    categoryHeaderBackground: '#FEE2E2',
    categoryHeaderText: '#991B1B',
    categoryHeaderBorder: '#F87171',
    restaurantNameColor: '#991B1B',
    transitionButtonColor: '#FFFFFF',
    transitionButtonBackground: '#EF4444',
    bodyLinesColor: '#FCA5A5',
    separatorColor: '#F87171'
  }
};

export const getPresetThemeColors = (themeName: string): PresetThemeColors | null => {
  return PRESET_THEMES[themeName] || null;
};

export const applyPresetTheme = (themeName: string) => {
  const colors = getPresetThemeColors(themeName);
  if (!colors) return null;
  
  // Get theme-specific style settings
  const styleSettings = getPresetThemeStyles(themeName);
  
  return {
    customColors: colors,
    ...styleSettings
  };
};

export const getPresetThemeStyles = (themeName: string) => {
  const themeStyles: Record<string, any> = {
    warm: {
      typography: 'elegant',
      cardStyle: 'rounded',
      borderRadius: 'large',
      shadowIntensity: 'light',
      animationEffects: 'fade',
      hoverEffects: 'lift',
      categoryHeaderButtonShape: 'rounded',
      categoryTitlePosition: 'center',
      categoryTitleFontFamily: 'serif',
      categoryTitleFontSize: 'large',
      categoryTitleFontWeight: 'semibold'
    },
    cool: {
      typography: 'modern',
      cardStyle: 'elevated',
      borderRadius: 'medium',
      shadowIntensity: 'medium',
      animationEffects: 'slide',
      hoverEffects: 'glow',
      categoryHeaderButtonShape: 'square',
      categoryTitlePosition: 'left',
      categoryTitleFontFamily: 'sans-serif',
      categoryTitleFontSize: 'medium',
      categoryTitleFontWeight: 'bold'
    },
    elegant: {
      typography: 'elegant',
      cardStyle: 'glass',
      borderRadius: 'large',
      shadowIntensity: 'light',
      animationEffects: 'fade',
      hoverEffects: 'subtle',
      categoryHeaderButtonShape: 'pill',
      categoryTitlePosition: 'center',
      categoryTitleFontFamily: 'serif',
      categoryTitleFontSize: 'large',
      categoryTitleFontWeight: 'medium'
    },
    nature: {
      typography: 'classic',
      cardStyle: 'rounded',
      borderRadius: 'medium',
      shadowIntensity: 'light',
      animationEffects: 'fade',
      hoverEffects: 'lift',
      categoryHeaderButtonShape: 'rounded',
      categoryTitlePosition: 'left',
      categoryTitleFontFamily: 'sans-serif',
      categoryTitleFontSize: 'medium',
      categoryTitleFontWeight: 'semibold'
    },
    monochrome: {
      typography: 'minimal',
      cardStyle: 'minimal',
      borderRadius: 'small',
      shadowIntensity: 'none',
      animationEffects: 'none',
      hoverEffects: 'subtle',
      categoryHeaderButtonShape: 'square',
      categoryTitlePosition: 'left',
      categoryTitleFontFamily: 'sans-serif',
      categoryTitleFontSize: 'small',
      categoryTitleFontWeight: 'normal'
    },
    vibrant: {
      typography: 'bold',
      cardStyle: 'elevated',
      borderRadius: 'large',
      shadowIntensity: 'heavy',
      animationEffects: 'bounce',
      hoverEffects: 'scale',
      categoryHeaderButtonShape: 'circle',
      categoryTitlePosition: 'center',
      categoryTitleFontFamily: 'fantasy',
      categoryTitleFontSize: 'extra-large',
      categoryTitleFontWeight: 'extrabold'
    }
  };
  
  return themeStyles[themeName] || {};
};

export const getPresetThemePreview = (themeName: string) => {
  const colors = getPresetThemeColors(themeName);
  const styles = getPresetThemeStyles(themeName);
  
  return {
    name: themeName,
    colors,
    styles,
    description: getPresetThemeDescription(themeName)
  };
};

export const getPresetThemeDescription = (themeName: string) => {
  const descriptions: Record<string, string> = {
    warm: 'Cozy and inviting with warm orange and amber tones',
    cool: 'Professional and modern with blue and cyan accents',
    elegant: 'Sophisticated with purple and pink gradients',
    nature: 'Fresh and organic with green and emerald colors',
    monochrome: 'Clean and minimal with grayscale palette',
    vibrant: 'Bold and energetic with red and yellow highlights'
  };
  
  return descriptions[themeName] || 'Custom theme';
};
