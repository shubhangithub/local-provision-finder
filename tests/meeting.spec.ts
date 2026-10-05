import {completeStaffSignIn} from './helpers/staff-sign-in';
import { expect, test } from '@playwright/test';

async function mockMicrophone(page: import('@playwright/test').Page, denied = false) {
  await page.addInitScript(({ denied }) => {
    const state = { requested: 0, stopped: 0, recording: false };
    const cues: string[] = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, speak(utterance: SpeechSynthesisUtterance) { cues.push(utterance.text); } } });
    (window as unknown as { meetingCues: string[] }).meetingCues = cues;
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
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer meeting' })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('Recording started.');
  await expect(page).toHaveURL(/#\/meeting$/);
  await expect(page.getByRole('button', { name: 'Location', exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Find support', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Try sample conversation', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Transcript' })).toContainText('Advisor');
  await expect(page.getByRole('region', { name: 'Transcript' })).toContainText('Thanks for coming');
  await expect(page.getByRole('heading', { name: 'What do you need help with?', exact: true })).not.toBeVisible();
  await expect(page.getByText('Describe it in your own words.', { exact: false })).not.toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingCues: string[] }).meetingCues)).toEqual(['Start recording']);
  await page.clock.install();
  await page.clock.fastForward(20_000);
  const turns = page.locator('.meeting-turn');
  await expect(turns.first().locator('strong')).toHaveText('Advisor');
  await expect(turns.nth(1).locator('strong')).toHaveText('Customer');
  await page.getByRole('button', { name: 'Stop meeting', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { meetingCues: string[] }).meetingCues)).toEqual(['Start recording', 'Recording stopped']);
  await expect(page.locator('.toast')).toContainText('Recording stopped.');
  await expect(page.getByText('Microphone off', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What do you need help with?', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download meeting audio' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { stopped: number; recording: boolean } }).meetingMic)).toMatchObject({ stopped: 1, recording: false });
});

test('leaving staff mode releases the microphone and removes transcript', async ({ page }) => {
  await mockMicrophone(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer meeting' })).toBeVisible();
  await page.getByRole('button', { name: 'Staff demo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Transcript' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { stopped: number; recording: boolean } }).meetingMic)).toMatchObject({ stopped: 1, recording: false });
});

test('microphone denial leaves recording off and explains retry', async ({ page }) => {
  await mockMicrophone(page, true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was not granted');
  await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { recording: boolean } }).meetingMic.recording)).toBe(false);
});

test('ten-minute limit stops recording automatically', async ({ page }) => {
  await mockMicrophone(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer meeting' })).toBeVisible();
  await page.clock.fastForward(600_000);
  await expect(page.getByRole('heading', { name: 'Meeting complete' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { stopped: number; recording: boolean } }).meetingMic)).toMatchObject({ stopped: 1, recording: false });
});


test('time warning allows extension without restarting recording and warns again', async ({ page }) => {
  await mockMicrophone(page);
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer meeting' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Extend by 5 minutes' })).toHaveCount(0);
  await page.clock.fastForward(480_000);
  await expect(page.getByRole('alert')).toContainText('Meeting time is nearly up.');
  await expect(page.getByLabel('Time remaining')).toHaveText('2:00');
  await page.getByRole('button', { name: 'Extend by 5 minutes' }).click();
  await expect(page.getByLabel('Time remaining')).toHaveText('7:00');
  await expect(page.locator('.toast')).toContainText('Meeting extended by 5 minutes.');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.clock.fastForward(120_000);
  await expect(page.getByRole('heading', { name: 'Customer meeting' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { meetingMic: { requested: number; stopped: number; recording: boolean } }).meetingMic)).toMatchObject({requested: 1, stopped: 0, recording: true});
  await page.clock.fastForward(180_000);
  await expect(page.getByRole('alert')).toContainText('Meeting time is nearly up.');
  await page.clock.fastForward(120_000);
  await expect(page.getByRole('heading', { name: 'Meeting complete' })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('Recording stopped. Meeting time ended.');
  await expect(page.getByRole('button', { name: 'Extend by 5 minutes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download meeting audio' })).toBeVisible();
  await page.getByRole('button', { name: 'Start another meeting', exact: true }).click();
  await expect(page.getByLabel('Time remaining')).toHaveText('10:00');
});

