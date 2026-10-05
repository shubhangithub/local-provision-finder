import type { AgentContext } from './agent';
export function selectedServiceId(context:AgentContext,route:string):string|null {
 if(context.serviceId)return context.serviceId;
 const match=route.match(/^\/directory\/([^?]+)/);if(!match)return null;
 try{return decodeURIComponent(match[1]);}catch{return null;}
}
export function asksForAlternatives(question:string):boolean {
 return /\b(find|search|show|suggest|recommend|compare)\b.{0,60}\b(similar|other|another|alternatives?)\b/i.test(question)||/^find alternatives$/i.test(question);
}
export function localServiceAnswer(record:Record<string,unknown>,question:string):string {
 const field=(key:string)=>{const value=record[key];return Array.isArray(value)?value.length?value.join(', '):'Not recorded':typeof value==='string'&&value.trim()?value:'Not recorded';};
 const sections:[RegExp,string,string][]=[[/cost|free|pay|price|charge/i,'Cost','cost'],[/referr|self.?refer|access|sign.?up|join/i,'How to access','referralRoute'],[/open|evening|weekend|hours|when/i,'Opening times','openingTimes'],[/eligib|who|child|age/i,'Who it is for','eligibilitySummary'],[/phone|call|contact/i,'Phone','publicPhone'],[/email|contact/i,'Email','publicEmail'],[/where|address|location/i,'Address','address'],[/wheelchair|accessib/i,'Accessibility','accessibility']];
 const overview=/explain|tell me|about|details|more information|what (is|does|can)/i.test(question);
 const relevant=overview?sections:sections.filter(([pattern])=>pattern.test(question));
 const details=relevant.map(([,label,key])=>`${label}: ${field(key)}`);
 const retained=String(record.searchText??'').split(/\n+/).map(line=>line.trim()).filter(Boolean);const terms=question.toLowerCase().match(/[a-z]{4,}/g)??[];
 const excerpt=retained.filter(line=>terms.some(term=>!['this','that','does','with','about','service','support','have'].includes(term)&&line.toLowerCase().includes(term))).slice(0,2).join('\n').slice(0,1800);
 return [`${field('name')}\n${field('provider')}`,overview||!details.length?field('description'):null,...details,!overview&&excerpt?`Retained source information:\n${excerpt}`:null,'This answer uses stored directory information; missing details are not inferred.'].filter(Boolean).join('\n\n');
}
