import { test, expect } from '@playwright/test';

test.describe('Partner Console Core E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display token input on initial load', async ({ page }) => {
    // 1. 인증 토큰을 입력받는 화면인지 확인 (타이틀이 '파트너 토큰' 같은 한글일 수 있으므로 input의 존재로 검증)
    const tokenInput = page.getByRole('textbox').first();
    await expect(tokenInput).toBeVisible({ timeout: 10000 });
  });

  test('should render dashboard layout if token is provided', async ({ page }) => {
    // 테스트용 mock JWT 세팅
    const tokenInput = page.getByRole('textbox').first();
    await tokenInput.waitFor({ state: 'visible', timeout: 10000 });
    await tokenInput.fill('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJtb2NrLXVzZXIiLCJwYXJ0bmVySWQiOiJtb2NrLXBhcnRuZXIifQ.mock-signature');
    
    // 버튼 이름이 '적용' 혹은 'Apply'
    const applyButton = page.locator('button').first(); // 보통 버튼이 하나뿐이므로
    await applyButton.click();

    // 토큰이 입력된 후 왼쪽 사이드바(Dashboard 영역)가 로딩되는지 확인
    // 페이지 어딘가에 나타날 텍스트
    const sidebarElement = page.getByText(/조직 관리|워크보드|새로고침|알림 설정/).first();
    await expect(sidebarElement).toBeVisible({ timeout: 15000 });
  });
});
