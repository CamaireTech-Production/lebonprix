/**
 * Service pour générer et valider les codes-barres EAN-13
 */

/**
 * Calcule la clé de contrôle EAN-13
 * @param code - Les 12 premiers chiffres du code EAN-13
 * @returns La clé de contrôle (13ème chiffre)
 */
function calculateEAN13CheckDigit(code: string): string {
  if (code.length !== 12) {
    throw new Error('Le code doit contenir exactement 12 chiffres');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i]);
    // Multiplier par 1 pour les positions impaires, par 3 pour les positions paires
    sum += (i % 2 === 0) ? digit : digit * 3;
  }

  const remainder = sum % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;
  return checkDigit.toString();
}

/**
 * Génère un code-barres EAN-13 unique basé sur l'ID du produit
 * @param productId - L'ID du produit
 * @returns Un code-barres EAN-13 valide (13 chiffres)
 */
export function generateEAN13(productId: string): string {
  // Utiliser un préfixe pour identifier les codes générés par notre système
  // 200-299 sont des codes réservés pour usage interne
  const prefix = '200';
  
  // Convertir l'ID du produit en une chaîne de 9 chiffres
  // Utiliser un hash simple de l'ID pour obtenir un nombre
  let hash = 0;
  for (let i = 0; i < productId.length; i++) {
    const char = productId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Prendre la valeur absolue et la convertir en chaîne de 9 chiffres
  const hashString = Math.abs(hash).toString().padStart(9, '0').slice(0, 9);
  
  // Combiner le préfixe avec le hash
  const code12 = prefix + hashString;
  
  // Calculer la clé de contrôle
  const checkDigit = calculateEAN13CheckDigit(code12);
  
  return code12 + checkDigit;
}

/**
 * Valide un code-barres EAN-13
 * @param barcode - Le code-barres à valider
 * @returns True si le code est valide
 */
export function validateEAN13(barcode: string): boolean {
  if (!barcode || barcode.length !== 13) {
    return false;
  }

  // Vérifier que tous les caractères sont des chiffres
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }

  // Calculer et vérifier la clé de contrôle
  const code12 = barcode.slice(0, 12);
  const checkDigit = calculateEAN13CheckDigit(code12);
  
  return checkDigit === barcode[12];
}

/**
 * Formate un code-barres EAN-13 pour l'affichage
 * @param barcode - Le code-barres à formater
 * @returns Le code formaté avec des espaces
 */
export function formatEAN13(barcode: string): string {
  if (!barcode || barcode.length !== 13) {
    return barcode;
  }
  
  // Formater comme: 200 123456789 0
  return `${barcode.slice(0, 3)} ${barcode.slice(3, 12)} ${barcode.slice(12)}`;
}

