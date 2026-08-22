import type {CurrentUser} from "@quadratics/types";

export function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(normalized)) {
    return null;
  }
  return `${normalized}@quadratics.xyz`;
}

export function usernameFromAuthEmail(email: string) {
  return email.endsWith("@quadratics.xyz") ? email.slice(0, -"@quadratics.xyz".length) : email.split("@")[0];
}

export function accountDisplayName(user: CurrentUser) {
  return user.displayName || (user.email ? usernameFromAuthEmail(user.email) : "user");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
