export type VerificationStatus = 'Verified' | 'Review due' | 'Potentially outdated' | 'Expired';
export type Need = 'wellbeing' | 'housing' | 'money' | 'digital' | 'training' | 'childcare' | 'confidence' | 'transport' | 'language' | 'enterprise';
export type PracticalNeed = 'step-free' | 'quiet' | 'captions' | 'school-hours';
export interface Service {
  id: string;
  name: string;
  category: string;
  providerType: string;
  district: string;
  postcodePrefixes: string[];
  distanceMiles: number;
  delivery: string;
  eligibilitySummary: string;
  referralRoute: string;
  lastVerified: string;
  nextReview: string | null;
  status: VerificationStatus;
  availability: string;
  capacity: string;
  accessibility: string[];
  needs: string[];
  ownerRole: string;
  ownerType: string;
  contactStatus: string;
  confidence: number;
  sourceUrl: string;
  publication: 'demo-approved';
  coverageConflict: boolean;
  venueConflict: boolean;
  venue?: string;
  venueCheckedOn?: string;
  endDate?: string;
}
export interface SearchQuery {
  text: string;
  postcode: string;
  radius: number;
  includeRemote: boolean;
  needs: Need[];
  practical: PracticalNeed[];
  providerType: string;
}
export interface ServiceMatch {
  service: Service;
  score: number;
  matchedNeeds: Need[];
  reasons: string[];
  missingPractical: PracticalNeed[];
}
export interface SearchResult {
  matches: ServiceMatch[];
  farther: ServiceMatch[];
  needs: Need[];
  unmetNeeds: Need[];
  urgent: boolean;
}
export interface ProposedChange {
  id: string;
  serviceId: string;
  detectedOn: string;
  sourceType: string;
  field: string;
  oldValue: string;
  newValue: string;
  confidence: string;
  recommendedAction: string;
}
export type DecisionStatus = 'published' | 'rejected' | 'held';
export interface ReviewDecision {
  updateId: string;
  status: DecisionStatus;
  decidedOn: string;
  verified: boolean;
}
