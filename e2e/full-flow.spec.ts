import { test, expect, type Page } from "@playwright/test";

// Full cross-lane dependency chain, mirroring the demo script in PLANNING.md:
// admin creates teacher + student -> teacher creates class, adds student,
// publishes assignment -> student submits -> teacher grades + gives feedback
// -> student sees grade + feedback. Each run uses fresh accounts (timestamped
// emails) so it's safe to re-run against the same seeded database.

const RUN_ID = Date.now();
const TEACHER_EMAIL = `e2e-teacher-${RUN_ID}@example.com`;
const STUDENT_EMAIL = `e2e-student-${RUN_ID}@example.com`;
const PASSWORD = "password123";
const CLASS_NAME = `E2E Class ${RUN_ID}`;
const ASSIGNMENT_TITLE = `E2E Assignment ${RUN_ID}`;
const SUBMISSION_CONTENT = "This is my completed work for the assignment.";
const SCORE = "95";
const FEEDBACK = "Excellent work, well done.";

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
}

async function createUser(page: Page, name: string, email: string, role: "teacher" | "student") {
  await page.getByLabel("New user name").fill(name);
  await page.getByLabel("New user email").fill(email);
  await page.getByLabel("New user password").fill(PASSWORD);
  await page.getByLabel("New user role").selectOption(role);
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(page.getByText(email)).toBeVisible();
}

test("full app flow: admin creates accounts, teacher publishes and grades, student submits and sees the grade", async ({
  page,
}) => {
  // 1. Admin creates a teacher and a student account.
  await login(page, "admin@example.com", PASSWORD);
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
  await createUser(page, "E2E Teacher", TEACHER_EMAIL, "teacher");
  await createUser(page, "E2E Student", STUDENT_EMAIL, "student");
  await logout(page);

  // 2. Teacher creates a class, adds the student to the roster, and publishes an assignment.
  await login(page, TEACHER_EMAIL, PASSWORD);
  await expect(page.getByRole("heading", { name: "My classes" })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(CLASS_NAME);
  await page.getByRole("button", { name: "Create class" }).click();
  await page.getByRole("main").getByRole("link", { name: CLASS_NAME }).click();
  await expect(page.getByRole("heading", { name: CLASS_NAME })).toBeVisible();

  await page.getByRole("combobox").first().selectOption({ label: `E2E Student (${STUDENT_EMAIL})` });
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();

  await page.getByLabel("Title").fill(ASSIGNMENT_TITLE);
  await page.getByRole("button", { name: "Publish assignment" }).click();
  await expect(page.getByRole("main").getByRole("link", { name: ASSIGNMENT_TITLE })).toBeVisible();
  await logout(page);

  // 3. Student sees the assignment and submits.
  await login(page, STUDENT_EMAIL, PASSWORD);
  await expect(page.getByRole("heading", { name: "My Classes" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: CLASS_NAME }).click();
  await page.getByRole("main").getByRole("link", { name: ASSIGNMENT_TITLE }).click();
  await page.getByLabel("Submission").fill(SUBMISSION_CONTENT);
  await page.getByRole("button", { name: "Submit Assignment" }).click();
  await expect(page.getByRole("button", { name: "Update Submission" })).toBeVisible();
  await logout(page);

  // 4. Teacher grades the submission and gives feedback.
  await login(page, TEACHER_EMAIL, PASSWORD);
  await page.getByRole("main").getByRole("link", { name: CLASS_NAME }).click();
  await page.getByRole("main").getByRole("link", { name: ASSIGNMENT_TITLE }).click();
  await page.getByRole("button", { name: "E2E Student" }).click();
  await page.getByPlaceholder("Score").fill(SCORE);
  await page.getByPlaceholder("Feedback (optional)").fill(FEEDBACK);
  await page.getByRole("button", { name: "Save grade" }).click();
  await expect(page.getByRole("button", { name: "Update grade" })).toBeVisible();
  await logout(page);

  // 5. Student sees the grade and feedback.
  await login(page, STUDENT_EMAIL, PASSWORD);
  await page.getByRole("main").getByRole("link", { name: CLASS_NAME }).click();
  await page.getByRole("main").getByRole("link", { name: ASSIGNMENT_TITLE }).click();
  await expect(page.getByText(`Score: ${SCORE}/100`)).toBeVisible();
  await expect(page.getByText(FEEDBACK)).toBeVisible();
});
