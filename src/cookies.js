const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name, value, maxAgeMs = WEEK_MS) {
  const expires = new Date(Date.now() + maxAgeMs).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getJSONCookie(name, fallback) {
  const raw = getCookie(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJSONCookie(name, value) {
  setCookie(name, JSON.stringify(value));
}
