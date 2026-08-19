import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { buildContextForUser, askChatbot } from "../services/chat.service.js";
import { ChatMessageSchema } from "./schemas.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/chat", { preHandler: requireAuth }, async (request) => {
    const { message } = ChatMessageSchema.parse(request.body);
    const context = await buildContextForUser(db, request.user);
    const reply = await askChatbot(context, message);
    return { reply };
  });
}
