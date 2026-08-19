import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import { AUTH_COOKIE_NAME, verifySessionToken, type Role } from "./jwt.js";

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

declare module "fastify" {
  interface FastifyRequest {
    user: AuthedUser;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = request.cookies[AUTH_COOKIE_NAME];
  if (!token) {
    throw new ApiError("UNAUTHORIZED", "Not authenticated");
  }

  let payload;
  try {
    payload = verifySessionToken(token, env.JWT_SECRET);
  } catch {
    throw new ApiError("UNAUTHORIZED", "Invalid or expired session");
  }

  const user = await db.selectFrom("users").selectAll().where("id", "=", payload.sub).executeTakeFirst();
  if (!user) {
    throw new ApiError("UNAUTHORIZED", "User not found");
  }
  if (user.is_suspended) {
    throw new ApiError("FORBIDDEN", "Account suspended");
  }

  request.user = { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user.role)) {
      throw new ApiError("FORBIDDEN", `Requires role: ${roles.join(" or ")}`);
    }
  };
}
