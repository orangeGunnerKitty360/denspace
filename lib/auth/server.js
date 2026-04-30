import { createNeonAuth } from "@neondatabase/auth/next/server";

export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (!baseUrl || !secret) {
    throw new Error("Missing NEON_AUTH_BASE_URL or NEON_AUTH_COOKIE_SECRET.");
  }

  return createNeonAuth({
    baseUrl,
    cookies: {
      secret
    }
  });
}
