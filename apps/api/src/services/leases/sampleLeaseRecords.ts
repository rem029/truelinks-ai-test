import { LeaseRecord } from '@truelinks/shared';

function field<T>(value: T, clauseId: string, quote: string) {
  return {
    value,
    source: {
      type: 'document' as const,
      clauseId,
      quote,
      verified: true,
    },
    confidence: 1,
    review: {
      status: 'pending' as const,
    },
  };
}

function missing<T = unknown>() {
  return {
    value: null as T | null,
    source: null,
    confidence: 0,
    review: {
      status: 'pending' as const,
    },
  };
}

const rawSampleLeaseRecords: Record<string, LeaseRecord> = {
  'lease-01-clean-MC-B-1204.pdf': {
    landlord: {
      name: field('Marina Crest Holdings W.L.L.', 'parties', 'Landlord: Marina Crest Holdings W.L.L., Lusail, Doha, State of Qatar (the "Landlord").'),
      signed: field(true, 'signatures', '/s/ Khalid Al-Mansoori'),
    },
    tenant: {
      name: field('Daniel Okafor', 'parties', 'Tenant: Daniel Okafor, QID 28756401234 (the "Tenant").'),
      signed: field(true, 'signatures', '/s/ Daniel Okafor'),
    },
    unit: {
      unitId: field('MC-B-1204', 'premises', '(Unit ID MC-B-1204)'),
      label: field('Apartment 1204', 'premises', 'Apartment 1204, Tower B, Marina Crest Residences'),
      parkingBay: field('B-77', 'premises', 'parking bay B-77'),
    },
    commencementDate: field('2026-11-01', '1', '1 November 2026'),
    expiryDate: field('2028-10-31', '1', '31 October 2028'),
    termMonths: field(24, '1', 'twenty-four (24) months'),
    rent: {
      amount: field(9500, '2', 'QAR 9,500 (Nine Thousand Five Hundred Qatari Riyals)'),
      frequency: field('monthly', '2', 'per month, payable monthly in advance'),
      monthly: field(9500, '2', 'QAR 9,500 (Nine Thousand Five Hundred Qatari Riyals) per month'),
      annual: field(114000, '2', 'annual rent is QAR 114,000'),
    },
    currency: field('QAR', '2', 'QAR 9,500'),
    deposit: field(9500, '3', 'security deposit of QAR 9,500'),
    escalation: {
      text: field('The monthly rent shall increase by five percent (5%) on each anniversary of the Commencement Date.', '4', 'increase by five percent (5%) on each anniversary of the Commencement Date'),
      isDefined: field(true, '4', 'increase by five percent (5%) on each anniversary of the Commencement Date'),
    },
    renewal: field('The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date, on terms to be confirmed by the Landlord in writing.', '5', 'renew this Lease for a further twelve (12) months'),
    termination: field("Either party may terminate this Lease by giving two (2) months' written notice after the first twelve (12) months of the term. Early termination by the Tenant before that date requires payment of one (1) month's rent as compensation.", '6', "terminate this Lease by giving two (2) months' written notice"),
  },

  'lease-02-problems-MC-B-0902.pdf': {
    landlord: {
      name: field('Marina Crest Holdings W.L.L.', 'parties', 'Landlord: Marina Crest Holdings W.L.L., Lusail, Doha, State of Qatar (the "Landlord").'),
      signed: field(true, 'signatures', '/s/ Khalid Al-Mansoori'),
    },
    tenant: {
      name: field('Priya Raman', 'parties', 'Tenant: Priya Raman, QID 29135609871 (the "Tenant").'),
      signed: field(false, 'signatures', 'Signature: ______________________'),
    },
    unit: {
      unitId: missing(),
      label: field('Apartment 0902', 'premises', 'Apartment 0902, Tower B, Marina Crest Residences'),
      parkingBay: field('B-51', 'premises', 'parking bay B-51'),
    },
    commencementDate: field('2026-12-01', '1', '1 December 2026'),
    expiryDate: field('2028-05-31', '1', '31 May 2028'),
    termMonths: field(12, '1', 'twelve (12) months'),
    rent: {
      amount: field(6200, '2', 'QAR 6,200'),
      frequency: field('monthly', '2', 'per month, payable monthly in advance'),
      monthly: field(6200, '2', 'QAR 6,200 per month'),
      annual: field(72000, '2', 'total annual rent is QAR 72,000'),
    },
    currency: field('QAR', '2', 'QAR 6,200'),
    deposit: field(5000, '3', 'security deposit of QAR 5,000'),
    escalation: {
      text: field('Any increase in rent upon renewal shall be as mutually agreed between the parties.', '4', 'as mutually agreed between the parties'),
      isDefined: field(false, '4', 'as mutually agreed between the parties'),
    },
    renewal: field('This Lease may be renewed by agreement between the parties.', '5', 'renewed by agreement between the parties'),
    termination: field("The Tenant may terminate this Lease with one (1) month's written notice. The Landlord may terminate this Lease with three (3) months' written notice.", '6', "terminate this Lease with one (1) month's written notice"),
  },

  'lease-03-occupied-MC-B-1205.pdf': {
    landlord: {
      name: field('Marina Crest Holdings W.L.L.', 'parties', 'Landlord: Marina Crest Holdings W.L.L., Lusail, Doha, State of Qatar (the "Landlord").'),
      signed: field(true, 'signatures', '/s/ Khalid Al-Mansoori'),
    },
    tenant: {
      name: field('Lukas Brenner', 'parties', 'Tenant: Lukas Brenner, QID 27827604455 (the "Tenant").'),
      signed: field(true, 'signatures', '/s/ Lukas Brenner'),
    },
    unit: {
      unitId: field('MC-B-1205', 'premises', '(Unit ID MC-B-1205)'),
      label: field('Apartment 1205', 'premises', 'Apartment 1205, Tower B, Marina Crest Residences'),
      parkingBay: field('B-78', 'premises', 'parking bay B-78'),
    },
    commencementDate: field('2027-01-01', '1', '1 January 2027'),
    expiryDate: field('2030-12-31', '1', '31 December 2030'),
    termMonths: field(48, '1', 'forty-eight (48) months'),
    rent: {
      amount: field(10000, '2', 'QAR 10,000'),
      frequency: field('monthly', '2', 'per month, payable monthly in advance'),
      monthly: field(10000, '2', 'QAR 10,000 per month'),
      annual: field(120000, '2', 'annual rent is QAR 120,000'),
    },
    currency: field('QAR', '2', 'QAR 10,000'),
    deposit: field(20000, '3', 'security deposit of QAR 20,000'),
    escalation: {
      text: field('The monthly rent shall increase by three percent (3%) on each anniversary of the Commencement Date.', '4', 'increase by three percent (3%) on each anniversary of the Commencement Date'),
      isDefined: field(true, '4', 'increase by three percent (3%) on each anniversary of the Commencement Date'),
    },
    renewal: field("This Lease shall renew automatically for successive twelve (12) month periods unless either party gives ninety (90) days' written notice of non-renewal.", '5', 'renew automatically for successive twelve (12) month periods'),
    termination: field("The Tenant may terminate after twenty-four (24) months by giving three (3) months' written notice.", '6', "terminate after twenty-four (24) months"),
  },

  'lease-04-quarterly-no-deposit-MC-A-0301.pdf': {
    landlord: {
      name: field('Marina Crest Holdings W.L.L.', 'parties', 'Landlord: Marina Crest Holdings W.L.L., Lusail, Doha, State of Qatar (the "Landlord").'),
      signed: field(true, 'signatures', '/s/ Khalid Al-Mansoori'),
    },
    tenant: {
      name: field('Fatima Haddad', 'parties', 'Tenant: Fatima Haddad, QID 28463301190 (the "Tenant").'),
      signed: field(true, 'signatures', '/s/ Fatima Haddad'),
    },
    unit: {
      unitId: field('MC-A-0301', 'premises', 'Apartment 0301, Tower A, Marina Crest Residences'),
      label: field('Apartment 0301', 'premises', 'Apartment 0301, Tower A'),
      parkingBay: field('A-12', 'premises', 'parking bay A-12'),
    },
    commencementDate: field('2026-11-15', '1', '15 November 2026'),
    expiryDate: field('2027-11-14', '1', '14 November 2027'),
    termMonths: field(12, '1', 'twelve (12) months'),
    rent: {
      amount: field(39000, '2', 'QAR 39,000'),
      frequency: field('quarterly', '2', 'per quarter, payable quarterly in advance'),
      monthly: missing(),
      annual: field(156000, '2', 'annual rent is QAR 156,000'),
    },
    currency: field('QAR', '2', 'QAR 39,000'),
    deposit: missing(),
    escalation: {
      text: field('On renewal, the rent shall be adjusted by the annual change in the Qatar Consumer Price Index published by the Planning and Statistics Authority, capped at five percent (5%).', '3', 'adjusted by the annual change in the Qatar Consumer Price Index published by the Planning and Statistics Authority, capped at five percent (5%)'),
      isDefined: field(true, '3', 'adjusted by the annual change in the Qatar Consumer Price Index published by the Planning and Statistics Authority, capped at five percent (5%)'),
    },
    renewal: field('The Tenant may renew for a further twelve (12) months by written notice at least sixty (60) days before expiry.', '4', 'renew for a further twelve (12) months'),
    termination: field('Neither party may terminate this Lease before the Expiry Date except for material breach not remedied within thirty (30) days of written notice.', '5', 'terminate this Lease before the Expiry Date'),
  },

  'lease-05-unknown-unit-rent-conflict.pdf': {
    landlord: {
      name: field('Marina Crest Holdings W.L.L.', 'parties', 'Landlord: Marina Crest Holdings W.L.L., Lusail, Doha, State of Qatar (the "Landlord").'),
      signed: field(true, 'signatures', '/s/ Khalid Al-Mansoori'),
    },
    tenant: {
      name: field('Omar Siddiqui', 'parties', 'Tenant: Omar Siddiqui, QID 29034417762 (the "Tenant").'),
      signed: field(true, 'signatures', '/s/ Omar Siddiqui'),
    },
    unit: {
      unitId: missing(),
      label: field('Apartment 1501, Tower C', 'premises', 'Apartment 1501, Tower C, Marina Crest Residences'),
      parkingBay: missing(),
    },
    commencementDate: field('2027-02-01', '1', '1 February 2027'),
    expiryDate: field('2029-01-31', '1', '31 January 2029'),
    termMonths: field(24, '1', 'twenty-four (24) months'),
    rent: {
      amount: field(8500, '2', 'QAR 8,500 (Eight Thousand Five Hundred Qatari Riyals)'),
      frequency: field('monthly', '2', 'per month, payable monthly in advance'),
      monthly: field(8500, '2', 'QAR 8,500 (Eight Thousand Five Hundred Qatari Riyals) per month'),
      annual: field(102000, '2', 'annual rent is QAR 102,000'),
    },
    currency: field('QAR', '2', 'QAR 8,500'),
    deposit: field(8500, '3', 'security deposit of QAR 8,500'),
    escalation: {
      text: field('The monthly rent shall increase by four percent (4%) on the first anniversary of the Commencement Date.', '4', 'increase by four percent (4%) on the first anniversary of the Commencement Date'),
      isDefined: field(true, '4', 'increase by four percent (4%) on the first anniversary of the Commencement Date'),
    },
    renewal: field('Renewal is subject to a new lease agreement.', '6', 'Renewal is subject to a new lease agreement.'),
    termination: field("Either party may terminate with two (2) months' written notice after the first twelve (12) months.", '7', "terminate with two (2) months' written notice after the first twelve (12) months."),
  },
};

// Validate each fixture with LeaseRecord.parse so schema drift is caught immediately
export const sampleLeaseRecords: Record<string, LeaseRecord> = Object.fromEntries(
  Object.entries(rawSampleLeaseRecords).map(([key, record]) => [key, LeaseRecord.parse(record)])
);
