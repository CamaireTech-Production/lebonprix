/**
 * Script to convert cameroon-locations.json to simplified TypeScript file
 * Removes: administrative, elevation, timezone, feature, coordinates
 * Keeps only: id and name (from names.primary)
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../src/data/cameroon-locations.json');
const outputFile = path.join(__dirname, '../src/data/cameroon-locations.ts');

console.log('🔄 Converting cameroon-locations.json to simplified TypeScript...');
console.log(`📂 Input: ${inputFile}`);
console.log(`📂 Output: ${outputFile}`);

try {
  // Read the JSON file
  console.log('📖 Reading JSON file...');
  const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  
  const metadata = jsonData.metadata || {};
  const locations = jsonData.locations || [];
  
  console.log(`✅ Loaded ${locations.length} locations`);
  
  // Convert to simplified structure
  console.log('🔄 Converting to simplified structure...');
  const simplifiedLocations = locations.map((loc) => {
    const name = loc.names?.primary || loc.names?.all?.[0] || 'Unknown';
    return {
      id: loc.id || '',
      name: name.trim()
    };
  }).filter(loc => loc.id && loc.name && loc.name !== 'Unknown');
  
  console.log(`✅ Converted ${simplifiedLocations.length} locations (filtered ${locations.length - simplifiedLocations.length} invalid entries)`);
  
  // Generate TypeScript file
  console.log('📝 Generating TypeScript file...');
  const tsContent = `/**
 * Simplified Cameroon Locations Data
 * Generated from cameroon-locations.json
 * Contains only id and name fields
 * 
 * Original metadata:
 * - Source: ${metadata.source || 'Unknown'}
 * - Country: ${metadata.country || 'Unknown'}
 * - Total locations: ${metadata.total_locations || locations.length}
 * - Generated at: ${metadata.generated_at || 'Unknown'}
 * - Converted at: ${new Date().toISOString()}
 */

export interface SimplifiedLocation {
  id: string;
  name: string;
}

export interface CameroonLocationsData {
  metadata: {
    source: string;
    country: string;
    country_code: string;
    total_locations: number;
    generated_at: string;
    converted_at: string;
  };
  locations: SimplifiedLocation[];
}

export const cameroonLocationsData: CameroonLocationsData = {
  metadata: {
    source: ${JSON.stringify(metadata.source || 'Unknown')},
    country: ${JSON.stringify(metadata.country || 'Cameroon')},
    country_code: ${JSON.stringify(metadata.country_code || 'CM')},
    total_locations: ${simplifiedLocations.length},
    generated_at: ${JSON.stringify(metadata.generated_at || '')},
    converted_at: ${JSON.stringify(new Date().toISOString())}
  },
  locations: ${JSON.stringify(simplifiedLocations, null, 2)}
};

export default cameroonLocationsData;
`;
  
  // Write the TypeScript file
  fs.writeFileSync(outputFile, tsContent, 'utf-8');
  
  console.log(`✅ Successfully created ${outputFile}`);
  console.log(`📊 File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('✨ Conversion complete!');
  
} catch (error) {
  console.error('❌ Error during conversion:', error);
  process.exit(1);
}

