const USERNAME_KEY = "air6_username";

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USERNAME_KEY);
}

export function storeUsername(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERNAME_KEY, sanitizeUsername(name));
}

export function clearStoredUsername(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USERNAME_KEY);
}

/** Lowercase, alphanumeric + underscore + dash, 2–20 chars */
export function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export function isValidUsername(raw: string): boolean {
  const s = sanitizeUsername(raw);
  return s.length >= 2 && s.length <= 20;
}
