/**
 * Service de navigation simplifié
 * Tous les utilisateurs passent maintenant par la page de sélection d'entreprise
 */
export class NavigationService {
  /**
   * Redirige vers la page de sélection d'entreprise
   */
  static redirectToCompanySelection(userId: string): string {
    return `/companies/me/${userId}`;
  }

  /**
   * Redirige vers la création d'entreprise
   */
  static redirectToCreateCompany(): string {
    return '/company/create';
  }

  /**
   * Redirige vers le dashboard d'une entreprise
   */
  static redirectToCompanyDashboard(companyId: string): string {
    return `/company/${companyId}/dashboard`;
  }
}

export default NavigationService;