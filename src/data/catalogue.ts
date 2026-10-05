import workbook from './workbook.json';
import type { ProposedChange, Service, VerificationStatus } from '../types';

const split = (value: string) => value.split(';').map(v => v.trim()).filter(Boolean);

// An explicit prototype-only publication assumption. The workbook does not
// include vetting decisions. No real public approval or link check is implied.
export const catalogue: Service[] = workbook['Provision Catalogue'].map(row => {
  const owner = workbook['Ownership Verification'].find(o => o.Owner_ID === row.Owner_ID);
  const cases = workbook['Data Quality Cases'].filter(c => c.Provision_ID === row.Provision_ID);
  return {
    id: row.Provision_ID,
    name: row.Service_Name,
    category: row.Category,
    providerType: row.Provider_Type,
    district: row.District,
    postcodePrefixes: split(row.Postcode_Prefixes),
    distanceMiles: row.Distance_Miles,
    delivery: row.Delivery,
    eligibilitySummary: row.Eligibility_Summary,
    referralRoute: row.Referral_Route,
    lastVerified: row.Last_Verified,
    nextReview: owner?.Next_Review ?? null,
    status: row.Verification_Status as VerificationStatus,
    availability: row.Availability,
    capacity: row.Capacity,
    accessibility: split(row.Accessibility),
    needs: split(row.Specific_Needs),
    ownerRole: owner?.Named_Role ?? 'Unknown',
    ownerType: owner?.Owner_Type ?? 'Unknown',
    contactStatus: owner?.Contact_Status ?? 'Unknown',
    confidence: row.Confidence_Score,
    sourceUrl: row.Source_URL,
    publication: 'demo-approved',
    coverageConflict: cases.some(c => c.Issue_Type === 'Conflicting eligibility'),
    venueConflict: cases.some(c => c.Issue_Type === 'Stale record'),
  };
});

export const postcodeLookup = workbook['Postcode Lookup'];
export const searchTerms = workbook['Search Terms'];
export const qualityCases = workbook['Data Quality Cases'];
export const pathways = workbook['Referral Pathways'];
export const changes: ProposedChange[] = workbook['Service Updates'].map(row => ({
  id: row.Update_ID,
  serviceId: row.Provision_ID,
  detectedOn: row.Detected_On,
  sourceType: row.Source_Type,
  field: row.Change_Type,
  oldValue: row.Old_Value,
  newValue: row.New_Value,
  confidence: row.Confidence,
  recommendedAction: row.Recommended_Action,
}));
