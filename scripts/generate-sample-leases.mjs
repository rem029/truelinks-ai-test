// Generates sample lease PDFs into data/sample-leases/.
// Each lease is designed to exercise specific rules — see expected.json.
// Run: npm run samples:leases

import PDFDocument from "pdfkit";
import { createWriteStream, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = new URL("../data/sample-leases/", import.meta.url).pathname;
const LANDLORD = "Marina Crest Holdings W.L.L.";
const LANDLORD_SIGNATORY = "Khalid Al-Mansoori, Leasing Director";

const leases = [
  {
    file: "lease-01-clean-MC-B-1204.pdf",
    ref: "MCH-L-2026-0141",
    tenant: "Daniel Okafor",
    tenantId: "QID 28756401234",
    premises:
      "Apartment 1204, Tower B, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-B-1204), a two-bedroom apartment of approximately 118 sqm, together with parking bay B-77.",
    clauses: [
      ["Term", "The term of this Lease is twenty-four (24) months, commencing on 1 November 2026 (the \"Commencement Date\") and expiring on 31 October 2028 (the \"Expiry Date\")."],
      ["Rent", "The Tenant shall pay rent of QAR 9,500 (Nine Thousand Five Hundred Qatari Riyals) per month, payable monthly in advance on the first day of each month. The annual rent is QAR 114,000."],
      ["Security Deposit", "On signing, the Tenant shall pay a security deposit of QAR 9,500, refundable within thirty (30) days of the end of the Lease, less any amounts properly deducted for unpaid rent or damage beyond fair wear and tear."],
      ["Rent Escalation", "The monthly rent shall increase by five percent (5%) on each anniversary of the Commencement Date."],
      ["Renewal", "The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date, on terms to be confirmed by the Landlord in writing."],
      ["Termination", "Either party may terminate this Lease by giving two (2) months' written notice after the first twelve (12) months of the term. Early termination by the Tenant before that date requires payment of one (1) month's rent as compensation."],
      ["Maintenance", "The Landlord is responsible for structural repairs and major equipment, including air-conditioning units and the water heater. The Tenant shall report defects promptly and keep the premises in good condition."],
      ["Use", "The premises shall be used solely as a private residence for the Tenant and immediate family."],
    ],
    signatures: { landlord: "2026-10-20", tenant: "2026-10-20" },
  },
  {
    file: "lease-02-problems-MC-B-0902.pdf",
    ref: "MCH-L-2026-0152",
    tenant: "Priya Raman",
    tenantId: "QID 29135609871",
    premises:
      "Apartment 0902, Tower B, Marina Crest Residences, Lusail Marina District, Doha, a one-bedroom apartment, together with parking bay B-51.",
    clauses: [
      ["Term", "The term of this Lease is twelve (12) months, commencing on 1 December 2026 and expiring on 31 May 2028."],
      ["Rent", "The Tenant shall pay rent of QAR 6,200 per month, payable monthly in advance. The total annual rent is QAR 72,000."],
      ["Security Deposit", "The Tenant shall pay a security deposit of QAR 5,000 on signing."],
      ["Rent Escalation", "Any increase in rent upon renewal shall be as mutually agreed between the parties."],
      ["Renewal", "This Lease may be renewed by agreement between the parties."],
      ["Termination", "The Tenant may terminate this Lease with one (1) month's written notice. The Landlord may terminate this Lease with three (3) months' written notice."],
      ["Maintenance", "Minor repairs under QAR 500 are the responsibility of the Tenant. All other repairs are the responsibility of the Landlord."],
    ],
    signatures: { landlord: "2026-11-18", tenant: null },
  },
  {
    file: "lease-03-occupied-MC-B-1205.pdf",
    ref: "MCH-L-2026-0158",
    tenant: "Lukas Brenner",
    tenantId: "QID 27827604455",
    premises:
      "Apartment 1205, Tower B, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-B-1205), a two-bedroom apartment, together with parking bay B-78.",
    clauses: [
      ["Term", "The term of this Lease is forty-eight (48) months, commencing on 1 January 2027 and expiring on 31 December 2030."],
      ["Rent", "The Tenant shall pay rent of QAR 10,000 per month, payable monthly in advance. The annual rent is QAR 120,000."],
      ["Security Deposit", "The Tenant shall pay a security deposit of QAR 20,000 on signing, equal to two (2) months' rent."],
      ["Rent Escalation", "The monthly rent shall increase by three percent (3%) on each anniversary of the Commencement Date."],
      ["Renewal", "This Lease shall renew automatically for successive twelve (12) month periods unless either party gives ninety (90) days' written notice of non-renewal."],
      ["Termination", "The Tenant may terminate after twenty-four (24) months by giving three (3) months' written notice."],
    ],
    signatures: { landlord: "2026-12-01", tenant: "2026-12-01" },
  },
  {
    file: "lease-04-quarterly-no-deposit-MC-A-0301.pdf",
    ref: "MCH-L-2026-0163",
    tenant: "Fatima Haddad",
    tenantId: "QID 28463301190",
    premises:
      "Apartment 0301, Tower A, Marina Crest Residences, Lusail Marina District, Doha, a three-bedroom apartment of approximately 156 sqm, together with parking bay A-12.",
    clauses: [
      ["Term", "The term of this Lease is twelve (12) months, commencing on 15 November 2026 and expiring on 14 November 2027."],
      ["Rent", "The Tenant shall pay rent of QAR 39,000 per quarter, payable quarterly in advance. The annual rent is QAR 156,000."],
      ["Rent Escalation", "On renewal, the rent shall be adjusted by the annual change in the Qatar Consumer Price Index published by the Planning and Statistics Authority, capped at five percent (5%)."],
      ["Renewal", "The Tenant may renew for a further twelve (12) months by written notice at least sixty (60) days before expiry."],
      ["Termination", "Neither party may terminate this Lease before the Expiry Date except for material breach not remedied within thirty (30) days of written notice."],
      ["Maintenance", "The Landlord shall maintain the air-conditioning system, water heater and built-in kitchen appliances."],
    ],
    signatures: { landlord: "2026-11-05", tenant: "2026-11-06" },
  },
  {
    file: "lease-05-unknown-unit-rent-conflict.pdf",
    ref: "MCH-L-2026-0170",
    tenant: "Omar Siddiqui",
    tenantId: "QID 29034417762",
    premises:
      "Apartment 1501, Tower C, Marina Crest Residences, Lusail Marina District, Doha, a two-bedroom apartment.",
    clauses: [
      ["Term", "The term of this Lease is twenty-four (24) months, commencing on 1 February 2027 and expiring on 31 January 2029."],
      ["Rent", "The Tenant shall pay rent of QAR 8,500 (Eight Thousand Five Hundred Qatari Riyals) per month, payable monthly in advance. The annual rent is QAR 102,000."],
      ["Security Deposit", "The Tenant shall pay a security deposit of QAR 8,500 on signing."],
      ["Rent Escalation", "The monthly rent shall increase by four percent (4%) on the first anniversary of the Commencement Date."],
      ["Payment Schedule", "Rent of QAR 8,000 per month shall be paid by post-dated cheques delivered on signing, one cheque for each month of the term."],
      ["Renewal", "Renewal is subject to a new lease agreement."],
      ["Termination", "Either party may terminate with two (2) months' written notice after the first twelve (12) months."],
    ],
    signatures: { landlord: "2027-01-15", tenant: "2027-01-15" },
  },
];

function renderLease(lease) {
  const doc = new PDFDocument({ size: "A4", margin: 60, info: { Title: `Residential Lease ${lease.ref}` } });
  doc.pipe(createWriteStream(join(OUT_DIR, lease.file)));

  doc.font("Helvetica-Bold").fontSize(16).text("RESIDENTIAL LEASE AGREEMENT", { align: "center" });
  doc.font("Helvetica").fontSize(9).text(`Reference: ${lease.ref}`, { align: "center" }).moveDown(1.5);

  doc.fontSize(10.5);
  doc.font("Helvetica-Bold").text("PARTIES");
  doc.font("Helvetica")
    .text(`Landlord: ${LANDLORD}, Lusail, Doha, State of Qatar (the "Landlord").`)
    .text(`Tenant: ${lease.tenant}, ${lease.tenantId} (the "Tenant").`)
    .moveDown();
  doc.font("Helvetica-Bold").text("PREMISES");
  doc.font("Helvetica").text(lease.premises).moveDown();

  lease.clauses.forEach(([heading, body], i) => {
    doc.font("Helvetica-Bold").text(`${i + 1}. ${heading}`);
    doc.font("Helvetica").text(body, { align: "justify" }).moveDown(0.7);
  });

  doc.moveDown(1.5).font("Helvetica-Bold").text("SIGNATURES").moveDown(0.5).font("Helvetica");
  signatureBlock(doc, "For the Landlord", `${LANDLORD_SIGNATORY}, ${LANDLORD}`, lease.signatures.landlord);
  signatureBlock(doc, "Tenant", lease.tenant, lease.signatures.tenant);

  doc.end();
}

function signatureBlock(doc, role, name, signedOn) {
  doc.text(`${role}: ${name}`);
  doc.text(signedOn ? `Signature: /s/ ${name.split(",")[0]}    Date: ${signedOn}` : "Signature: ______________________    Date: ____________");
  doc.moveDown();
}

// Ground truth for tests and the stub provider.
const expected = {
  "lease-01-clean-MC-B-1204.pdf": {
    unitId: "MC-B-1204",
    rules: { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS", R5: "PASS", R6: "PASS", R7: "PASS" },
    flags: [],
  },
  "lease-02-problems-MC-B-0902.pdf": {
    unitId: "MC-B-0902",
    rules: { R1: "FAIL", R2: "FAIL", R3: "PASS", R4: "FAIL", R5: "FAIL", R6: "FAIL", R7: "PASS" },
    flags: [
      "Unit ID not stated; matched by label + parking bay",
      "Stated term (12 months) contradicts dates (18 months)",
      "Annual rent 72,000 != 6,200 x 12 (74,400)",
      "Tenant signature missing",
      "Renewal terms vague",
    ],
  },
  "lease-03-occupied-MC-B-1205.pdf": {
    unitId: "MC-B-1205",
    rules: { R1: "PASS", R2: "PASS", R3: "FAIL", R4: "PASS", R5: "PASS", R6: "PASS", R7: "FAIL" },
    flags: ["Unit is currently occupied", "Term 48 months exceeds 36 without owner approval"],
  },
  "lease-04-quarterly-no-deposit-MC-A-0301.pdf": {
    unitId: "MC-A-0301",
    rules: { R1: "NOT_DETERMINABLE", R2: "PASS", R3: "PASS", R4: "PASS", R5: "PASS", R6: "PASS", R7: "PASS" },
    flags: ["Security deposit not stated", "Rent is quarterly (monthly derived: 13,000)"],
  },
  "lease-05-unknown-unit-rent-conflict.pdf": {
    unitId: null,
    rules: { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS", R5: "PASS", R6: "PASS", R7: "FAIL" },
    flags: ["Unit 'Apartment 1501, Tower C' not in owner records", "Monthly rent conflict: clause 2 says 8,500, clause 5 says 8,000"],
  },
};

leases.forEach(renderLease);
writeFileSync(join(OUT_DIR, "expected.json"), JSON.stringify(expected, null, 2) + "\n");
console.log(`Wrote ${leases.length} leases + expected.json to ${OUT_DIR}`);
