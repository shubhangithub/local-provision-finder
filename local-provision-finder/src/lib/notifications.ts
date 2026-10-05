export interface ServiceReminder {id:string;name:string;reason:'viewed' | 'recommended';createdAt:string;snoozedUntil?:string}
const key='lp-service-reminders-v1';
export function readReminders():ServiceReminder[] {
  try {const value=JSON.parse(localStorage.getItem(key) ?? '[]');return Array.isArray(value) ? value.filter(item => typeof item.id==='string' && typeof item.name==='string' && ['viewed','recommended'].includes(item.reason) && typeof item.createdAt==='string').slice(0,20) : [];} catch {return [];}
}
function write(reminders:ServiceReminder[]) {try {localStorage.setItem(key,JSON.stringify(reminders));} catch {/* Reminders are optional. */}window.dispatchEvent(new Event('service-reminders-changed'));}
export function rememberService(id:string,name:string,reason:ServiceReminder['reason']) {
  const previous=readReminders();const found=previous.find(item => item.id===id);
  // Recommending an already-viewed service must not reset its reminder or snooze.
  if (found && reason==='recommended') return;
  write([{id,name,reason,createdAt:new Date().toISOString(),snoozedUntil:found?.snoozedUntil},...previous.filter(item => item.id!==id)].slice(0,20));
}
export function dismissReminder(id:string) {write(readReminders().filter(item => item.id!==id));}
export function snoozeReminder(id:string) {write(readReminders().map(item => item.id===id ? {...item,snoozedUntil:new Date(Date.now()+7*86400000).toISOString()} : item));}
