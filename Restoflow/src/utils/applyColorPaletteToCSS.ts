import { ColorPalette } from './generateColorPalette';

/**
 * Applies a color palette as CSS variables to the :root element.
 * Each color is set as --color-[key].
 */
export function applyColorPaletteToCSSVariables(palette: ColorPalette) {
  const root = document.documentElement;
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
}

/**
 * Optionally, remove all color palette CSS variables from :root.
 */
export function clearColorPaletteCSSVariables() {
  const root = document.documentElement;
  const keys = [
    'primary', 'primaryLight', 'primaryDark',
    'secondary', 'secondaryLight', 'secondaryDark',
    'accent', 'background', 'sidebarBackground',
    'text', 'success', 'white', 'black',
  ];
  keys.forEach(key => {
    root.style.removeProperty(`--color-${key}`);
  });
}
