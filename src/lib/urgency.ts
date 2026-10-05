import type { DirectoryRecord } from './directory';
export type UrgencyMode = 'auto' | 'today' | 'normal';
export interface UrgencySignal { level: 'today' | 'danger'; reason: string; topic?: 'housing' | 'food' | 'mental-health' }
const rules: {pattern:RegExp; signal:UrgencySignal}[] = [
  {pattern:/\b(?:kill myself|end my life|hurt myself|harm myself|hurt someone|threatening to kill (?:me|us)|immediate danger|overdos(?:e|ed|ing)|cannot keep (?:myself|someone) safe|cant keep (?:myself|someone) safe)\b/,signal:{level:'danger',reason:'Possible immediate danger',topic:'mental-health'}},
  {pattern:/\b(?:suicidal|want to die|mental health crisis)\b/,signal:{level:'today',reason:'Urgent mental health support',topic:'mental-health'}},
  {pattern:/\b(?:nowhere (?:to sleep|to stay)|no (?:safe )?(?:place|somewhere) to (?:sleep|stay)|sleeping (?:rough|outside)|homeless tonight|kicked out|locked out of (?:my|our) home|(?:being )?evicted (?:today|tonight|tomorrow))\b/,signal:{level:'today',reason:'Somewhere safe to stay',topic:'housing'}},
  {pattern:/\b(?:no food|dont have (?:any )?food|do not have (?:any )?food|nothing to eat|cannot afford food|cant afford food|havent eaten|have not eaten|children (?:are )?hungry)\b/,signal:{level:'today',reason:'Food needed',topic:'food'}},
  {pattern:/\b(?:unsafe at home|not safe at home|being threatened|being abused|fleeing (?:abuse|violence))\b/,signal:{level:'today',reason:'Safety at home',topic:'housing'}},
  {pattern:/\b(?:urgent(?:ly)?|asap|need help (?:today|now)|help (?:right now|immediately)|cannot wait|cant wait|(?:need|need help|need support|need somewhere|need food|need accommodation|need housing).{0,45}(?:today|tonight|right now))\b/,signal:{level:'today',reason:'Help needed today'}},
];
/** Transparent signals, not a diagnosis. Negated and historical clauses do not activate them. */
export function detectUrgency(text:string):UrgencySignal|null {
 const normal=text.toLowerCase().replace(/[’']/g,'').replace(/\bcan't\b/g,'cant');
 const clauses=normal.split(/[.!?;\n]|\bbut\b/).filter(clause=>! /\b(?:not urgent|no urgency|not an emergency|no longer|used to|last year|last month|previously|in the past|(?:training|course|research) (?:about|in|on)|dont (?:need|want|plan)|do not (?:need|want|plan)|not (?:going to|planning to)|never|not suicidal|not homeless|not in immediate danger)\b/.test(clause));
 const found=rules.flatMap(rule=>clauses.some(clause=>rule.pattern.test(clause))?[rule.signal]:[]);
 return found.find(signal=>signal.level==='danger')??found[0]??null;
}
export function needsHelpToday(text:string,mode:UrgencyMode='auto'):boolean {return mode==='today'||mode==='auto'&&!!detectUrgency(text);}
export function urgencySearchText(text:string):string {
 const signal=detectUrgency(text);
 if(signal?.topic==='housing')return 'housing homelessness';
 if(signal?.topic==='food')return 'food';
 if(signal?.topic==='mental-health')return 'mental health';
 return text.replace(/\b(?:urgent(?:ly)?|asap|today|tonight|right now|immediately|cannot wait|cant wait)\b/gi,'').replace(/\b(?:i|we|need|help|support|please)\b/gi,'').replace(/\s+/g,' ').trim();
}
export function urgentServiceEvidence(record:DirectoryRecord):string|null {
 const text=[record.name,...(record.categories??[]),...(record.tags??[]),record.description].join('. ');
 const segments=text.split(/[.!?;\n]/);
 const match=segments.find(segment=>/\b(?:crisis (?:support|service|helpline|team)|emergency (?:housing|accommodation|support|food)|same[- ]day (?:support|help|appointments?)|24[- /]?(?:hours?|7)|urgent (?:support|help|care))\b/i.test(segment)&&! /\b(?:not|no|does not|do not|cannot|cant|isnt|is not)\b/i.test(segment));
 return match?.trim().slice(0,250)||null;
}

/** Broader topic vocabulary for an urgent phrase, still restricted to the selected geography. */
export function matchesUrgentTopic(record:DirectoryRecord,text:string):boolean {
 const topic=detectUrgency(text)?.topic;
 const patterns={'housing':/housing|homeless|accommodation|shelter|domestic abuse/i,'food':/food|meals?|hunger|pantry/i,'mental-health':/mental health|crisis|suicid|counsell/i};
 return !!topic&&patterns[topic].test([record.name,...(record.needs??[]),...(record.categories??[]),record.description].join(' '));
}
