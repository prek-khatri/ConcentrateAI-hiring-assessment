import { test, expect } from "@playwright/test";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
}

// Smoke test for the auth + admin vertical: the shared login flow lands an
// admin on their dashboard with real data from the API. The full cross-lane
// dependency chain (admin → teacher → student) lives in full-flow.spec.ts,
// added once the teacher and student UIs exist.
test("an admin signs in and sees the user list on the admin dashboard", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText("admin@example.com")).toBeVisible();
  // Scope to the table cell so it isn't confused with a teacher <option> in a group dropdown.
  await expect(page.getByRole("cell", { name: "Terry Teacher" })).toBeVisible();
});

test("an admin can create and delete a teacher group", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Teacher groups" }).click();
  await expect(page.getByRole("heading", { name: "Teacher groups" })).toBeVisible();

  const name = "E2E Temp Group";
  await page.getByLabel("New group name").fill(name);
  await page.getByRole("button", { name: "Add group" }).click();

  // Operate on this specific group's row, robust to any other groups present.
  const groupField = page.getByLabel(`Group name for ${name}`);
  await expect(groupField).toBeVisible();

  const groupItem = page.locator("li").filter({ has: groupField });
  await groupItem.getByRole("button", { name: "Delete group" }).click();

  await expect(page.getByLabel(`Group name for ${name}`)).toHaveCount(0);
});
