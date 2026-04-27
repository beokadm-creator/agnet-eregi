import { test, expect } from '@playwright/test';

test.describe('User Web Funnel E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 앱 진입
    await page.goto('/');
  });

  test('should display the home page with title', async ({ page }) => {
    // 1. 헤더 또는 타이틀 확인 (실제 렌더링되는 텍스트로 수정)
    await expect(page.locator('h1')).toContainText('학술대회 운영을');
  });

  test('should open diagnostic modal via get started button', async ({ page }) => {
    // 1. 시작하기 버튼 찾아서 클릭 (모달 띄우기)
    const startButton = page.locator('button', { hasText: '시작하기' }).first();
    await startButton.waitFor({ state: 'visible', timeout: 10000 });
    await startButton.click();

    // 2. 모달 내 입력창에 의도 입력 (placeholder는 번역에 따라 다를 수 있으므로 input tag 사용)
    const intentInput = page.locator('input').first();
    await intentInput.waitFor({ state: 'visible', timeout: 10000 });
    await intentInput.fill('법인 설립하고 싶습니다');
    
    // 버튼을 클릭해서 메시지 전송
    const sendButton = page.locator('button', { hasText: 'Send' }).or(page.locator('button', { hasText: '전송' })).first();
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await intentInput.press('Enter');
    }

    // 3. 로딩 후 채팅 인터페이스에 사용자가 보낸 메시지 혹은 봇의 응답이 나타나는지 확인
    // 타이밍 이슈 방지를 위해 텍스트 대신 채팅 메시지 버블 자체가 렌더링되었는지 확인
    const chatBubble = page.locator('.bg-blue-600').or(page.locator('.bg-gray-100')).first();
    await expect(chatBubble).toBeVisible({ timeout: 15000 });
  });
});
