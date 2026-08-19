import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SubmitAssignmentSchema = z.object({
  content: z.string().min(1),
});

export const ChatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

const RoleSchema = z.enum(["admin", "teacher", "student"]);

export const ListUsersQuerySchema = z.object({
  role: RoleSchema.optional(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleSchema,
  password: z.string().min(8),
});

export const UpdateUserSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    role: RoleSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const GroupSchema = z.object({
  name: z.string().min(1),
});

export const AddGroupMemberSchema = z.object({
  teacherId: z.string().uuid(),
});
