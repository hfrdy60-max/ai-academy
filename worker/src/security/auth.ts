async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

/** Constant-time comparison (hash both sides so length differences do not leak). */
export async function tokenMatches(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
