import { verifyUserCompany, verifyUserOwnerCompanies } from './companyVerificationService';

export type NavigationMode = 'employee' | 'company';

export interface NavigationResult {
  success: boolean;
  redirectPath: string;
  mode: NavigationMode;
  error?: string;
}

/**
 * Service de navigation entre les modes employé et company
 */
export class NavigationService {
  /**
   * Détermine où rediriger après connexion selon le choix de mode
   */
  static async redirectAfterLogin(
    userId: string, 
    mode: NavigationMode
  ): Promise<NavigationResult> {
    try {
      if (mode === 'employee') {
        return {
          success: true,
          redirectPath: '/employee/dashboard',
          mode: 'employee'
        };
      }

      if (mode === 'company') {
        return await this.handleCompanyMode(userId);
      }

      return {
        success: false,
        redirectPath: '/',
        mode: 'employee',
        error: 'Mode de navigation invalide'
      };
    } catch (error) {
      console.error('Erreur lors de la redirection après connexion:', error);
      return {
        success: false,
        redirectPath: '/',
        mode: 'employee',
        error: 'Erreur lors de la navigation'
      };
    }
  }

  /**
   * Vérifie et redirige vers company ou création
   */
  static async handleCompanyMode(userId: string): Promise<NavigationResult> {
    try {
      // ✅ Utiliser la nouvelle fonction qui vérifie explicitement le rôle "owner"
      const verification = await verifyUserOwnerCompanies(userId);

      if (verification.hasCompany && verification.companyId) {
        console.log('✅ Company avec rôle owner trouvée, redirection vers dashboard');
        return {
          success: true,
          redirectPath: `/company/${verification.companyId}/dashboard`,
          mode: 'company'
        };
      }

      console.log('❌ Aucune company avec rôle owner trouvée, redirection vers création');
      return {
        success: true,
        redirectPath: '/company/create',
        mode: 'company'
      };
    } catch (error) {
      console.error('❌ Erreur lors de la vérification company:', error);
      return {
        success: false,
        redirectPath: '/',
        mode: 'employee',
        error: 'Erreur lors de la vérification des companies'
      };
    }
  }

  /**
   * Bascule entre mode employé et company
   */
  static async switchMode(
    userId: string, 
    mode: NavigationMode
  ): Promise<NavigationResult> {
    try {
      if (mode === 'employee') {
        return {
          success: true,
          redirectPath: '/employee/dashboard',
          mode: 'employee'
        };
      }

      if (mode === 'company') {
        return await this.handleCompanyMode(userId);
      }

      return {
        success: false,
        redirectPath: '/',
        mode: 'employee',
        error: 'Mode de navigation invalide'
      };
    } catch (error) {
      console.error('Erreur lors du changement de mode:', error);
      return {
        success: false,
        redirectPath: '/',
        mode: 'employee',
        error: 'Erreur lors du changement de mode'
      };
    }
  }

  /**
   * Vérifie les permissions pour une route
   */
  static async canAccessRoute(
    userId: string, 
    companyId: string, 
    route: string
  ): Promise<{
    canAccess: boolean;
    reason?: string;
  }> {
    try {
      // Import dynamique pour éviter les dépendances circulaires
      const { checkUserPermissions } = await import('./companyVerificationService');
      
      const result = await checkUserPermissions(userId, companyId, route);
      
      return {
        canAccess: result.canAccess,
        reason: result.reason
      };
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      return {
        canAccess: false,
        reason: 'Erreur lors de la vérification des permissions'
      };
    }
  }

  /**
   * Obtient la route appropriée selon le mode et les permissions
   */
  static getAppropriateRoute(
    mode: NavigationMode,
    userId?: string,
    companyId?: string
  ): string {
    switch (mode) {
      case 'employee':
        return '/employee/dashboard';
      
      case 'company':
        if (companyId) {
          return `/company/${companyId}/dashboard`;
        }
        return '/company/create';
      
      default:
        return '/';
    }
  }

  /**
   * Vérifie si un utilisateur peut accéder à une company spécifique
   */
  static async canAccessCompany(
    userId: string, 
    companyId: string
  ): Promise<{
    canAccess: boolean;
    role?: string;
    reason?: string;
  }> {
    try {
      const { verifyUserEmployeeStatus } = await import('./companyVerificationService');
      
      const result = await verifyUserEmployeeStatus(userId, companyId);
      
      return {
        canAccess: result.isEmployee,
        role: result.role,
        reason: result.isEmployee ? undefined : 'Vous n\'êtes pas employé de cette entreprise'
      };
    } catch (error) {
      console.error('Erreur lors de la vérification d\'accès company:', error);
      return {
        canAccess: false,
        reason: 'Erreur lors de la vérification d\'accès'
      };
    }
  }

  /**
   * Obtient la liste des companies accessibles par l'utilisateur
   */
  static async getUserAccessibleCompanies(userId: string): Promise<{
    companies: Array<{
      id: string;
      name: string;
      role: string;
    }>;
  }> {
    try {
      const { getUserCompanies } = await import('./companyVerificationService');
      
      const companies = await getUserCompanies(userId);
      
      return {
        companies: companies.map(company => ({
          id: company.id,
          name: company.name,
          role: 'owner' // Pour l'instant, on assume que l'utilisateur est owner
        }))
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des companies:', error);
      return { companies: [] };
    }
  }

  /**
   * Détermine le mode de navigation par défaut pour un utilisateur
   */
  static async getDefaultMode(userId: string): Promise<NavigationMode> {
    try {
      const verification = await verifyUserCompany(userId);
      
      // Si l'utilisateur a une company, mode company par défaut
      if (verification.hasCompany) {
        return 'company';
      }
      
      // Sinon, mode employé par défaut
      return 'employee';
    } catch (error) {
      console.error('Erreur lors de la détermination du mode par défaut:', error);
      return 'employee';
    }
  }
}

export default NavigationService;
