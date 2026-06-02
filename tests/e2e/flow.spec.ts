/**
 * Golden-path E2E test suite for the full Depo user flow.
 *
 * **Prerequisites** — these tests are destructive and skipped by default.
 * Set the following environment variables to enable them:
 *
 * - `TEST_SESSION_COOKIE` — an encrypted `depo_session` iron-session cookie
 *   value belonging to a real GitHub test account. Generate one by signing in
 *   through the app in a browser and copying the cookie value.
 * - `TEST_REPO_NAME` — the short name (not `owner/repo`) of a public
 *   repository in the test account that can be safely deleted. The repository
 *   must exist before the suite runs. The deletion test is skipped unless both
 *   variables are set.
 *
 * **Why skipped in CI by default?**  The tests require real GitHub credentials
 * and a disposable repository. They are intended for manual pre-release
 * validation, not for automated CI on every pull request.
 */

import { test, expect } from '@playwright/test'

const HAS_E2E = !!(process.env.TEST_SESSION_COOKIE && process.env.TEST_REPO_NAME)

test.describe('Full Depo flow (E2E)', () => {
  test.skip(!HAS_E2E, 'E2E credentials not configured — set TEST_SESSION_COOKIE and TEST_REPO_NAME')

  test.use({
    storageState: {
      cookies: [
        {
          name: 'depo_session',
          value: process.env.TEST_SESSION_COOKIE ?? '',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  })

  test('landing page redirects authenticated user to /repos', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/repos')
  })

  test('repos page loads and shows the repo list', async ({ page }) => {
    await page.goto('/repos')
    await expect(page.getByRole('heading', { name: /your repositories/i })).toBeVisible()
    await expect(page.locator('ul li').first()).toBeVisible()
  })

  test('selecting a repo and clicking Continue navigates to /confirm', async ({ page }) => {
    await page.goto('/repos')
    const firstRow = page.locator('ul li').first()
    await firstRow.click()
    await expect(page.getByText(/1 selected/i)).toBeVisible()
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page).toHaveURL('/confirm')
  })

  test('/confirm shows the selected repo and ConfirmGate', async ({ page }) => {
    const repoName = process.env['TEST_REPO_NAME'] ?? ''
    await page.goto('/repos')
    await page.evaluate((name: string) => {
      sessionStorage.setItem('depo:selected', JSON.stringify([name]))
    }, repoName)
    await page.goto('/confirm')
    await expect(page.getByRole('heading')).toContainText('1 repository')
    await expect(page.locator('[data-testid=confirm-gate], input[placeholder]')).toBeVisible()
  })

  test('sign out clears session and redirects to /', async ({ page }) => {
    await page.goto('/repos')
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: /sign in with github/i })).toBeVisible()
  })
})

test.describe('Landing page (unauthenticated)', () => {
  test('shows the headline and sign-in link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Delete repos in bulk')
    await expect(page.getByRole('link', { name: /sign in with github/i })).toBeVisible()
  })

  test('shows auth_failed error when navigating with ?error=auth_failed', async ({ page }) => {
    await page.goto('/?error=auth_failed')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(/sign-in failed/i)
  })

  test('shows session_expired error when navigating with ?error=session_expired', async ({ page }) => {
    await page.goto('/?error=session_expired')
    await expect(page.getByRole('alert')).toContainText(/session expired/i)
  })
})
