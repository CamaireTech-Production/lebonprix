import chroma from 'chroma-js';

export interface ColorPalette {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  accent: string;
  background: string;
  sidebarBackground: string;
  text: string;
  success: string;
  white: string;
  black: string;
}

/**
 * Generates a color palette based on primary and secondary colors.
 * Always includes black and white.
 */
export function generateColorPalette(primary: string, secondary: string): ColorPalette {
  // Generate tints and shades
  const primaryLight = chroma(primary).brighten(1).hex();
  const primaryDark = chroma(primary).darken(1.5).hex();
  const secondaryLight = chroma(secondary).brighten(1).hex();
  const secondaryDark = chroma(secondary).darken(1.5).hex();

  // Accent: mix of primary and secondary
  const accent = chroma.mix(primary, secondary, 0.5, 'lab').saturate(1).hex();

  // Background: very light version of secondary
  const background = chroma(secondary).brighten(2.5).hex();
  // Sidebar: slightly darkened secondary
  const sidebarBackground = chroma(secondary).darken(0.5).hex();

  // Text: choose black or white for best contrast with background
  const text = chroma.contrast(background, 'white') > 4.5 ? '#FFFFFF' : '#111111';

  // Success: green, but slightly tinted with primary
  const success = chroma.mix('#4CAF50', primary, 0.2, 'lab').hex();

  return {
    primary,
    primaryLight,
    primaryDark,
    secondary,
    secondaryLight,
    secondaryDark,
    accent,
    background,
    sidebarBackground,
    text,
    success,
    white: '#FFFFFF',
    black: '#000000',
  };
}
