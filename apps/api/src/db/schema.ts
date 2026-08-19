import type { Generated } from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string | null;
  name: string;
  role: "admin" | "teacher" | "student";
  is_suspended: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface OAuthAccountsTable {
  id: Generated<string>;
  user_id: string;
  provider: string;
  provider_account_id: string;
  created_at: Generated<Date>;
}

export interface TeacherGroupsTable {
  id: Generated<string>;
  name: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TeacherGroupMembersTable {
  teacher_group_id: string;
  teacher_id: string;
}

export interface ClassesTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  teacher_id: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ClassStudentsTable {
  class_id: string;
  student_id: string;
  created_at: Generated<Date>;
}

export interface AssignmentsTable {
  id: Generated<string>;
  class_id: string;
  title: string;
  description: string | null;
  published: Generated<boolean>;
  due_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SubmissionsTable {
  id: Generated<string>;
  assignment_id: string;
  student_id: string;
  content: string;
  submitted_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface GradesTable {
  id: Generated<string>;
  submission_id: string;
  score: number;
  feedback: string | null;
  graded_at: Generated<Date>;
  graded_by: string;
}

export interface DB {
  users: UsersTable;
  oauth_accounts: OAuthAccountsTable;
  teacher_groups: TeacherGroupsTable;
  teacher_group_members: TeacherGroupMembersTable;
  classes: ClassesTable;
  class_students: ClassStudentsTable;
  assignments: AssignmentsTable;
  submissions: SubmissionsTable;
  grades: GradesTable;
}
