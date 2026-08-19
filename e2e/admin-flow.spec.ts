import { test, expect } from "@playwright/test";

// Smoke test for the auth + admin vertical: the shared login flow lands an
// admin on their dashboard with real data from the API. The full cross-lane
// dependency chain (admin → teacher → student) lives in full-flow.spec.ts,
// added once the teacher and student UIs exist.
test("an admin signs in and sees the user list on the admin dashboard", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
  await expect(page.getByText("admin@example.com")).toBeVisible();
  await expect(page.getByText("Terry Teacher")).toBeVisible();
});

test("an admin can create and delete a teacher group", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();

  await page.getByLabel("New group name").fill("E2E Group");
  await page.getByRole("button", { name: "Add group" }).click();

  await expect(page.getByRole("button", { name: "Delete group" })).toBeVisible();
  await page.getByRole("button", { name: "Delete group" }).click();

  await expect(page.getByRole("button", { name: "Delete group" })).toHaveCount(0);
});
