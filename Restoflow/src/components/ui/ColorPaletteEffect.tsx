import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { generateColorPalette } from '../../utils/generateColorPalette';
import { applyColorPaletteToCSSVariables } from '../../utils/applyColorPaletteToCSS';
import designSystem from '../../designSystem';

/**
 * Applies the restaurant's color palette globally, except on login/register pages.
 */
const ColorPaletteEffect = () => {
  const { restaurant } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Only apply palette if not on login/register
    const isAuthPage =
      location.pathname.startsWith('/login') ||
      location.pathname.startsWith('/newResturant') ||
      location.pathname.startsWith('/register');
    if (isAuthPage) return;

    const primary = restaurant?.colorPalette?.primary || designSystem.colors.primary;
    const secondary = restaurant?.colorPalette?.secondary || designSystem.colors.secondary;
    const palette = generateColorPalette(primary, secondary);
    applyColorPaletteToCSSVariables(palette);
  }, [restaurant, location]);

  return null;
};

export default ColorPaletteEffect;
