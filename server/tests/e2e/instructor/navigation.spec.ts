import { test, expect } from '@playwright/test';
import { instructorJWT } from '../helpers';

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: 'jwt',
      value: instructorJWT,
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: true,
    },
  ]);
});

test('navigation', async ({ page }) => {
  await page.goto('http://localhost:7071/app');
  await expect(page).toHaveURL('http://localhost:7071/app/topic-list');

  await expect(
    page.getByRole('link', { name: 'Preference list' }),
  ).not.toBeVisible();
  await expect(page.getByRole('link', { name: 'Topic list' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Instructor' })).toBeVisible();

  await page.getByRole('link', { name: 'Instructor' }).click();
  await expect(page).toHaveURL(
    'http://localhost:7071/app/instructor/own-topics',
  );

  await expect(page.getByRole('link', { name: 'Own topics' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Assigned students' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Assigned students' }).click();
  await expect(page).toHaveURL(
    'http://localhost:7071/app/instructor/assigned-students',
  );

  await page.goto('http://localhost:7071/app/preferences');
  await expect(page).toHaveURL('http://localhost:7071/app/topic-list');

  await page.goto('http://localhost:7071/app/non-existing-page');
  await expect(page).toHaveURL('http://localhost:7071/app/topic-list');
});
