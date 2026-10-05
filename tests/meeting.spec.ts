import { completeStaffSignIn } from './helpers/staff-sign-in';
import { expect, test } from './fixtures';
import { mockMicrophone, mockRealtime, service, type MicState } from './meeting-helpers';

const mic = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { meetingMic: MicState }).meetingMic);
const transcript = [
  [50, { type: 'transcript', itemId: 'a', text: 'I want to get back into work.', final: true }],
  [100, { type: 'transcript', itemId: 'b', text: 'I also need childcare after school.', final: true }],
] as [number, Record<string, unknown>][];

test('meeting is staff-only, shows live words and stops microphone', async ({ page }) => {
  await mockMicrophone(page);
  const requests = await mockRealtime(page, { messages: transcript });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start meeting', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByText('streams the microphone audio to Azure OpenAI', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meeting in progress' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Transcript' })).toContainText('I want to get back into work.');
  await expect(page.getByRole('region', { name: 'Transcript' })).toContainText('childcare after school');
  expect(requests[0]).toContain('staff=true');
  await page.getByRole('button', { name: 'Stop meeting', exact: true }).click();
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download meeting audio' })).toBeVisible();
  expect(await mic(page)).toMatchObject({ stopped: 1, recording: false });
});

test('leaving staff mode releases the microphone and removes transcript', async ({ page }) => {
  await mockMicrophone(page);
  await mockRealtime(page, { messages: transcript });
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meeting in progress' })).toBeVisible();
  await page.getByRole('button', { name: 'Staff demo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Transcript' })).toHaveCount(0);
  expect(await mic(page)).toMatchObject({ stopped: 1, recording: false });
});

test('microphone denial leaves recording off and explains retry', async ({ page }) => {
  await mockMicrophone(page, true);
  await mockRealtime(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was not granted');
  await expect(page.getByRole('button', { name: 'Start meeting', exact: true })).toBeVisible();
  expect(await mic(page)).toMatchObject({ recording: false });
});

test('unavailable live transcription explains why and releases the microphone', async ({ page }) => {
  await mockMicrophone(page);
  await mockRealtime(page, { fail: 'Live transcription needs AZURE_OPENAI_API_KEY in .env.' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('AZURE_OPENAI_API_KEY');
  await expect(page.getByRole('button', { name: 'Start meeting', exact: true })).toBeVisible();
  expect(await mic(page)).toMatchObject({ stopped: 1, recording: false });
});

test('ten-minute limit stops recording automatically', async ({ page }) => {
  await mockMicrophone(page);
  await mockRealtime(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meeting in progress' })).toBeVisible();
  await page.clock.fastForward(600_000);
  await expect(page.getByRole('heading', { name: 'Meeting ended' })).toBeVisible();
  expect(await mic(page)).toMatchObject({ stopped: 1, recording: false });
});

test('live services can be saved or hidden and feed the next-steps report', async ({ page }) => {
  await mockMicrophone(page);
  const concept = { label: 'Childcare support', query: 'after school childcare', results: [service('s1', 'Alpha Club'), service('s2', 'Beta Club')], filtered: { status: 'done', ids: ['s1', 's2'], ms: 900 } };
  await mockRealtime(page, { messages: [...transcript, [150, { type: 'concepts', concepts: [concept] }]] });
  await page.route('**/api/imports/service?id=s1', route => route.fulfill({ json: { record: { publicPhone: '0117 000 1111', publicEmail: 'hello@alpha.example', openingTimes: 'Weekly on Monday from 15:00 to 17:00', referralRoute: 'Self referral', cost: 'Free' } } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();
  await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Childcare support', level: 4 })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Beta Club, not relevant' }).click();
  await expect(page.getByRole('link', { name: /Beta Club/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save Alpha Club' }).click();
  await expect(page.getByRole('button', { name: 'Remove from shortlist Alpha Club' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('lp-directory-saved-v1'))).toContain('s1');
  await page.getByRole('button', { name: 'Stop meeting', exact: true }).click();
  const report = page.getByRole('region', { name: 'Your next steps' });
  await expect(report).toContainText('Contact Alpha Club');
  await expect(report).toContainText('Call 0117 000 1111');
  await expect(report).toContainText('Refer yourself');
  await expect(report).not.toContainText('Beta Club');
  await expect(report.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
  await report.getByRole('button', { name: 'Email these steps' }).click();
  await report.getByRole('button', { name: 'Send email' }).click();
  await expect(report.getByRole('alert')).toContainText('Enter an email address');
  await report.getByLabel('Email address').fill('sam@example.com');
  await report.getByRole('button', { name: 'Send email' }).click();
  await expect(report.getByRole('status')).toContainText('Not sent (prototype)');
});
