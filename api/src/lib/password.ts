const ITERATIONS = 100_000

function enc(s: string) {
  return new TextEncoder().encode(s)
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  const keyMaterial = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

export function randomSaltHex(byteLength = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await hashPassword(password, saltHex)
  return constantTimeEqual(hash, expectedHash)
}
