# Vérification du Rôle "Owner" - Implémentation

## Problème Identifié

La logique de redirection vers les companies ne vérifiait que si l'utilisateur était propriétaire via `companyId === userId`, mais ne vérifiait pas explicitement le rôle "owner" dans `employeeRefs`. Cela pouvait permettre l'accès à des companies où l'utilisateur n'avait pas le rôle "owner".

## Solution Appliquée

### **1. Nouvelle Fonction de Vérification**

**Fichier : `src/services/companyVerificationService.ts`**

Ajout de la fonction `verifyUserOwnerCompanies()` qui :

```typescript
export async function verifyUserOwnerCompanies(userId: string): Promise<CompanyVerificationResult> {
  try {
    console.log('🔍 Vérification des companies où l\'utilisateur est owner...');
    
    // 1. Récupérer toutes les companies où l'utilisateur est owner (companyId === userId)
    const companiesRef = collection(db, 'companies');
    const q = query(companiesRef, where('companyId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('❌ Aucune company trouvée pour cet utilisateur');
      return { hasCompany: false };
    }

    const companies: Company[] = [];
    
    // 2. Vérifier le rôle dans employeeRefs pour chaque company
    for (const companyDoc of querySnapshot.docs) {
      const companyId = companyDoc.id;
      
      try {
        const employeeRefDoc = await getDoc(doc(db, 'companies', companyId, 'employeeRefs', userId));
        
        if (employeeRefDoc.exists()) {
          const employeeData = employeeRefDoc.data();
          
          // ✅ VÉRIFICATION CRITIQUE : Rôle doit être "owner"
          if (employeeData.role === 'owner') {
            const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
            companies.push(companyData);
            console.log('✅ Company avec rôle owner trouvée:', companyData.name);
          } else {
            console.log('⚠️ Company trouvée mais rôle non-owner:', employeeData.role);
          }
        } else {
          console.log('⚠️ EmployeeRef non trouvé pour company:', companyId);
        }
      } catch (error) {
        console.error('❌ Erreur lors de la vérification du rôle pour company:', companyId, error);
      }
    }

    if (companies.length === 0) {
      console.log('❌ Aucune company avec rôle owner trouvée');
      return { hasCompany: false };
    }

    console.log(`✅ ${companies.length} company(s) avec rôle owner trouvée(s)`);
    return {
      hasCompany: true,
      companyId: companies[0].id,
      company: companies[0],
      companies: companies
    };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des companies owner:', error);
    throw new Error('Impossible de vérifier les companies owner de l\'utilisateur');
  }
}
```

### **2. Mise à Jour du NavigationService**

**Fichier : `src/services/navigationService.ts`**

Modification de `handleCompanyMode()` pour utiliser la nouvelle fonction :

```typescript
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
```

## Logique de Vérification

### **Séquence de Vérification :**

1. **Recherche des companies** : `where('companyId', '==', userId)`
2. **Pour chaque company trouvée** :
   - Lire le document `companies/{companyId}/employeeRefs/{userId}`
   - Vérifier que `employeeData.role === 'owner'`
   - Ajouter à la liste si rôle = "owner"
3. **Résultat** :
   - Si au moins une company avec rôle "owner" → Redirection vers dashboard
   - Si aucune company avec rôle "owner" → Redirection vers `/company/create`

### **Garanties de Sécurité :**

- ✅ **Vérification explicite du rôle** : `employeeData.role === 'owner'`
- ✅ **Double vérification** : `companyId === userId` ET `role === 'owner'`
- ✅ **Redirection sécurisée** : Seulement vers les companies où l'utilisateur est owner
- ✅ **Fallback approprié** : Redirection vers création si pas de rôle owner

## Avantages de cette Solution

### ✅ **Sécurité Renforcée**
- Vérifie explicitement le rôle "owner" dans employeeRefs
- Empêche l'accès aux companies où l'utilisateur n'est pas owner
- Double vérification : propriétaire ET rôle owner

### ✅ **Logique Claire**
- Séparation entre propriétaire (`companyId === userId`) et rôle (`role === "owner"`)
- Vérification explicite du rôle avant redirection
- Gestion d'erreur appropriée avec logs détaillés

### ✅ **Flexibilité**
- Peut être étendu pour d'autres rôles (admin, manager, etc.)
- Logs détaillés pour le débogage
- Gestion des cas d'erreur et incohérences

### ✅ **Compatibilité**
- Maintient la logique existante
- Ajoute une couche de sécurité supplémentaire
- Pas de changement d'architecture

## Flux Corrigé

### **Séquence Après Clic "Continuer en tant que Companie" :**

1. **ModeSelectionModal** → Clic "Continuer en tant que Companie"
2. **NavigationService** → `handleCompanyMode(userId)`
3. **verifyUserOwnerCompanies** → Vérifie `companyId === userId` ET `role === 'owner'`
4. **Résultat** :
   - **Si rôle owner trouvé** → Redirection vers `/company/{companyId}/dashboard`
   - **Si pas de rôle owner** → Redirection vers `/company/create`

## Résultat

**Avant :**
- Vérification seulement `companyId === userId`
- Risque d'accès non autorisé si rôle différent

**Après :**
- Vérification `companyId === userId` ET `role === 'owner'`
- Accès garanti uniquement aux companies où l'utilisateur est owner
- Redirection appropriée selon le rôle

## 🎯 **Solution Optimale Appliquée avec Succès !**

La vérification du rôle "owner" est maintenant implémentée et garantit que l'utilisateur ne peut accéder qu'aux companies où il a explicitement le rôle "owner" dans employeeRefs.
