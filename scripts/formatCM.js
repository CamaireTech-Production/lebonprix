const fs = require('fs');
const path = require('path');

// Chemin du fichier source et destination
const inputFile = path.join(__dirname, '..', 'CM.txt');
const outputFile = path.join(__dirname, '..', 'CM.csv');

console.log('Lecture du fichier CM.txt...');
const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

console.log(`Nombre de lignes à traiter: ${lines.length}`);

// En-têtes CSV
const headers = [
  'id',
  'name_primary',
  'name_alternate',
  'name_alternatives',
  'latitude',
  'longitude',
  'feature_type',
  'feature_code',
  'country_code',
  'admin_code_1',
  'admin_code_2',
  'admin_code_3',
  'admin_code_4',
  'population',
  'elevation',
  'timezone',
  'modification_date'
];

// Fonction pour échapper les valeurs CSV
function escapeCSV(value) {
  if (!value || value.trim() === '') {
    return '';
  }
  // Si la valeur contient des virgules, guillemets ou retours à la ligne, l'entourer de guillemets
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Créer le contenu CSV
let csvContent = headers.join(',') + '\n';

let processed = 0;
let errors = 0;

lines.forEach((line, index) => {
  try {
    // Séparer par tabulations
    const columns = line.split('\t');
    
    // S'assurer qu'on a au moins les colonnes de base
    if (columns.length < 17) {
      // Remplir avec des valeurs vides si nécessaire
      while (columns.length < 17) {
        columns.push('');
      }
    }
    
    // Prendre les 17 premières colonnes
    const row = columns.slice(0, 17).map(escapeCSV);
    csvContent += row.join(',') + '\n';
    
    processed++;
    
    if ((index + 1) % 1000 === 0) {
      console.log(`Traité: ${index + 1}/${lines.length} lignes...`);
    }
  } catch (error) {
    errors++;
    console.error(`Erreur à la ligne ${index + 1}:`, error.message);
  }
});

// Écrire le fichier CSV
console.log('\nÉcriture du fichier CM.csv...');
fs.writeFileSync(outputFile, csvContent, 'utf-8');

console.log('\n✅ Conversion terminée!');
console.log(`- Lignes traitées: ${processed}`);
console.log(`- Erreurs: ${errors}`);
console.log(`- Fichier créé: ${outputFile}`);
console.log(`- Taille: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);



