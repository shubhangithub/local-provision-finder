export interface ServiceReminder {id:string;name:string;reason:'viewed' | 'recommended';createdAt:string;snoozedUntil?:string}
const key='lp-service-reminders-v1';
export function readReminders():ServiceReminder[] {
  try {const value=JSON.parse(localStorage.getItem(key) ?? '[]');return Array.isArray(value) ? value.filter(item => item && typeof item.id==='string' && typeof item.name==='string' && ['viewed','recommended'].includes(item.reason) && typeof item.createdAt==='string').slice(0,20) : [];} catch {return [];}
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

export interface ServiceNotification {id:string;title:string;body:string;route:string;createdAt:string;serviceId:string;kind:'information-updated' | 'saved'}
const messagesKey='lp-service-notifications-v1';
export function readNotifications():ServiceNotification[] {
  try {
    const value:unknown=JSON.parse(localStorage.getItem(messagesKey) ?? '[]');
    return Array.isArray(value) ? value.filter((item):item is ServiceNotification => !!item && typeof item==='object' && typeof item.id==='string' && typeof item.title==='string' && typeof item.body==='string' && typeof item.createdAt==='string' && typeof item.serviceId==='string' && typeof item.route==='string' && item.route.startsWith('/directory/') && ['information-updated','saved'].includes(item.kind)).slice(0,20) : [];
  } catch {return [];}
}
function writeNotifications(messages:ServiceNotification[]) {
  try {localStorage.setItem(messagesKey,JSON.stringify(messages));} catch {/* Notifications are optional. */}
  window.dispatchEvent(new Event('service-notifications-changed'));
}
/** Call only after a successful checked correction. Field is its human-readable label. */
export function notifyServiceUpdated(id:string,name:string,field:string):void {
  const notification:ServiceNotification={id:`update-${id}-${Date.now()}`,serviceId:id,kind:'information-updated',title:'Information updated',body:`${name}: ${field} has been checked and updated.`,route:`/directory/${encodeURIComponent(id)}`,createdAt:new Date().toISOString()};
  writeNotifications([notification,...readNotifications()].slice(0,20));
}
/** Call after a service has actually been added to the shortlist, never after removal. */
export function notifySaved(id:string,name:string):void {
  const notification:ServiceNotification={id:`saved-${id}`,serviceId:id,kind:'saved',title:'Added to your shortlist',body:`${name} is saved in this browser.`,route:`/directory/${encodeURIComponent(id)}`,createdAt:new Date().toISOString()};
  writeNotifications([notification,...readNotifications().filter(item => item.id!==notification.id)].slice(0,20));
}
export function dismissNotification(id:string):void {writeNotifications(readNotifications().filter(item => item.id!==id));}
