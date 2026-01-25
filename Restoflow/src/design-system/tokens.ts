/**
 * Design tokens and CSS variables system
 */

export interface DesignTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  shadows: ShadowTokens;
  borders: BorderTokens;
  animations: AnimationTokens;
  breakpoints: BreakpointTokens;
}

export interface ColorTokens {
  // Primary colors
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryLight: string;
  primaryDark: string;
  
  // Secondary colors
  secondary: string;
  secondaryHover: string;
  secondaryActive: string;
  secondaryLight: string;
  secondaryDark: string;
  
  // Neutral colors
  background: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  
  // Status colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;
  
  // Border colors
  border: string;
  borderLight: string;
  borderDark: string;
  
  // Overlay colors
  overlay: string;
  overlayLight: string;
  overlayDark: string;
}

export interface TypographyTokens {
  fontFamily: {
    primary: string;
    secondary: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    extrabold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
  };
}

export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
  '5xl': string;
  '6xl': string;
}

export interface ShadowTokens {
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  inner: string;
  none: string;
}

export interface BorderTokens {
  radius: {
    none: string;
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };
  width: {
    none: string;
    thin: string;
    base: string;
    thick: string;
  };
}

export interface AnimationTokens {
  duration: {
    fast: string;
    base: string;
    slow: string;
  };
  easing: {
    linear: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
  };
}

export interface BreakpointTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

