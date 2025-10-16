export function generateInviteId(): string {
  // UUID v4 (simple implementation)
  // Note: For cryptographic strength, prefer crypto.randomUUID() when available.
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}




