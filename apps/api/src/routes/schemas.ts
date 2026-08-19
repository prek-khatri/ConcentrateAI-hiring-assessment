import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SubmitAssignmentSchema = z.object({
  content: z.string().min(1),
});
