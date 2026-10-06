export const feedbackFields = {
  name:'Service name', publicPhone:'Phone number', publicEmail:'Email address', url:'Website',
  address:'Address', postcode:'Postcode', openingTimes:'Opening times', cost:'Cost',
  eligibilitySummary:'Who can use the service', availability:'Availability', description:'Service description',
} as const;
export type FeedbackField = keyof typeof feedbackFields;
export type FeedbackStatus = 'pending' | 'checking' | 'resolved' | 'dismissed';
export interface FeedbackAnswers {
  upToDate: 'yes' | 'changed' | 'unsure';
  availability?: 'open' | 'waiting' | 'closed' | 'unsure';
  contact?: 'yes' | 'no' | 'not-tried';
  recommendation?: 'yes' | 'no' | 'not-tried';
  location?: 'yes' | 'no' | 'not-tried';
  issues: FeedbackField[];
}
/** A change a follow-up call suggested, ready for one-click apply. Only the server creates these. */
export interface ProposedChange {field:FeedbackField;value:string;previous:string;quote:string;source:'follow-up'}
export interface FeedbackEntry {
  proposed?:ProposedChange;
  id:string;serviceId:string;serviceName:string;createdAt:string;status:FeedbackStatus;
  answers:FeedbackAnswers;note:string;review?: {action:string;note:string;reviewedAt:string;field?:FeedbackField;previousValue?:string;newValue?:string};
}
export const answerLabels: Record<string,string> = {
  yes:'Yes',changed:'Some details have changed',unsure:'Not sure',open:'Open to new enquiries',
  waiting:'Waiting list',closed:'Unavailable or closed',no:'No','not-tried':'Have not tried',
};
