import { Google, generateCodeVerifier, generateState } from "arctic";
import { env } from "../env.js";

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
};

function getGoogleClient(): Google {
  if (!env.OAUTH_CLIENT_ID || !env.OAUTH_CLIENT_SECRET || !env.OAUTH_CALLBACK_URL) {
    throw new Error("Google OAuth is not configured — set OAUTH_CLIENT_ID/SECRET/CALLBACK_URL");
  }
  return new Google(env.OAUTH_CLIENT_ID, env.OAUTH_CLIENT_SECRET, env.OAUTH_CALLBACK_URL);
}

export function createGoogleAuthRequest() {
  const google = getGoogleClient();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);
  return { url, state, codeVerifier };
}

export async function exchangeGoogleCode(code: string, codeVerifier: string): Promise<GoogleProfile> {
  const google = getGoogleClient();
  const tokens = await google.validateAuthorizationCode(code, codeVerifier);

  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch Google profile");
  }
  const profile = (await res.json()) as { sub: string; email: string; name: string };
  return { sub: profile.sub, email: profile.email, name: profile.name };
}
