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

// Caesar cipher utilities for loginLink
export function caesarCipher(input: string, shift: number): string {
  const a = 'a'.charCodeAt(0);
  const z = 'z'.charCodeAt(0);
  const A = 'A'.charCodeAt(0);
  const Z = 'Z'.charCodeAt(0);
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  return input.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= a && code <= z) {
      return String.fromCharCode(a + mod(code - a + shift, 26));
    }
    if (code >= A && code <= Z) {
      return String.fromCharCode(A + mod(code - A + shift, 26));
    }
    return ch;
  }).join('');
}

export function buildLoginLink(firstname: string, lastname: string, shift = 3): string {
  const base = `${firstname}${lastname}`;
  return caesarCipher(base, shift);
}



