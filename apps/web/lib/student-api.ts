import { apiFetch } from "./api";

export type ClassSummary = { id: string; name: string; description: string | null; teacherName: string };
export type Assignment = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  published: boolean;
  due_at: string | null;
};
export type Submission = { id: string; content: string; submitted_at: string; score: number | null; feedback: string | null };
export type AssignmentDetail = { assignment: Assignment; submission: Submission | null };
export type SubmissionSummary = {
  id: string;
  assignment_id: string;
  assignmentTitle: string;
  className: string;
  score: number | null;
  feedback: string | null;
};
export type AssignmentWithStatus = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  classId: string;
  className: string;
  submissionId: string | null;
  score: number | null;
};

export const studentApi = {
  listClasses: () => apiFetch<{ classes: ClassSummary[] }>("/api/student/classes"),

  listAllAssignments: () => apiFetch<{ assignments: AssignmentWithStatus[] }>("/api/student/assignments"),

  listAssignments: (classId: string) =>
    apiFetch<{ assignments: Assignment[] }>(`/api/student/classes/${classId}/assignments`),

  getAssignment: (assignmentId: string) =>
    apiFetch<AssignmentDetail>(`/api/student/assignments/${assignmentId}`),

  listSubmissions: () => apiFetch<{ submissions: SubmissionSummary[] }>("/api/student/submissions"),

  submit: (assignmentId: string, content: string) =>
    apiFetch<Submission>(`/api/student/assignments/${assignmentId}/submission`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  updateSubmission: (assignmentId: string, content: string) =>
    apiFetch<Submission>(`/api/student/assignments/${assignmentId}/submission`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),
};
