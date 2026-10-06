// The staff workspace is a local demo toggle, not authentication. This cookie only remembers that someone signed in,
// so a reload does not ask again. The server never trusts it: staff-only API calls carry their own header.
const name='lp-staff';
const days=30;
export function readStaffSession():boolean {
  try {return document.cookie.split('; ').some(part => part===`${name}=1`);} catch {return false;}
}
export function rememberStaffSession() {
  try {document.cookie=`${name}=1; Max-Age=${days*86400}; Path=/; SameSite=Lax${location.protocol==='https:' ? '; Secure' : ''}`;} catch {/* Staying signed in is optional. */}
}
export function forgetStaffSession() {
  try {document.cookie=`${name}=; Max-Age=0; Path=/; SameSite=Lax`;} catch {/* Nothing to clear. */}
}
