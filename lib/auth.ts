export async function sessionToken() {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const code = process.env.ACCESS_CODE || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${code}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function codesMatch(input: string) {
  const expected = process.env.ACCESS_CODE || "";
  if (!expected || input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
