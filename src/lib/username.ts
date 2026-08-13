/** Public namespace handles: `openfield.nu/[username]/[map-slug]`. */
import { supabase } from "@/integrations/supabase/client";

export const RESERVED_USERNAMES = new Set([
  "projects",
  "project",
  "settings",
  "setting",
  "auth",
  "login",
  "logout",
  "signup",
  "sign-up",
  "maps",
  "map",
  "api",
  "admin",
  "administrator",
  "openfield",
  "open-field",
  "reset-password",
  "password",
  "account",
  "accounts",
  "user",
  "users",
  "profile",
  "profiles",
  "dashboard",
  "new",
  "help",
  "support",
  "about",
  "pricing",
  "terms",
  "privacy",
  "blog",
  "docs",
  "static",
  "assets",
  "public",
  "embed",
  "comments",
  "published",
  "me",
  "root",
  "www",
]);

const PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

/** Returns null when valid, otherwise a human message. */
export function validateUsername(value: string): string | null {
  if (!value) return "Pick a username for your public map URLs.";
  if (value.length < 3) return "Usernames need at least 3 characters.";
  if (value.length > 30) return "Usernames can be at most 30 characters.";
  if (!PATTERN.test(value)) {
    return "Use lowercase letters, numbers and hyphens only.";
  }
  if (RESERVED_USERNAMES.has(value)) return "That username is reserved.";
  return null;
}

export async function isUsernameAvailable(value: string, selfId?: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", value)
    .maybeSingle();
  if (!data) return true;
  return Boolean(selfId && data.id === selfId);
}
