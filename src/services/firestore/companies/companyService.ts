import { doc, setDoc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { Company, ModuleName } from '../../../types/models';
import CompanyManager from '../../storage/CompanyManager';
import { getUserById, removeCompanyFromUser } from '../../utilities/userService';
import { addUserToCompany } from './userCompanySyncService';
import { createShop } from '../shops/shopService';
import { createWarehouse } from '../warehouse/warehouseService';
import { getModulesForPlan } from '../../../constants/modules';

export interface CompanyData {
  name: string;
  description?: string;
  phone: string;
  location?: string;
  logo?: string;
  email: string;
  report_mail?: string;
  report_time?: string | number; // Format: "HH:mm" (e.g., "19:30") or number (0-23) for backward compatibility
  planType?: 'starter' | 'enterprise'; // NEW: Plan type for module separation
}

/**
 * Crée une entreprise pour un utilisateur déjà connecté
 * 
 * Architecture simplifiée : l'utilisateur doit être connecté avant de créer une entreprise
 * 
 * @param userId - ID de l'utilisateur connecté (propriétaire)
 * @param companyData - Données de l'entreprise (includes planType)
 * @returns L'entreprise créée
 */
export const createCompany = async (
  userId: string,
  companyData: CompanyData
): Promise<Company> => {
  try {
    // Determine plan type (default to enterprise for backward compatibility)
    const planType = companyData.planType || 'enterprise';
    const modules: ModuleName[] = getModulesForPlan(planType);

    console.log(`🏢 Création d'une entreprise ${planType.toUpperCase()} pour l'utilisateur ${userId}...`);

    // 1. Générer un ID unique pour l'entreprise
    const companyId = `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 2. Créer le document entreprise (filtrer les valeurs undefined)
    const now = Timestamp.now();
    const companyDoc = {
      name: companyData.name,
      phone: companyData.phone,
      email: companyData.email,
      companyId: userId, // Le propriétaire de l'entreprise
      createdAt: now,
      updatedAt: now,
      // Module separation fields
      planType,
      modules,
      subscriptionStatus: 'trial' as const, // Start with trial
      subscriptionStartedAt: now,
      // Ajouter seulement les champs non-undefined
      ...(companyData.description && { description: companyData.description }),
      ...(companyData.location && { location: companyData.location }),
      ...(companyData.logo && { logo: companyData.logo }),
      ...(companyData.report_mail && { report_mail: companyData.report_mail })
    };

    // 3. Sauvegarder en base de données
    await setDoc(doc(db, 'companies', companyId), companyDoc);

    // 4. Récupérer les données utilisateur
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // 5. Ajouter le propriétaire à la company en utilisant addUserToCompany
    // (crée l'employeeRef, met à jour company.employees{}, employeeCount, et users.companies[])
    await addUserToCompany(
      userId,
      companyId,
      {
        name: companyData.name,
        description: companyData.description || '',
        logo: companyData.logo || ''
      },
      {
        username: user.username,
        email: user.email
      },
      'owner'
    );

    // 6. Créer l'objet compagnie complet
    const company: Company = {
      id: companyId,
      userId: userId, // Owner reference
      ...companyDoc
    } as Company;

    // 7. Sauvegarder dans le cache local
    CompanyManager.save(companyId, company);

    // 8. Create default shop (ALWAYS - both starter and enterprise)
    let defaultShopId: string | undefined;
    let defaultWarehouseId: string | undefined;

    try {
      console.log('🏪 Création de la boutique par défaut...');
      const defaultShop = await createShop(
        {
          name: 'Boutique Principale',
          companyId,
          userId,
          isDefault: true,
          isActive: true,
          location: companyData.location,
          address: companyData.location
        },
        companyId,
        null // No createdBy for auto-created default shop
      );
      defaultShopId = defaultShop.id;
      console.log(`✅ Boutique par défaut créée: ${defaultShopId}`);

      // Create default warehouse ONLY for enterprise plans
      if (planType === 'enterprise') {
        console.log('📦 Création de l\'entrepôt par défaut (Enterprise)...');
        const defaultWarehouse = await createWarehouse(
          {
            name: 'Entrepôt Principal',
            companyId,
            userId,
            isDefault: true,
            isActive: true,
            location: companyData.location,
            address: companyData.location
          },
          companyId,
          null // No createdBy for auto-created default warehouse
        );
        defaultWarehouseId = defaultWarehouse.id;
        console.log(`✅ Entrepôt par défaut créé: ${defaultWarehouseId}`);
      } else {
        console.log('ℹ️ Plan Starter - pas d\'entrepôt par défaut');
      }

      // 9. Update company with default shop/warehouse IDs
      const updateData: { defaultShopId?: string; defaultWarehouseId?: string } = {};
      if (defaultShopId) updateData.defaultShopId = defaultShopId;
      if (defaultWarehouseId) updateData.defaultWarehouseId = defaultWarehouseId;

      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, 'companies', companyId), updateData);
        // Update local company object
        company.defaultShopId = defaultShopId;
        company.defaultWarehouseId = defaultWarehouseId;
        CompanyManager.save(companyId, company);
        console.log('✅ IDs par défaut sauvegardés sur la compagnie');
      }
    } catch (error) {
      // Log error but don't fail company creation
      console.error('⚠️ Erreur lors de la création de la boutique/entrepôt par défaut:', error);
      // Continue - company is already created, shop/warehouse can be created later
    }

    console.log(`✅ Entreprise ${companyData.name} (${planType}) créée avec succès`);
    return company;

  } catch (error: unknown) {
    console.error('❌ Erreur lors de la création de l\'entreprise:', error);
    throw error;
  }
};

/**
 * Supprime une entreprise
 * 
 * @param userId - ID de l'utilisateur qui demande la suppression
 * @param companyId - ID de l'entreprise à supprimer
 */
export const deleteCompany = async (
  userId: string,
  companyId: string
): Promise<void> => {
  try {
    console.log(`🗑️ Suppression de l'entreprise ${companyId} par l'utilisateur ${userId}...`);

    // 1. Vérifier que l'utilisateur est owner
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const company = user.companies.find(c => c.companyId === companyId);
    if (!company) {
      throw new Error('Entreprise non trouvée dans vos entreprises');
    }

    if (company.role !== 'owner') {
      throw new Error('Seul le propriétaire peut supprimer l\'entreprise');
    }

    // 2. Supprimer le document entreprise
    await deleteDoc(doc(db, 'companies', companyId));
    console.log(`✅ Document entreprise ${companyId} supprimé`);

    // 3. Supprimer la référence de users[].companies[]
    await removeCompanyFromUser(userId, companyId);
    console.log(`✅ Référence supprimée de users/${userId}.companies[]`);

    // 4. Nettoyer le cache local
    CompanyManager.remove(companyId);
    console.log(`✅ Cache local nettoyé`);

    console.log(`✅ Entreprise ${companyId} supprimée avec succès`);

  } catch (error: unknown) {
    console.error('❌ Erreur lors de la suppression de l\'entreprise:', error);
    throw error;
  }
};

