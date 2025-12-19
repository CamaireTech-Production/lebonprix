/**
 * Units of measurement for industrial and commercial use
 * Used for matieres (raw materials) in the Magasin section
 */

export interface Unit {
  value: string; // Technical code (e.g., "kg")
  label: string; // Display label (e.g., "Kilogramme")
}

export const UNITS: Unit[] = [
  // Mass/Weight units
  { value: "kg", label: "Kilogramme" },
  { value: "g", label: "Gramme" },
  { value: "mg", label: "Milligramme" },
  { value: "t", label: "Tonne" },
  { value: "q", label: "Quintal" },
  { value: "lb", label: "Livre" },
  { value: "oz", label: "Once" },
  
  // Volume units
  { value: "L", label: "Litre" },
  { value: "mL", label: "Millilitre" },
  { value: "cL", label: "Centilitre" },
  { value: "dL", label: "Décilitre" },
  { value: "hL", label: "Hectolitre" },
  { value: "m³", label: "Mètre cube" },
  { value: "dm³", label: "Décimètre cube" },
  { value: "cm³", label: "Centimètre cube" },
  { value: "mm³", label: "Millimètre cube" },
  { value: "gal", label: "Gallon" },
  { value: "qt", label: "Quart" },
  { value: "pt", label: "Pinte" },
  { value: "fl oz", label: "Once liquide" },
  
  // Length units
  { value: "m", label: "Mètre" },
  { value: "km", label: "Kilomètre" },
  { value: "dm", label: "Décimètre" },
  { value: "cm", label: "Centimètre" },
  { value: "mm", label: "Millimètre" },
  { value: "µm", label: "Micromètre" },
  { value: "nm", label: "Nanomètre" },
  { value: "ft", label: "Pied" },
  { value: "in", label: "Pouce" },
  { value: "yd", label: "Yard" },
  { value: "mi", label: "Mille" },
  
  // Area units
  { value: "m²", label: "Mètre carré" },
  { value: "km²", label: "Kilomètre carré" },
  { value: "dm²", label: "Décimètre carré" },
  { value: "cm²", label: "Centimètre carré" },
  { value: "mm²", label: "Millimètre carré" },
  { value: "ha", label: "Hectare" },
  { value: "a", label: "Are" },
  { value: "ca", label: "Centiare" },
  { value: "ft²", label: "Pied carré" },
  { value: "in²", label: "Pouce carré" },
  { value: "yd²", label: "Yard carré" },
  { value: "ac", label: "Acre" },
  
  // Time units
  { value: "s", label: "Seconde" },
  { value: "min", label: "Minute" },
  { value: "h", label: "Heure" },
  { value: "j", label: "Jour" },
  { value: "sem", label: "Semaine" },
  { value: "mois", label: "Mois" },
  { value: "an", label: "Année" },
  
  // Energy/Power units
  { value: "J", label: "Joule" },
  { value: "kJ", label: "Kilojoule" },
  { value: "MJ", label: "Mégajoule" },
  { value: "kWh", label: "Kilowattheure" },
  { value: "W", label: "Watt" },
  { value: "kW", label: "Kilowatt" },
  { value: "MW", label: "Mégawatt" },
  { value: "cal", label: "Calorie" },
  { value: "kcal", label: "Kilocalorie" },
  
  // Pressure units
  { value: "Pa", label: "Pascal" },
  { value: "kPa", label: "Kilopascal" },
  { value: "MPa", label: "Mégapascal" },
  { value: "bar", label: "Bar" },
  { value: "atm", label: "Atmosphère" },
  { value: "psi", label: "Livre par pouce carré" },
  
  // Temperature units
  { value: "°C", label: "Degré Celsius" },
  { value: "°F", label: "Degré Fahrenheit" },
  { value: "K", label: "Kelvin" },
  
  // Speed/Velocity units
  { value: "m/s", label: "Mètre par seconde" },
  { value: "km/h", label: "Kilomètre par heure" },
  { value: "mph", label: "Mille par heure" },
  { value: "kn", label: "Nœud" },
  
  // Force units
  { value: "N", label: "Newton" },
  { value: "kN", label: "Kilonewton" },
  { value: "MN", label: "Méganewton" },
  { value: "kgf", label: "Kilogramme-force" },
  { value: "lbf", label: "Livre-force" },
  
  // Commercial/Counting units
  { value: "pièce", label: "Pièce" },
  { value: "unité", label: "Unité" },
  { value: "lot", label: "Lot" },
  { value: "paquet", label: "Paquet" },
  { value: "carton", label: "Carton" },
  { value: "boîte", label: "Boîte" },
  { value: "sachet", label: "Sachet" },
  { value: "sac", label: "Sac" },
  { value: "palette", label: "Palette" },
  { value: "caisse", label: "Caisse" },
  { value: "colis", label: "Colis" },
  { value: "rouleau", label: "Rouleau" },
  { value: "bobine", label: "Bobine" },
  { value: "botte", label: "Botte" },
  { value: "faisceau", label: "Faisceau" },
  { value: "douzaine", label: "Douzaine" },
  { value: "centaine", label: "Centaine" },
  { value: "millier", label: "Millier" },
  
  // Textile units
  { value: "m lin", label: "Mètre linéaire" },
  { value: "m²", label: "Mètre carré" },
  { value: "yd", label: "Yard" },
  { value: "pied", label: "Pied" },
  
  // Electrical units
  { value: "A", label: "Ampère" },
  { value: "mA", label: "Milliampère" },
  { value: "V", label: "Volt" },
  { value: "mV", label: "Millivolt" },
  { value: "kV", label: "Kilovolt" },
  { value: "Ω", label: "Ohm" },
  { value: "kΩ", label: "Kiloohm" },
  { value: "MΩ", label: "Mégaohm" },
  { value: "F", label: "Farad" },
  { value: "µF", label: "Microfarad" },
  { value: "mF", label: "Millifarad" },
  { value: "H", label: "Henry" },
  { value: "mH", label: "Millihenry" },
  { value: "µH", label: "Microhenry" },
  
  // Frequency units
  { value: "Hz", label: "Hertz" },
  { value: "kHz", label: "Kilohertz" },
  { value: "MHz", label: "Mégahertz" },
  { value: "GHz", label: "Gigahertz" },
  
  // Data/Storage units
  { value: "B", label: "Octet" },
  { value: "KB", label: "Kilooctet" },
  { value: "MB", label: "Mégaoctet" },
  { value: "GB", label: "Gigaoctet" },
  { value: "TB", label: "Téraoctet" },
  { value: "PB", label: "Pétaoctet" },
  
  // Angle units
  { value: "°", label: "Degré" },
  { value: "rad", label: "Radian" },
  { value: "grad", label: "Grade" },
  
  // Concentration units
  { value: "mol/L", label: "Mole par litre" },
  { value: "g/L", label: "Gramme par litre" },
  { value: "mg/L", label: "Milligramme par litre" },
  { value: "ppm", label: "Partie par million" },
  { value: "ppb", label: "Partie par milliard" },
  { value: "%", label: "Pourcentage" },
  
  // Viscosity units
  { value: "Pa·s", label: "Pascal-seconde" },
  { value: "cP", label: "Centipoise" },
  { value: "m²/s", label: "Mètre carré par seconde" },
  { value: "St", label: "Stokes" },
  
  // Flow rate units
  { value: "L/min", label: "Litre par minute" },
  { value: "L/h", label: "Litre par heure" },
  { value: "m³/h", label: "Mètre cube par heure" },
  { value: "m³/min", label: "Mètre cube par minute" },
  { value: "gpm", label: "Gallon par minute" },
  
  // Density units
  { value: "kg/m³", label: "Kilogramme par mètre cube" },
  { value: "g/cm³", label: "Gramme par centimètre cube" },
  { value: "g/mL", label: "Gramme par millilitre" },
  { value: "lb/ft³", label: "Livre par pied cube" },
  
  // Other common units
  { value: "paire", label: "Paire" },
  { value: "jeu", label: "Jeu" },
  { value: "set", label: "Set" },
  { value: "kit", label: "Kit" },
  { value: "groupe", label: "Groupe" },
  { value: "série", label: "Série" },
  { value: "lot", label: "Lot" },
];

/**
 * Search units by query (searches in both value and label, case-insensitive)
 * @param query - Search query string
 * @returns Array of matching units
 */
export const searchUnits = (query: string): Unit[] => {
  if (!query || query.trim() === '') {
    return UNITS;
  }
  
  const lowerQuery = query.toLowerCase().trim();
  
  return UNITS.filter(unit => 
    unit.value.toLowerCase().includes(lowerQuery) ||
    unit.label.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Get unit by value
 * @param value - Unit value (e.g., "kg")
 * @returns Unit object or undefined if not found
 */
export const getUnitByValue = (value: string): Unit | undefined => {
  return UNITS.find(unit => unit.value === value);
};

/**
 * Get unit by label
 * @param label - Unit label (e.g., "Kilogramme")
 * @returns Unit object or undefined if not found
 */
export const getUnitByLabel = (label: string): Unit | undefined => {
  return UNITS.find(unit => unit.label === label);
};

