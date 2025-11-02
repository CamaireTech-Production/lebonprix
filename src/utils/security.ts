// Password and loginLink helpers

export function makeDefaultEmployeePassword(firstname: string, lastname: string): string {
  return `${firstname}123${lastname}`;
}

export async function hashCompanyPassword(plain: string): Promise<string> {
  // Uses Web Crypto API (SHA-256). Replace or wrap with company's official hashing if available.
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const enc = new TextEncoder();
    const data = enc.encode(plain);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (non-crypto): NOT secure, just to avoid runtime errors in non-browser contexts.
  // Replace with a proper polyfill if needed.
  let hash = 0;
  for (let i = 0; i < plain.length; i++) {
    hash = ((hash << 5) - hash) + plain.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

export async function buildDefaultHashedPassword(firstname: string, lastname: string): Promise<string> {
  const defaultPwd = makeDefaultEmployeePassword(firstname, lastname);
  return hashCompanyPassword(defaultPwd);
}


function getRandomChar(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const char = chars[Math.floor(Math.random() * chars.length)];
  return char;
}

export function generateSafeRandomLink(firstname: string, lastname: string): string {
  const base = `${firstname}${lastname}`;
  let link = '';

  for (let i = 0; i < base.length; i++) {
    let char = getRandomChar();

    // Vérifie le caractère avec le regex des interdits
    const forbiddenRegex = /[\[\]*.]/;
    if (forbiddenRegex.test(char)) {
      // Récursion jusqu'à obtenir un caractère valide
      char = getRandomChar();
    }

    link += char;
  }

  return link;
}


export function buildLoginLink(firstname: string, lastname: string): string {
  return generateSafeRandomLink(firstname, lastname );
}

// Generate unique employee ID
export function generateEmployeeId(): string {
  return `emp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}



