import type { Production, ProductionStateChange } from '../../types/models';
import { getProductionFlow } from '@services/firestore/productions/productionFlowService';

/**
 * Default status flow for productions without a custom flow
 * These are the required statuses that must be passed before publishing
 */
const DEFAULT_STATUS_FLOW: Array<'draft' | 'in_progress' | 'ready'> = ['draft', 'in_progress', 'ready'];

/**
 * Validate that all flow steps have been passed for a production
 * 
 * @param production - The production to validate
 * @returns Object with isValid flag and missing steps/statuses
 */
export const validateProductionFlowCompletion = async (
  production: Production
): Promise<{
  isValid: boolean;
  missingSteps?: string[];
  missingStatuses?: string[];
  errorMessage?: string;
}> => {
  if (!production.stateHistory || production.stateHistory.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Aucun historique d\'état trouvé pour cette production'
    };
  }

  // If production has a flow, validate all flow steps are passed
  if (production.flowId) {
    try {
      const flow = await getProductionFlow(production.flowId, production.companyId);
      if (!flow) {
        return {
          isValid: false,
          errorMessage: 'Flux de production introuvable'
        };
      }

      if (!flow.stepIds || flow.stepIds.length === 0) {
        return {
          isValid: false,
          errorMessage: 'Le flux ne contient aucune étape'
        };
      }

      // Extract all step IDs that have been visited from stateHistory
      const visitedStepIds = new Set<string>();
      production.stateHistory.forEach((change: ProductionStateChange) => {
        if (change.toStepId) {
          visitedStepIds.add(change.toStepId);
        }
      });

      // Check which flow steps are missing
      const missingSteps = flow.stepIds.filter(stepId => !visitedStepIds.has(stepId));

      if (missingSteps.length > 0) {
        return {
          isValid: false,
          missingSteps,
          errorMessage: `Les étapes suivantes du flux n'ont pas encore été passées: ${missingSteps.length} étape(s) manquante(s)`
        };
      }

      return {
        isValid: true
      };
    } catch (error: any) {
      return {
        isValid: false,
        errorMessage: `Erreur lors de la validation du flux: ${error.message}`
      };
    }
  } else {
    // No flow: validate default status flow
    // Extract all statuses that have been visited from stateHistory
    const visitedStatuses = new Set<string>();
    production.stateHistory.forEach((change: ProductionStateChange) => {
      if (change.toStatus) {
        visitedStatuses.add(change.toStatus);
      }
    });

    // Check which default statuses are missing
    const missingStatuses = DEFAULT_STATUS_FLOW.filter(status => !visitedStatuses.has(status));

    if (missingStatuses.length > 0) {
      return {
        isValid: false,
        missingStatuses,
        errorMessage: `Les statuts suivants n'ont pas encore été passés: ${missingStatuses.join(', ')}`
      };
    }

    return {
      isValid: true
    };
  }
};

/**
 * Validate flow completion for an article
 * Articles use the production's flow, so we validate the production's flow
 * 
 * @param production - The production containing the article
 * @param _articleId - The article ID to validate (optional, for future use if articles have their own flow)
 * @returns Object with isValid flag and missing steps/statuses
 */
export const validateArticleFlowCompletion = async (
  production: Production,
  _articleId?: string
): Promise<{
  isValid: boolean;
  missingSteps?: string[];
  missingStatuses?: string[];
  errorMessage?: string;
}> => {
  // For now, articles use the production's flow
  // In the future, articles might have their own flow tracking
  return validateProductionFlowCompletion(production);
};

/**
 * Synchronously check if a production can be published (quick check without async flow fetch)
 * This is used for UI state (disabling buttons) - for actual validation, use validateProductionFlowCompletion
 * 
 * @param production - The production to check
 * @param flowStepIds - Optional: array of step IDs from the flow (if available)
 * @returns Object with canPublish flag and reason message
 */
export const canPublishProduction = (
  production: Production,
  flowStepIds?: string[]
): {
  canPublish: boolean;
  reason?: string;
  missingSteps?: string[];
  missingStatuses?: string[];
} => {
  if (!production.stateHistory || production.stateHistory.length === 0) {
    return {
      canPublish: false,
      reason: 'Aucun historique d\'état trouvé pour cette production'
    };
  }

  // If production has a flow, check if all flow steps are passed
  if (production.flowId) {
    if (!flowStepIds || flowStepIds.length === 0) {
      // Can't determine without flow data - assume can't publish (will be validated async)
      return {
        canPublish: false,
        reason: 'Vérification du flux en cours...'
      };
    }

    // Extract all step IDs that have been visited from stateHistory
    const visitedStepIds = new Set<string>();
    production.stateHistory.forEach((change: ProductionStateChange) => {
      if (change.toStepId) {
        visitedStepIds.add(change.toStepId);
      }
    });

    // Check which flow steps are missing
    const missingSteps = flowStepIds.filter(stepId => !visitedStepIds.has(stepId));

    if (missingSteps.length > 0) {
      return {
        canPublish: false,
        reason: `Toutes les étapes du flux doivent être passées avant de publier (${missingSteps.length} étape(s) manquante(s))`,
        missingSteps
      };
    }

    return {
      canPublish: true
    };
  } else {
    // No flow: validate default status flow
    // Extract all statuses that have been visited from stateHistory
    const visitedStatuses = new Set<string>();
    production.stateHistory.forEach((change: ProductionStateChange) => {
      if (change.toStatus) {
        visitedStatuses.add(change.toStatus);
      }
    });

    // Check which default statuses are missing
    const missingStatuses = DEFAULT_STATUS_FLOW.filter(status => !visitedStatuses.has(status));

    if (missingStatuses.length > 0) {
      return {
        canPublish: false,
        reason: `Les statuts suivants doivent être passés avant de publier: ${missingStatuses.join(', ')}`,
        missingStatuses
      };
    }

    return {
      canPublish: true
    };
  }
};

