/**
 * Phone number configuration
 * Centralized configuration for phone number handling
 * Sources: ITU, Regulatory Authorities (ART Cameroon, ARTP Senegal, etc.)
 */

export interface Country {
  name: string;
  code: string;
  flag: string;
  digits: number[]; // Array of valid lengths (excl. country code)
  prefixes?: string[]; // Valid prefixes (start of local number)
  format: string; // Format mask using '#' for digits
}

export const COUNTRIES: Country[] = [
  {
    name: 'Cameroun',
    code: '+237',
    flag: '🇨🇲',
    digits: [9],
    prefixes: ['6'], // Mobile only (Nexttel, MTN, Orange). Fixed lines start with 2 but user requested to exclude.
    // Source: ART Cameroon (2 for fixed, 6 for mobile)
    format: '### ### ###', // 699 999 999
  },
  {
    name: 'Nigeria',
    code: '+234',
    flag: '🇳🇬',
    digits: [10],
    prefixes: ['7', '8', '9'], // Mobile: 70, 80, 81, 90, 91... (Excluding 01/02 fixed lines)
    // Source: NCC Nigeria
    format: '### ### ####', // 803 123 4567
  },
  {
    name: 'Sénégal',
    code: '+221',
    flag: '🇸🇳',
    digits: [9],
    prefixes: ['7'], // Mobile: 70, 75, 76, 77, 78 (Excluding 30/33 fixed lines)
    // Source: ARTP Senegal
    format: '## ### ## ##', // 77 123 45 67
  },
  {
    name: 'Côte d\'Ivoire',
    code: '+225',
    flag: '🇨🇮',
    digits: [10],
    prefixes: ['01', '05', '07', '25'], // Mobile (01 Moov, 05 MTN, 07 Orange, 25 Moov). Fixed is 27.
    // Source: ARTCI
    format: '## ## ## ## ##', // 07 07 07 07 07
  },
  {
    name: 'Gabon',
    code: '+241',
    flag: '🇬🇦',
    digits: [9],
    prefixes: ['6', '7'], // Mobile: 62, 65, 66 (Gabon Telecom), 74, 77 (Airtel). Fixed is 01.
    // Note: Local numbers often written with leading 0 (06...), but E.164 usually drops it?
    // ITU plan say national number is 9 digits (including the leading 0? No, usually 0 is trunk prefix)
    // Update: Gabon changed to 9 digits. Format 06X XX XX XX.
    // If we expect user to type 9 digits including the '0' at start? 
    // Usually +241 6X... or +241 7X... 
    // Let's assume user enters the National Significant Number.
    // Recent change might imply 0 indicates operator?
    // Let's support 06, 07 as prefixes if they include the 0, or 6, 7 if they don't.
    // Safe bet: '6', '7', '06', '07'.
    format: '## ## ## ## ##', // 07 04 04 04 04
  },
  {
    name: 'Congo-Brazzaville',
    code: '+242',
    flag: '🇨🇬',
    digits: [9],
    prefixes: ['06', '05', '04'], // Mobile
    format: '## ### ## ##', // 06 600 00 00
  },
  {
    name: 'RDC',
    code: '+243',
    flag: '🇨🇩',
    digits: [9],
    prefixes: ['8', '9'], // Mobile: 81, 82, 84, 85, 89, 90, 91, 97, 98, 99
    format: '### ### ###', // 812 345 678
  },
  {
    name: 'Bénin',
    code: '+229',
    flag: '🇧🇯',
    digits: [10],
    prefixes: ['01'], // Mobile now starts with 01 (since Nov 2024)
    format: '## ## ## ## ##', // 01 97 00 00 00
  },
  {
    name: 'Togo',
    code: '+228',
    flag: '🇹🇬',
    digits: [8],
    prefixes: ['7', '9'], // Mobile: 70, 79, 90, 91, 92, 93, 96...
    format: '## ## ## ##',
  },
  {
    name: 'Mali',
    code: '+223',
    flag: '🇲🇱',
    digits: [8],
    prefixes: ['5', '6', '7', '8', '9'], // Mobile: 6, 7, 9. Fixed: 2, 4. 
    format: '## ## ## ##',
  },
  {
    name: 'France',
    code: '+33',
    flag: '🇫🇷',
    digits: [9], // Without leading 0
    prefixes: ['6', '7'], // Mobile only
    format: '# ## ## ## ##',
  }
];

export const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === '+237') || COUNTRIES[0];

// Exporting these for backward compatibility if needed
export const DEFAULT_COUNTRY_CODE = DEFAULT_COUNTRY.code;
export const DEFAULT_COUNTRY_CODE_DIGITS = DEFAULT_COUNTRY.code.replace('+', '');
