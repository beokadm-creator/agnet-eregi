import { test, expect } from '@playwright/test';

test.describe('User Web Funnel E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 앱 진입
    await page.goto('/');
  });

  test('should display the home page with title', async ({ page }) => {
    await expect(page.getByText('AgentRegi').first()).toBeVisible();
    await expect(page.locator('h1')).toContainText('복잡한 행정·법률 업무');
    await expect(page.getByRole('button', { name: /게스트로 바로 체험하기/ })).toBeVisible();
  });

  test('should render the authenticated funnel shell when token is provided', async ({ page }) => {
    await page.getByPlaceholder('Firebase Auth Token').fill('mock-user-token');
    await page.getByRole('button', { name: '토큰으로 진입' }).click();

    await expect(page.getByRole('heading', { name: /AgentRegi 사용자 콘솔|AgentRegi User Console/ })).toBeVisible();
    await expect(page.getByPlaceholder(/임원 변경 등기|register a change/)).toBeVisible();
    await expect(page.getByRole('button', { name: /인증 및 데이터 로드|Auth & Load Data/ })).toBeVisible();
  });
});
