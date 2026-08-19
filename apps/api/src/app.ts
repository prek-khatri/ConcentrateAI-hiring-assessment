import Fastify, { type FastifyInstance, type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { ApiError } from "./errors.js";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { studentRoutes } from "./routes/student.js";
import { chatRoutes } from "./routes/chat.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cookie);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send(err.toJSON());
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: err.issues.map((i) => i.message).join("; ") },
      });
    }
    // Fastify's own request-parsing errors (bad JSON, wrong content-type, etc.) carry a
    // client-facing statusCode < 500 — surface those as VALIDATION_ERROR instead of masking
    // a client bug as a server crash.
    const fastifyErr = err as FastifyError;
    if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode < 500) {
      return reply
        .status(fastifyErr.statusCode)
        .send({ error: { code: "VALIDATION_ERROR", message: fastifyErr.message } });
    }
    app.log.error(err);
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes);
  await app.register(studentRoutes);
  await app.register(chatRoutes);

  return app;
}
