import { describe, it, expect } from 'vitest';
import { parseCorrection } from './parseCorrection.js';

describe('parseCorrection', () => {
  const cases: Array<{
    input: string;
    expected: { fieldPath: string; value: string | number } | null;
  }> = [
    // Rent
    { input: 'rent is 8500', expected: { fieldPath: 'rent.amount', value: 8500 } },
    { input: 'monthly rent should be QAR 8,500', expected: { fieldPath: 'rent.amount', value: 8500 } },
    { input: 'rent: 9000', expected: { fieldPath: 'rent.amount', value: 9000 } },
    { input: 'set rent to 12,000', expected: { fieldPath: 'rent.amount', value: 12000 } },
    { input: 'rent amount = $4500', expected: { fieldPath: 'rent.amount', value: 4500 } },
    { input: 'monthly rent is QR 7,200', expected: { fieldPath: 'rent.amount', value: 7200 } },

    // Deposit
    { input: 'deposit is 5000', expected: { fieldPath: 'deposit', value: 5000 } },
    { input: 'security deposit should be QAR 5,000', expected: { fieldPath: 'deposit', value: 5000 } },
    { input: 'deposit: 10000', expected: { fieldPath: 'deposit', value: 10000 } },
    { input: 'set deposit to 6,500', expected: { fieldPath: 'deposit', value: 6500 } },

    // Term
    { input: 'term is 24 months', expected: { fieldPath: 'termMonths', value: 24 } },
    { input: 'lease term should be 12 months', expected: { fieldPath: 'termMonths', value: 12 } },
    { input: 'term: 36 months', expected: { fieldPath: 'termMonths', value: 36 } },
    { input: 'term is 18', expected: { fieldPath: 'termMonths', value: 18 } },

    // Commencement date (ISO YYYY-MM-DD only)
    { input: 'start date is 2025-01-01', expected: { fieldPath: 'commencementDate', value: '2025-01-01' } },
    { input: 'commencement date is 2025-02-15', expected: { fieldPath: 'commencementDate', value: '2025-02-15' } },
    { input: 'start date: 2025-03-01', expected: { fieldPath: 'commencementDate', value: '2025-03-01' } },
    { input: 'set commencement date to 2025-06-01', expected: { fieldPath: 'commencementDate', value: '2025-06-01' } },

    // Expiry date (ISO YYYY-MM-DD only)
    { input: 'expiry date is 2026-01-01', expected: { fieldPath: 'expiryDate', value: '2026-01-01' } },
    { input: 'end date is 2026-02-14', expected: { fieldPath: 'expiryDate', value: '2026-02-14' } },
    { input: 'expiry date: 2026-03-01', expected: { fieldPath: 'expiryDate', value: '2026-03-01' } },
    { input: 'set end date to 2026-12-31', expected: { fieldPath: 'expiryDate', value: '2026-12-31' } },

    // Tenant name
    { input: 'tenant name is Jane Doe', expected: { fieldPath: 'tenant.name', value: 'Jane Doe' } },
    { input: 'tenant should be John Smith', expected: { fieldPath: 'tenant.name', value: 'John Smith' } },
    { input: 'tenant: Alice Wonder', expected: { fieldPath: 'tenant.name', value: 'Alice Wonder' } },
    { input: "tenant's name is Robert O'Connor", expected: { fieldPath: 'tenant.name', value: "Robert O'Connor" } },

    // Landlord name
    { input: 'landlord name is ACME Real Estate', expected: { fieldPath: 'landlord.name', value: 'ACME Real Estate' } },
    { input: 'landlord should be Tariq Al-Mansoor', expected: { fieldPath: 'landlord.name', value: 'Tariq Al-Mansoor' } },
    { input: 'landlord: Pearl Properties LLC', expected: { fieldPath: 'landlord.name', value: 'Pearl Properties LLC' } },

    // Negatives & ambiguous inputs (must return null)
    { input: 'change it', expected: null },
    { input: 'rent is high', expected: null },
    { input: 'rent is wrong', expected: null },
    { input: 'rent is too much', expected: null },
    { input: 'monthly rent', expected: null },
    { input: 'deposit is wrong', expected: null },
    { input: 'deposit is too much', expected: null },
    { input: 'term is long', expected: null },
    { input: 'start date tomorrow', expected: null },
    { input: 'start date is 01/01/2025', expected: null },
    { input: 'expiry date next year', expected: null },
    { input: 'tenant name is wrong', expected: null },
    { input: 'landlord name is missing', expected: null },
    { input: 'rent is 8500 and deposit is 5000', expected: null }, // ambiguous: two fields
    { input: 'what is the rent?', expected: null },
    { input: '', expected: null },
  ];

  for (const { input, expected } of cases) {
    it(`parses "${input}" -> ${JSON.stringify(expected)}`, () => {
      expect(parseCorrection(input)).toEqual(expected);
    });
  }
});
