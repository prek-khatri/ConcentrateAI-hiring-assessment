import type { Kysely } from "kysely";
import type { DB } from "../db/schema.js";
import { ApiError } from "../errors.js";
import { hashPassword } from "../auth/password.js";
import type { Role } from "../auth/jwt.js";

// Never select password_hash — admin responses must not leak it.
const USER_FIELDS = ["id", "email", "name", "role", "is_suspended", "created_at", "updated_at"] as const;

// Postgres/Kysely throw error objects carrying a SQLSTATE `code`; read it directly.
function pgCode(err: unknown): string | undefined {
  return (err as { code?: string }).code;
}

export function createAdminService(db: Kysely<DB>) {
  return {
    async listUsers(role?: Role) {
      let q = db.selectFrom("users").select(USER_FIELDS).orderBy("created_at", "asc");
      if (role) {
        q = q.where("role", "=", role);
      }
      return q.execute();
    },

    async createUser(input: { email: string; name: string; role: Role; password: string }) {
      const password_hash = await hashPassword(input.password);
      try {
        return await db
          .insertInto("users")
          .values({ email: input.email, name: input.name, role: input.role, password_hash })
          .returning(USER_FIELDS)
          .executeTakeFirstOrThrow();
      } catch (err) {
        if (pgCode(err) === "23505") {
          throw new ApiError("CONFLICT", "Email already in use");
        }
        throw err;
      }
    },

    async updateUser(id: string, patch: { email?: string; name?: string; role?: Role }) {
      try {
        const updated = await db
          .updateTable("users")
          .set({ ...patch, updated_at: new Date() })
          .where("id", "=", id)
          .returning(USER_FIELDS)
          .executeTakeFirst();
        if (!updated) {
          throw new ApiError("NOT_FOUND", "User not found");
        }
        return updated;
      } catch (err) {
        if (pgCode(err) === "23505") {
          throw new ApiError("CONFLICT", "Email already in use");
        }
        throw err;
      }
    },

    async setSuspended(id: string, isSuspended: boolean) {
      const updated = await db
        .updateTable("users")
        .set({ is_suspended: isSuspended, updated_at: new Date() })
        .where("id", "=", id)
        .returning(USER_FIELDS)
        .executeTakeFirst();
      if (!updated) {
        throw new ApiError("NOT_FOUND", "User not found");
      }
      return updated;
    },

    async deleteUser(id: string) {
      try {
        const res = await db.deleteFrom("users").where("id", "=", id).executeTakeFirstOrThrow();
        if (res.numDeletedRows === 0n) {
          throw new ApiError("NOT_FOUND", "User not found");
        }
      } catch (err) {
        if (pgCode(err) === "23503") {
          throw new ApiError("CONFLICT", "User still owns classes, submissions, or grades");
        }
        throw err;
      }
    },

    async listGroups() {
      return db.selectFrom("teacher_groups").selectAll().orderBy("created_at", "asc").execute();
    },

    async getGroup(id: string) {
      const group = await db.selectFrom("teacher_groups").selectAll().where("id", "=", id).executeTakeFirst();
      if (!group) {
        throw new ApiError("NOT_FOUND", "Group not found");
      }
      const members = await db
        .selectFrom("teacher_group_members")
        .innerJoin("users", "users.id", "teacher_group_members.teacher_id")
        .select(["users.id", "users.name", "users.email"])
        .where("teacher_group_members.teacher_group_id", "=", id)
        .execute();
      return { ...group, members };
    },

    async createGroup(name: string) {
      return db.insertInto("teacher_groups").values({ name }).returningAll().executeTakeFirstOrThrow();
    },

    async renameGroup(id: string, name: string) {
      const updated = await db
        .updateTable("teacher_groups")
        .set({ name, updated_at: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      if (!updated) {
        throw new ApiError("NOT_FOUND", "Group not found");
      }
      return updated;
    },

    async deleteGroup(id: string) {
      const res = await db.deleteFrom("teacher_groups").where("id", "=", id).executeTakeFirstOrThrow();
      if (res.numDeletedRows === 0n) {
        throw new ApiError("NOT_FOUND", "Group not found");
      }
    },

    async addGroupMember(groupId: string, teacherId: string) {
      const group = await db.selectFrom("teacher_groups").select("id").where("id", "=", groupId).executeTakeFirst();
      if (!group) {
        throw new ApiError("NOT_FOUND", "Group not found");
      }
      const teacher = await db
        .selectFrom("users")
        .select(["id", "role"])
        .where("id", "=", teacherId)
        .executeTakeFirst();
      if (!teacher || teacher.role !== "teacher") {
        throw new ApiError("VALIDATION_ERROR", "User is not a teacher");
      }
      await db
        .insertInto("teacher_group_members")
        .values({ teacher_group_id: groupId, teacher_id: teacherId })
        .onConflict((oc) => oc.columns(["teacher_group_id", "teacher_id"]).doNothing())
        .execute();
      return this.getGroup(groupId);
    },

    async removeGroupMember(groupId: string, teacherId: string) {
      const res = await db
        .deleteFrom("teacher_group_members")
        .where("teacher_group_id", "=", groupId)
        .where("teacher_id", "=", teacherId)
        .executeTakeFirstOrThrow();
      if (res.numDeletedRows === 0n) {
        throw new ApiError("NOT_FOUND", "Membership not found");
      }
    },
  };
}