test('customer notes surface real provision and editable documents export in all three formats', async ({ page }, testInfo) => {
  await mockMicrophone(page);
  await page.goto('/');
  await page.getByRole('button', {name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);
  await page.getByRole('button', {name:'Start meeting',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Customer meeting',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Search local support'})).toHaveCount(0);
  await page.getByRole('group',{name:'Current speaker'}).getByRole('button',{name:'Advisor',exact:true}).click();
  await page.getByLabel('Add conversation note').fill('We can explore housing support.');
  await page.getByRole('button',{name:'Add note',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'AI assist'})).toContainText('Ready when the customer speaks');
  await page.getByRole('group',{name:'Current speaker'}).getByRole('button',{name:'Customer',exact:true}).click();
  await page.getByLabel('Add conversation note').fill('I feel anxious about interviews and need help with childcare.');
  await page.getByRole('button',{name:'Add note',exact:true}).click();
  const assist=page.getByRole('complementary',{name:'AI assist'});
  await expect(assist.getByLabel('Needs identified')).toContainText('Childcare');
  const provision=assist.locator('.assist-provision').first();
  await expect(provision).toBeVisible({timeout:15000});
  const provisionName=await provision.locator('h3').innerText();
  await provision.getByRole('button',{name:'Add to summary',exact:true}).click();
  await expect(provision.getByRole('button',{name:'Added to summary',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('meeting-workspace.png'),fullPage:true});
  await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
  await page.getByRole('button',{name:'Produce customer summary',exact:true}).click();
  await expect(page).toHaveURL(/#\/meeting\/summary$/);
  await expect(page.getByRole('heading',{name:'Customer meeting summary'})).toBeVisible();
  await expect(page.getByLabel('Provision to explore',{exact:true})).toHaveValue(new RegExp(provisionName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await page.getByLabel('Prepared for',{exact:true}).fill('Alex Example');
  await page.getByLabel('Meeting summary',{exact:true}).fill('We discussed interview confidence and childcare support.');
  await page.getByLabel('Next steps',{exact:true}).fill('1. Contact the provider on Tuesday.\n2. Ask about childcare availability.\n3. Meet with your advisor next week.');
  await page.screenshot({path:testInfo.outputPath('customer-document.png'),fullPage:true});
  const {readFile}=await import('node:fs/promises');
  for(const format of ['PDF','DOCX','PNG']) {
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:`Save as ${format}`,exact:true}).click();
    const download=await pending;
    expect(download.suggestedFilename()).toBe(`customer-meeting-summary.${format.toLowerCase()}`);
    const file=await download.path();expect(file).toBeTruthy();const bytes=await readFile(file!);
    expect(bytes.length).toBeGreaterThan(100);
    if(format==='PDF'){expect(bytes.subarray(0,4).toString()).toBe('%PDF');expect(bytes.toString()).toContain('Alex Example');expect(bytes.toString()).toContain('Contact the provider on Tuesday.');}
    if(format==='DOCX'){expect(bytes.subarray(0,2).toString()).toBe('PK');const {unzipSync,strFromU8}=await import('fflate');const xml=strFromU8(unzipSync(bytes)['word/document.xml']);expect(xml).toContain('Alex Example');expect(xml).toContain('Contact the provider on Tuesday.');}
    if(format==='PNG'){expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBe(1588);expect(bytes.readUInt32BE(20)).toBeGreaterThan(1800);}
  }
  await page.getByRole('button',{name:'Back to meeting',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Meeting complete'})).toBeVisible();
  await page.getByRole('button',{name:'Produce customer summary',exact:true}).click();
  await expect(page.getByLabel('Meeting summary',{exact:true})).toHaveValue('We discussed interview confidence and childcare support.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('live customer speech updates assistance before a sentence is final',async({page})=>{
  await mockMicrophone(page);
  await page.addInitScript(()=>{
    type Event={resultIndex:number;results:{length:number;[index:number]:{isFinal:boolean;[index:number]:{transcript:string}}}};
    class Recognition {
      continuous=false;interimResults=false;lang='';onresult:((event:Event)=>void)|null=null;onerror:null=null;onend:(()=>void)|null=null;
      start(){(window as unknown as {emitMeetingSpeech:(text:string,final:boolean)=>void}).emitMeetingSpeech=(text,final)=>this.onresult?.({resultIndex:0,results:{length:1,0:{isFinal:final,0:{transcript:text}}}});}
      abort(){this.onend?.();}stop(){this.onend?.();}
    }
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:Recognition});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);
  await page.getByRole('button',{name:'Start meeting',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Customer meeting'})).toBeVisible();
  await page.evaluate(()=>(window as unknown as {emitMeetingSpeech:(text:string,final:boolean)=>void}).emitMeetingSpeech('I need childcare',false));
  await expect(page.locator('.meeting-turn.interim')).toContainText('I need childcare');
  await expect(page.getByLabel('Needs identified')).toContainText('Childcare');
  await page.evaluate(()=>(window as unknown as {emitMeetingSpeech:(text:string,final:boolean)=>void}).emitMeetingSpeech('I need childcare after school.',true));
  await expect(page.locator('.meeting-turn:not(.interim)')).toContainText('I need childcare after school.');
  await expect(page.locator('.meeting-turn.interim')).toHaveCount(0);
  await page.getByRole('button',{name:'Stop meeting',exact:true}).click();
  await page.getByRole('button',{name:'Produce customer summary',exact:true}).click();
  await expect(page.getByLabel('Meeting summary',{exact:true})).toHaveValue(/childcare after school/);
});

test('opening the summary page does not start a hidden recording',async({page})=>{
 await mockMicrophone(page);await page.goto('/');await page.getByRole('button',{name:'Staff sign in',exact:true}).click();await completeStaffSignIn(page);
 await page.evaluate(()=>{location.hash='/meeting/summary';});
 await expect(page.getByRole('heading',{name:'No meeting summary yet',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as unknown as {meetingMic:{requested:number}}).meetingMic.requested)).toBe(0);
});

test('recording hides the transcript until asked, and the transcript returns after the meeting', async ({ page }) => {
  await mockMicrophone(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Staff sign in', exact: true }).click();await completeStaffSignIn(page);
  await page.getByRole('button', { name: 'Start meeting', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer meeting' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Transcript' })).toHaveCount(0);
  await expect(page.getByText('words captured')).toBeVisible();
  await expect(page.getByLabel('Add conversation note')).toBeVisible();
  await page.getByRole('button', { name: 'Show transcript', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Transcript' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide transcript', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Transcript' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop meeting', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Transcript' })).toBeVisible();
});
