import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import { verifyPassword } from "../auth/password.js";
import { AUTH_COOKIE_NAME, authCookieOptions, signSessionToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { createGoogleAuthRequest, exchangeGoogleCode } from "../auth/google.js";
import { LoginSchema } from "./schemas.js";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_VERIFIER_COOKIE = "oauth_verifier";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const { email, password } = LoginSchema.parse(request.body);

    const user = await db.selectFrom("users").selectAll().where("email", "=", email).executeTakeFirst();
    if (!user || !user.password_hash) {
      throw new ApiError("UNAUTHORIZED", "Invalid email or password");
    }
    if (user.is_suspended) {
      throw new ApiError("FORBIDDEN", "Account suspended");
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new ApiError("UNAUTHORIZED", "Invalid email or password");
    }

    const token = signSessionToken({ sub: user.id, role: user.role }, env.JWT_SECRET);
    reply.setCookie(AUTH_COOKIE_NAME, token, authCookieOptions(env.NODE_ENV === "production"));

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    return request.user;
  });

  app.get("/auth/oauth/google", async (_request, reply) => {
    const { url, state, codeVerifier } = createGoogleAuthRequest();
    const isProd = env.NODE_ENV === "production";
    reply.setCookie(OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" });
    reply.setCookie(OAUTH_VERIFIER_COOKIE, codeVerifier, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
    });
    return reply.redirect(url.toString());
  });

  app.get("/auth/oauth/google/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string };
    const storedState = request.cookies[OAUTH_STATE_COOKIE];
    const codeVerifier = request.cookies[OAUTH_VERIFIER_COOKIE];

    if (!query.code || !query.state || !storedState || query.state !== storedState || !codeVerifier) {
      throw new ApiError("UNAUTHORIZED", "Invalid OAuth callback");
    }

    const profile = await exchangeGoogleCode(query.code, codeVerifier);

    let user = await db
      .selectFrom("oauth_accounts")
      .innerJoin("users", "users.id", "oauth_accounts.user_id")
      .selectAll("users")
      .where("oauth_accounts.provider", "=", "google")
      .where("oauth_accounts.provider_account_id", "=", profile.sub)
      .executeTakeFirst();

    if (!user) {
      const existing = await db.selectFrom("users").selectAll().where("email", "=", profile.email).executeTakeFirst();
      if (existing) {
        await db
          .insertInto("oauth_accounts")
          .values({ user_id: existing.id, provider: "google", provider_account_id: profile.sub })
          .execute();
        user = existing;
      } else {
        user = await db.transaction().execute(async (trx) => {
          const created = await trx
            .insertInto("users")
            .values({ email: profile.email, name: profile.name, role: "student", password_hash: null })
            .returningAll()
            .executeTakeFirstOrThrow();
          await trx
            .insertInto("oauth_accounts")
            .values({ user_id: created.id, provider: "google", provider_account_id: profile.sub })
            .execute();
          return created;
        });
      }
    }

    if (user.is_suspended) {
      throw new ApiError("FORBIDDEN", "Account suspended");
    }

    const token = signSessionToken({ sub: user.id, role: user.role }, env.JWT_SECRET);
    reply.setCookie(AUTH_COOKIE_NAME, token, authCookieOptions(env.NODE_ENV === "production"));
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    reply.clearCookie(OAUTH_VERIFIER_COOKIE, { path: "/" });

    return reply.redirect(`/dashboard`);
  });
}
