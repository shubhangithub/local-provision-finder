import type {AvailabilityConfirmation} from './directory';
export function confirmationAge(value:string,now=Date.now()){const date=Date.parse(value);if(!Number.isFinite(date))return '';const days=Math.max(0,Math.floor((now-date)/86400000));return days===0?'today':days===1?'yesterday':`${days} days ago`;}
export function availabilityLabel(status:string){return status==='Open'?'Places available':status==='Waiting list'?'Waiting list':'Unavailable';}
export function availabilityCaption(confirmation:AvailabilityConfirmation,now=Date.now()){return `Availability confirmed ${confirmationAge(confirmation.confirmedAt,now)}`;}
