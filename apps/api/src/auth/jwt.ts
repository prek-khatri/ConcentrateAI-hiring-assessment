import jwt from "jsonwebtoken";

export type Role = "admin" | "teacher" | "student";

export type JwtPayload = {
  sub: string;
  role: Role;
};

export const AUTH_COOKIE_NAME = "school_session";

export function signSessionToken(payload: JwtPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifySessionToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

export function authCookieOptions(isProd: boolean) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
}