// Default design tokens
export const defaultTokens: DesignTokens = {
  colors: {
    // Primary colors
    primary: '#3B82F6',
    primaryHover: '#2563EB',
    primaryActive: '#1D4ED8',
    primaryLight: '#DBEAFE',
    primaryDark: '#1E40AF',
    
    // Secondary colors
    secondary: '#6B7280',
    secondaryHover: '#4B5563',
    secondaryActive: '#374151',
    secondaryLight: '#F3F4F6',
    secondaryDark: '#1F2937',
    
    // Neutral colors
    background: '#FFFFFF',
    surface: '#F9FAFB',
    surfaceHover: '#F3F4F6',
    surfaceActive: '#E5E7EB',
    
    // Text colors
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // Status colors
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
    
    // Border colors
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderDark: '#D1D5DB',
    
    // Overlay colors
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.25)',
    overlayDark: 'rgba(0, 0, 0, 0.75)',
  },
  
  typography: {
    fontFamily: {
      primary: 'Inter, system-ui, -apple-system, sans-serif',
      secondary: 'Poppins, system-ui, -apple-system, sans-serif',
      mono: 'JetBrains Mono, Consolas, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
    },
  },
  
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
    '4xl': '6rem',
    '5xl': '8rem',
    '6xl': '12rem',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
  },
  
  borders: {
    radius: {
      none: '0',
      sm: '0.125rem',
      base: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
      '2xl': '1rem',
      full: '9999px',
    },
    width: {
      none: '0',
      thin: '1px',
      base: '2px',
      thick: '4px',
    },
  },
  
  animations: {
    duration: {
      fast: '150ms',
      base: '300ms',
      slow: '500ms',
    },
    easing: {
      linear: 'linear',
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

// CSS variable names
export const cssVariableNames = {
  colors: {
    primary: '--color-primary',
    primaryHover: '--color-primary-hover',
    primaryActive: '--color-primary-active',
    primaryLight: '--color-primary-light',
    primaryDark: '--color-primary-dark',
    secondary: '--color-secondary',
    secondaryHover: '--color-secondary-hover',
    secondaryActive: '--color-secondary-active',
    secondaryLight: '--color-secondary-light',
    secondaryDark: '--color-secondary-dark',
    background: '--color-background',
    surface: '--color-surface',
    surfaceHover: '--color-surface-hover',
    surfaceActive: '--color-surface-active',
    textPrimary: '--color-text-primary',
    textSecondary: '--color-text-secondary',
    textTertiary: '--color-text-tertiary',
    textInverse: '--color-text-inverse',
    success: '--color-success',
    successLight: '--color-success-light',
    warning: '--color-warning',
    warningLight: '--color-warning-light',
    error: '--color-error',
    errorLight: '--color-error-light',
    info: '--color-info',
    infoLight: '--color-info-light',
    border: '--color-border',
    borderLight: '--color-border-light',
    borderDark: '--color-border-dark',
    overlay: '--color-overlay',
    overlayLight: '--color-overlay-light',
    overlayDark: '--color-overlay-dark',
  },
  typography: {
    fontFamilyPrimary: '--font-family-primary',
    fontFamilySecondary: '--font-family-secondary',
    fontFamilyMono: '--font-family-mono',
    fontSizeXs: '--font-size-xs',
    fontSizeSm: '--font-size-sm',
    fontSizeBase: '--font-size-base',
    fontSizeLg: '--font-size-lg',
    fontSizeXl: '--font-size-xl',
    fontSize2xl: '--font-size-2xl',
    fontSize3xl: '--font-size-3xl',
    fontSize4xl: '--font-size-4xl',
    fontSize5xl: '--font-size-5xl',
    fontSize6xl: '--font-size-6xl',
    fontWeightLight: '--font-weight-light',
    fontWeightNormal: '--font-weight-normal',
    fontWeightMedium: '--font-weight-medium',
    fontWeightSemibold: '--font-weight-semibold',
    fontWeightBold: '--font-weight-bold',
    fontWeightExtrabold: '--font-weight-extrabold',
    lineHeightTight: '--line-height-tight',
    lineHeightNormal: '--line-height-normal',
    lineHeightRelaxed: '--line-height-relaxed',
    lineHeightLoose: '--line-height-loose',
    letterSpacingTight: '--letter-spacing-tight',
    letterSpacingNormal: '--letter-spacing-normal',
    letterSpacingWide: '--letter-spacing-wide',
  },
  spacing: {
    xs: '--spacing-xs',
    sm: '--spacing-sm',
    md: '--spacing-md',
    lg: '--spacing-lg',
    xl: '--spacing-xl',
    '2xl': '--spacing-2xl',
    '3xl': '--spacing-3xl',
    '4xl': '--spacing-4xl',
    '5xl': '--spacing-5xl',
    '6xl': '--spacing-6xl',
  },
  shadows: {
    sm: '--shadow-sm',
    base: '--shadow-base',
    md: '--shadow-md',
    lg: '--shadow-lg',
    xl: '--shadow-xl',
    '2xl': '--shadow-2xl',
    inner: '--shadow-inner',
    none: '--shadow-none',
  },
  borders: {
    radiusNone: '--border-radius-none',
    radiusSm: '--border-radius-sm',
    radiusBase: '--border-radius-base',
    radiusMd: '--border-radius-md',
    radiusLg: '--border-radius-lg',
    radiusXl: '--border-radius-xl',
    radius2xl: '--border-radius-2xl',
    radiusFull: '--border-radius-full',
    widthNone: '--border-width-none',
    widthThin: '--border-width-thin',
    widthBase: '--border-width-base',
    widthThick: '--border-width-thick',
  },
  animations: {
    durationFast: '--animation-duration-fast',
    durationBase: '--animation-duration-base',
    durationSlow: '--animation-duration-slow',
    easingLinear: '--animation-easing-linear',
    easingEase: '--animation-easing-ease',
    easingEaseIn: '--animation-easing-ease-in',
    easingEaseOut: '--animation-easing-ease-out',
    easingEaseInOut: '--animation-easing-ease-in-out',
  },
  breakpoints: {
    sm: '--breakpoint-sm',
    md: '--breakpoint-md',
    lg: '--breakpoint-lg',
    xl: '--breakpoint-xl',
    '2xl': '--breakpoint-2xl',
  },
};

// Utility function to generate CSS variables
export function generateCSSVariables(tokens: DesignTokens): string {
  const variables: string[] = [];
  
  // Colors
  Object.entries(tokens.colors).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.colors[key as keyof typeof cssVariableNames.colors]}: ${value};`);
  });
  
  // Typography
  Object.entries(tokens.typography.fontFamily).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.typography[`fontFamily${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.typography]}: ${value};`);
  });
  
  Object.entries(tokens.typography.fontSize).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.typography[`fontSize${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.typography]}: ${value};`);
  });
  
  Object.entries(tokens.typography.fontWeight).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.typography[`fontWeight${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.typography]}: ${value};`);
  });
  
  Object.entries(tokens.typography.lineHeight).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.typography[`lineHeight${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.typography]}: ${value};`);
  });
  
  Object.entries(tokens.typography.letterSpacing).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.typography[`letterSpacing${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.typography]}: ${value};`);
  });
  
  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.spacing[key as keyof typeof cssVariableNames.spacing]}: ${value};`);
  });
  
  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.shadows[key as keyof typeof cssVariableNames.shadows]}: ${value};`);
  });
  
  // Borders
  Object.entries(tokens.borders.radius).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.borders[`radius${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.borders]}: ${value};`);
  });
  
  Object.entries(tokens.borders.width).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.borders[`width${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.borders]}: ${value};`);
  });
  
  // Animations
  Object.entries(tokens.animations.duration).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.animations[`duration${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.animations]}: ${value};`);
  });
  
  Object.entries(tokens.animations.easing).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.animations[`easing${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof cssVariableNames.animations]}: ${value};`);
  });
  
  // Breakpoints
  Object.entries(tokens.breakpoints).forEach(([key, value]) => {
    variables.push(`${cssVariableNames.breakpoints[key as keyof typeof cssVariableNames.breakpoints]}: ${value};`);
  });
  
  return `:root {\n  ${variables.join('\n  ')}\n}`;
}

