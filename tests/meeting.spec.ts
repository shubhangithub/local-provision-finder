import { expect, test } from '@playwright/test';

async function mockMicrophone(page: import('@playwright/test').Page, denied = false) {
  await page.addInitScript(({ denied }) => {
    const state = { requested: 0, stopped: 0, recording: false };
    (window as unknown as { meetingMic: typeof state }).meetingMic = state;
    const audio = { getTracks: () => [{ stop: () => { state.stopped++; } }] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => { state.requested++; if (denied) throw new DOMException('Denied', 'NotAllowedError'); return audio; },
    } });
    class Recorder {
      state = 'inactive'; mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() { this.state = 'recording'; state.recording = true; }
      stop() { this.state = 'inactive'; state.recording = false; this.ondataavailable?.({ data: new Blob(['demo audio']) }); window.setTimeout(() => this.onstop?.(), 0); }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: Recorder });
  }, { denied });
}

test('meeting is staff-only, simulates words and stops microphone', async ({ page }) => {
  await mockMicrophone(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start meeting', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meeting in progress' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulated transcript' })).toContainText('Adviser:');
  await expect(page.getByRole('region', { name: 'Simulated transcript' })).toContainText('Thanks for coming');
  await expect(page.getByText('The transcript below is simulated', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Stop meeting', exact: true }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download meeting audio' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { stopped: number; recording: boolean } }).meetingMic)).toMatchObject({ stopped: 1, recording: false });
});

test('leaving staff mode releases the microphone and removes transcript', async ({ page }) => {
  await mockMicrophone(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meeting in progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Staff demo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Simulated transcript' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { stopped: number; recording: boolean } }).meetingMic)).toMatchObject({ stopped: 1, recording: false });
});

test('microphone denial leaves recording off and explains retry', async ({ page }) => {
  await mockMicrophone(page, true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was not granted');
  await expect(page.getByRole('button', { name: 'Start meeting', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { recording: boolean } }).meetingMic.recording)).toBe(false);
});

test('ten-minute limit stops recording automatically', async ({ page }) => {
  await mockMicrophone(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meeting in progress' })).toBeVisible();
  await page.clock.fastForward(600_000);
  await expect(page.getByRole('heading', { name: 'Meeting ended' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { stopped: number; recording: boolean } }).meetingMic)).toMatchObject({ stopped: 1, recording: false });
});
