import { expect, test } from '@playwright/test';

test.describe('Ops Console Smoke E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render core controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Ops Console' })).toBeVisible();

    await expect(page.getByLabel('Gate Key')).toBeVisible();
    await expect(page.getByLabel('Summary Date')).toBeVisible();
    await expect(page.getByPlaceholder('case id for troubleshooting')).toBeVisible();

    await expect(page.getByRole('button', { name: '익명 로그인' })).toBeVisible();
    await expect(page.getByRole('button', { name: '일일 Gate 요약' })).toBeVisible();
  });

  test('should enable case actions only when case id is provided', async ({ page }) => {
    const caseDetailButton = page.getByRole('button', { name: '케이스 상세' });
    const regenerateButton = page.getByRole('button', { name: '패키지 재생성' });

    await expect(caseDetailButton).toBeDisabled();
    await expect(regenerateButton).toBeDisabled();

    await page.getByPlaceholder('case id for troubleshooting').fill('case_mock_1');

    await expect(caseDetailButton).toBeEnabled();
    await expect(regenerateButton).toBeEnabled();
  });
});
