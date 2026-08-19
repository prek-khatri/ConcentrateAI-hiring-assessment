import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SubmitAssignmentSchema = z.object({
  content: z.string().min(1),
});

export const CreateClassSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional().default(null),
});

export const UpdateClassSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
});

export const AddStudentSchema = z.object({
  studentId: z.string().min(1),
});

export const CreateAssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional().default(null),
  dueAt: z.string().datetime().nullable().optional().default(null),
  published: z.boolean().optional().default(false),
});

export const UpdateAssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
  published: z.boolean(),
});

export const GradeSubmissionSchema = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string().nullable().optional().default(null),
});
