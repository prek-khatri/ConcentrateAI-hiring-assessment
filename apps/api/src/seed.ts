import { db } from "./db/index.js";
import { hashPassword } from "./auth/password.js";

const PASSWORD = "password123";

const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const TEACHER_ID = "00000000-0000-0000-0000-000000000002";
const TEACHER2_ID = "00000000-0000-0000-0000-000000000003";
const STUDENT_ID = "00000000-0000-0000-0000-000000000004";
const STUDENT2_ID = "00000000-0000-0000-0000-000000000005";
const STUDENT3_ID = "00000000-0000-0000-0000-000000000006";
const CLASS_ID = "00000000-0000-0000-0000-000000000010";
const ASSIGNMENT_PUBLISHED_ID = "00000000-0000-0000-0000-000000000020";
const ASSIGNMENT_DRAFT_ID = "00000000-0000-0000-0000-000000000021";
const SUBMISSION_ID = "00000000-0000-0000-0000-000000000030";
const GRADE_ID = "00000000-0000-0000-0000-000000000040";

async function seed(): Promise<void> {
  const passwordHash = await hashPassword(PASSWORD);

  await db
    .insertInto("users")
    .values([
      { id: ADMIN_ID, email: "admin@example.com", name: "Ada Admin", role: "admin", password_hash: passwordHash },
      {
        id: TEACHER_ID,
        email: "teacher@example.com",
        name: "Terry Teacher",
        role: "teacher",
        password_hash: passwordHash,
      },
      {
        id: TEACHER2_ID,
        email: "teacher2@example.com",
        name: "Tess Teacher",
        role: "teacher",
        password_hash: passwordHash,
      },
      {
        id: STUDENT_ID,
        email: "student@example.com",
        name: "Sam Student",
        role: "student",
        password_hash: passwordHash,
      },
      {
        id: STUDENT2_ID,
        email: "student2@example.com",
        name: "Sasha Student",
        role: "student",
        password_hash: passwordHash,
      },
      {
        id: STUDENT3_ID,
        email: "student3@example.com",
        name: "Sunny Student",
        role: "student",
        password_hash: passwordHash,
      },
    ])
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await db
    .insertInto("classes")
    .values({ id: CLASS_ID, name: "Biology 101", description: "Intro to Biology", teacher_id: TEACHER_ID })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await db
    .insertInto("class_students")
    .values([
      { class_id: CLASS_ID, student_id: STUDENT_ID },
      { class_id: CLASS_ID, student_id: STUDENT2_ID },
      { class_id: CLASS_ID, student_id: STUDENT3_ID },
    ])
    .onConflict((oc) => oc.columns(["class_id", "student_id"]).doNothing())
    .execute();

  const pastDue = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3);
  await db
    .insertInto("assignments")
    .values([
      {
        id: ASSIGNMENT_PUBLISHED_ID,
        class_id: CLASS_ID,
        title: "Cell Structure",
        description: "Describe the parts of a eukaryotic cell.",
        published: true,
        due_at: pastDue,
      },
      {
        id: ASSIGNMENT_DRAFT_ID,
        class_id: CLASS_ID,
        title: "Photosynthesis",
        description: "Explain the light and dark reactions.",
        published: false,
        due_at: null,
      },
    ])
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await db
    .insertInto("submissions")
    .values({
      id: SUBMISSION_ID,
      assignment_id: ASSIGNMENT_PUBLISHED_ID,
      student_id: STUDENT_ID,
      content: "A eukaryotic cell has a nucleus, mitochondria, and endoplasmic reticulum.",
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  await db
    .insertInto("grades")
    .values({
      id: GRADE_ID,
      submission_id: SUBMISSION_ID,
      score: 92,
      feedback: "Excellent explanation of mitochondria.",
      graded_by: TEACHER_ID,
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();

  console.log("Seed complete.");
  await db.destroy();
}

seed();
