import { useAuth } from '@contexts/AuthContext';

export interface CompanyColors {
  primary: string;
  secondary: string;
  tertiary: string;
  headerText?: string;
}

/**
 * Hook to get company colors with fallbacks
 * Prioritizes dashboard colors over company colors
 */
export const useCompanyColors = (): CompanyColors => {
  const { company } = useAuth();
  
  return {
    primary: company?.dashboardColors?.primary || company?.primaryColor || '#183524',
    secondary: company?.dashboardColors?.secondary || company?.secondaryColor || '#e2b069',
    tertiary: company?.dashboardColors?.tertiary || company?.tertiaryColor || '#2a4a3a',
    headerText: company?.dashboardColors?.headerText || '#ffffff'
  };
};

