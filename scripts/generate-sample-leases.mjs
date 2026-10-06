// Generates sample lease files into data/sample-leases/.
// Each lease is designed to exercise specific rules — see expected.json.
// Run: npm run samples:leases

import PDFDocument from "pdfkit";
import { Document, Paragraph, TextRun, Packer } from "docx";
import { renderPageAsImage, getDocumentProxy, extractText } from "unpdf";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT_DIR = new URL("../data/sample-leases/", import.meta.url).pathname;
// Leases already in effect on the occupied units; the API seeds them as confirmed records
const CURRENT_DIR = new URL("../data/current-leases/", import.meta.url).pathname;
const LANDLORD = "Marina Crest Holdings W.L.L.";
const LANDLORD_SIGNATORY = "Khalid Al-Mansoori, Leasing Director";

const GEIST_REGULAR = resolve(import.meta.dirname, "fonts/Geist-Regular.ttf");
const GEIST_BOLD = resolve(import.meta.dirname, "fonts/Geist-Bold.ttf");
const FIXED_CREATION_DATE = new Date("2026-10-01T00:00:00Z");

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

const currentLeases = [
  {
    file: "current-lease-MC-A-0302.pdf",
    ref: "MCH-L-2025-0034",
    tenant: "Elena Petrova",
    tenantId: "QID 28264400812",
    premises:
      "Apartment 0302, Tower A, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-A-0302), a three-bedroom apartment of approximately 156 sqm, together with parking bay A-13.",
    clauses: [
      ["Term", "The term of this Lease is twenty-four (24) months, commencing on 1 March 2025 (the \"Commencement Date\") and expiring on 28 February 2027 (the \"Expiry Date\")."],
      ["Rent", "The Tenant shall pay rent of QAR 10,500 per month, payable monthly in advance on the first day of each month. The annual rent is QAR 126,000."],
      ["Security Deposit", "On signing, the Tenant shall pay a security deposit of QAR 10,500, refundable within thirty (30) days of the end of the Lease, less any amounts properly deducted for unpaid rent or damage beyond fair wear and tear."],
      ["Rent Escalation", "The monthly rent shall increase by five percent (5%) on each anniversary of the Commencement Date."],
      ["Renewal", "The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date."],
      ["Termination", "Either party may terminate this Lease by giving two (2) months' written notice after the first twelve (12) months of the term."],
      ["Maintenance", "The Landlord is responsible for structural repairs and major equipment, including air-conditioning units and the water heater. The Tenant is responsible for minor repairs under QAR 500, such as dripping taps and light fittings."],
    ],
    signatures: { landlord: "2025-02-15", tenant: "2025-02-15" },
  },
  {
    file: "current-lease-MC-B-1205.pdf",
    ref: "MCH-L-2025-0071",
    tenant: "Thomas Reyes",
    tenantId: "QID 27940012345",
    premises:
      "Apartment 1205, Tower B, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-B-1205), a two-bedroom apartment of approximately 121 sqm, together with parking bay B-78.",
    clauses: [
      ["Term", "The term of this Lease is twenty-four (24) months, commencing on 1 July 2025 (the \"Commencement Date\") and expiring on 30 June 2027 (the \"Expiry Date\")."],
      ["Rent", "The Tenant shall pay rent of QAR 9,800 per month, payable monthly in advance on the first day of each month. The annual rent is QAR 117,600."],
      ["Security Deposit", "On signing, the Tenant shall pay a security deposit of QAR 9,800, refundable within thirty (30) days of the end of the Lease."],
      ["Rent Escalation", "The monthly rent shall increase by four percent (4%) on each anniversary of the Commencement Date."],
      ["Renewal", "The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date."],
      ["Termination", "Either party may terminate this Lease by giving two (2) months' written notice after the first twelve (12) months of the term."],
      ["Maintenance", "The Landlord is responsible for structural repairs and major equipment, including air-conditioning units and the water heater. The Tenant shall report defects promptly and keep the premises in good condition."],
    ],
    signatures: { landlord: "2025-06-20", tenant: "2025-06-20" },
  },
];

function renderLease(lease, outDir = OUT_DIR) {
  const filePath = join(outDir, lease.file);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 60,
      info: { Title: `Residential Lease ${lease.ref}`, CreationDate: FIXED_CREATION_DATE },
    });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

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
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function signatureBlock(doc, role, name, signedOn) {
  doc.text(`${role}: ${name}`);
  doc.text(signedOn ? `Signature: /s/ ${name.split(",")[0]}    Date: ${signedOn}` : "Signature: ______________________    Date: ____________");
  doc.moveDown();
}

async function renderLease06Long() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 60,
      info: { Title: "Residential Lease MCH-L-2027-0182", CreationDate: FIXED_CREATION_DATE },
    });
    const stream = createWriteStream(join(OUT_DIR, "lease-06-long-MC-B-1204.pdf"));
    doc.pipe(stream);

    doc.font("Helvetica-Bold").fontSize(16).text("RESIDENTIAL LEASE AGREEMENT", { align: "center" });
    doc.font("Helvetica").fontSize(9).text("Reference: MCH-L-2027-0182", { align: "center" }).moveDown(1.5);

    doc.fontSize(10.5);
    doc.font("Helvetica-Bold").text("PARTIES");
    doc.font("Helvetica")
      .text(`Landlord: ${LANDLORD}, Lusail, Doha, State of Qatar (the "Landlord").`)
      .text('Tenant: Daniel Okafor, QID 28756401234 (the "Tenant").')
      .moveDown();

    doc.font("Helvetica-Bold").text("PREMISES");
    doc.font("Helvetica").text("Apartment 1204, Tower B, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-B-1204), a two-bedroom apartment of approximately 118 sqm, together with parking bay B-77.").moveDown();

    // Definitions - comprehensive to ensure Page 1 is filled and Clause 4 lands on Page 2
    const def1 = 'In this Lease Agreement, unless the context otherwise requires, the following expressions shall have the following meanings: "Building" means Marina Crest Residences Tower B, Lusail Marina District, Doha, State of Qatar, including all common structures, building envelope, foundation, roof, and associated grounds; "Common Areas" means the entrance halls, corridors, elevators, stairways, landscaped outdoor facilities, visitor parking zones, gymnasiums, swimming pools, and other shared spaces situated within the Building; "Premises" means Apartment 1204 situated on the twelfth floor of Tower B together with allocated parking bay B-77, including all fixtures, internal fittings, doors, windows, and installations therein; "Authority" means the Ministry of Municipality, the General Electricity and Water Corporation (Kahramaa), the Ministry of Interior, the Civil Defence, or any other competent governmental authority in the State of Qatar.';
    const def2 = '"Working Day" means any day other than a Friday, Saturday, or official declared public holiday in the State of Qatar; "Commencement Date" means 1 February 2027, being the first day of the lease term specified herein; "Expiry Date" means 31 January 2030, being the final day of the lease term specified herein; "Rent" means the monthly and annual consideration payable by the Tenant to the Landlord for the occupation and enjoyment of the Premises; "Security Deposit" means the refundable financial deposit lodged by the Tenant as security for the due performance of covenants under this Lease; "Service Charges" means the recurring costs of building management, security, janitorial cleaning, and communal air conditioning; and "Permitted Use" means quiet private residential occupation exclusively for the Tenant and immediate family members.';
    const def3 = '"Handover Condition" means the clean, fully functional decorative and physical state of the Premises as documented in the entry inventory signed at the Commencement Date. "Inventory" means the detailed schedule of Landlord fixtures, fittings, furniture, air-conditioning remotes, access cards, and keys delivered to the Tenant on handover. "Late Payment Charge" means the administrative recovery fee assessed in accordance with clause 6 on any overdue rental instalments.';
    const def4 = 'All headings and sub-headings in this Lease are inserted for ease of reference and convenience only and shall not affect, limit, or modify the construction, meaning, or interpretation of any provision hereof. Words importing the singular number include the plural and vice versa. Any reference to an enactment or statutory provision includes any subordinate legislation made under it and any reference to any statute, enactment, or regulation shall be construed as a reference to that statute, enactment, or regulation as amended, consolidated, or re-enacted from time to time.';

    doc.font("Helvetica-Bold").text("1. Definitions");
    doc.font("Helvetica").text(def1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(def2, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(def3, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(def4, { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("2. Term");
    doc.font("Helvetica").text('The term of this Lease is thirty-six (36) months, commencing on 1 February 2027 (the "Commencement Date") and expiring on 31 January 2030 (the "Expiry Date"). The Tenant shall be granted possession of the Premises on the Commencement Date following execution of this Lease and clearance of the initial financial disbursements required hereunder. Possession shall be delivered in a clean and tenantable state accompanied by a joint entry inventory report signed by both authorized representatives.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("3. Rent");
    doc.font("Helvetica").text('The Tenant shall pay rent of QAR 9,800 (Nine Thousand Eight Hundred Qatari Riyals) per month, payable monthly in advance on the first day of each month. The annual rent is QAR 117,600. All payments shall be made free of any bank deductions, withholdings, or counterclaims. Payment shall be effected through direct bank transfer to the account nominated by the Landlord or by delivering thirty-six (36) post-dated cheques upon the execution of this Lease.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("4. Security Deposit");
    doc.font("Helvetica").text('On signing, the Tenant shall pay a security deposit of QAR 19,600, refundable within thirty (30) days of the end of the Lease, less any amounts properly deducted for unpaid rent or damage beyond fair wear and tear. The security deposit shall be retained by the Landlord without accrual of interest throughout the subsistence of this tenancy. In the event deductions are made at handover, an itemised schedule of repairs and receipts shall be furnished to the Tenant.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("5. Rent Escalation");
    doc.font("Helvetica").text('The monthly rent shall increase by five percent (5%) on each anniversary of the Commencement Date. The Landlord shall furnish written notice confirming the applicable escalated monthly rent at least thirty (30) days prior to each effective anniversary. The new rate shall apply automatically from the first day of each lease year.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("6. Payment Method");
    doc.font("Helvetica").text('The Tenant shall deliver thirty-six (36) post-dated cheques on or before the Commencement Date, each representing one monthly instalment of rent. Alternatively, subject to Landlord written approval, payment may be processed by monthly automated electronic bank standing instruction. In the event any cheque or transfer is dishonoured upon presentation, the Tenant shall settle the outstanding amount within forty-eight (48) hours alongside an administrative penalty of QAR 500.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("7. Utilities");
    doc.font("Helvetica").text('The Tenant shall be solely responsible for all electricity and water consumption charges billed by Kahramaa, all telecommunication and high-speed internet charges, and all district cooling charges associated with the Premises throughout the tenancy. The Tenant shall cause Kahramaa utility accounts to be transferred into the Tenant\'s name within seven (7) days of handover and shall deliver final clearance certificates prior to deposit refund.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("8. Use");
    doc.font("Helvetica").text('The Premises shall be used solely and exclusively as a private residential dwelling for the Tenant and immediate family members. No commercial, trade, or professional activities shall be carried on within the Premises. The Tenant shall not keep animals or pets without prior written consent and shall strictly adhere to building noise restrictions between 10:00 PM and 8:00 AM.', { align: "justify" }).moveDown(0.7);

    const m1 = 'The Landlord is responsible for structural repairs and major equipment, including air-conditioning units and the water heater. The Tenant shall report defects promptly and keep the premises in good condition.';
    const m2 = 'The Tenant shall be responsible for all minor routine maintenance, including replacing light bulbs, unblocking internal drains, and repairing damages caused by accidental misuse or neglect. The Tenant shall maintain all fixtures, electrical fittings, sanitary apparatus, and kitchen cabinetry in good working order throughout the term.';
    const m3 = 'The Landlord shall provide semi-annual preventative servicing for the central air conditioning units, including filter washing, coil cleaning, and compressor inspection. The Tenant shall provide reasonable access during standard working hours to authorized maintenance personnel dispatched by the Landlord.';
    const m4 = 'If an urgent maintenance issue occurs that threatens health, safety, or substantial damage to property, the Tenant shall immediately contact the 24-hour emergency maintenance line. The Landlord shall dispatch an emergency team within four (4) hours of notification.';

    doc.font("Helvetica-Bold").text("9. Maintenance");
    doc.font("Helvetica").text(m1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(m2, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(m3, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(m4, { align: "justify" }).moveDown(0.7);

    const a1 = 'The Tenant shall make no structural alterations, additions, or major decorative changes to the Premises without prior written consent from the Landlord.';
    const a2 = 'No partitioning walls, false ceilings, heavy shelving anchors, or structural drilling shall be permitted without architectural drawings submitted to and formally approved by the Landlord\'s engineering department. The Tenant shall bear all costs of remedial works required to restore the Premises to its handover condition.';
    doc.font("Helvetica-Bold").text("10. Alterations");
    doc.font("Helvetica").text(a1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(a2, { align: "justify" }).moveDown(0.7);

    const ins1 = 'The Landlord maintains comprehensive property insurance covering the structural shell and common areas of the Building.';
    const ins2 = 'The Tenant is strongly advised and encouraged to obtain comprehensive personal contents and third-party liability insurance for all personal possessions kept within the Premises. The Landlord shall not be liable for loss, theft, water damage, or electrical surge damage to Tenant possessions, except where resulting directly from the Landlord\'s gross negligence or wilful misconduct.';
    doc.font("Helvetica-Bold").text("11. Insurance");
    doc.font("Helvetica").text(ins1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(ins2, { align: "justify" }).moveDown(0.7);

    const acc1 = 'The Landlord or authorized agents shall have the right to enter the Premises at reasonable hours during the daytime upon giving at least twenty-four (24) hours\' prior written notice for inspection, routine maintenance, or viewing by prospective buyers or tenants within sixty (60) days of Lease expiry.';
    const acc2 = 'In instances of bona fide emergency, such as gas leaks, severe water pipe bursts, or electrical fires, the Landlord or building security may enter the Premises immediately without prior notice to avert imminent danger to life or property.';
    doc.font("Helvetica-Bold").text("12. Access");
    doc.font("Helvetica").text(acc1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(acc2, { align: "justify" }).moveDown(0.7);

    const sub1 = 'The Tenant shall not assign, sublet, transfer, license, or share possession of the Premises or any part thereof to any third party without obtaining prior written approval from the Landlord.';
    const sub2 = 'Short-term holiday letting, Airbnb-style listings, and subletting to non-family occupants are strictly prohibited and constitute a material breach entitling immediate termination of this Lease without compensation.';
    doc.font("Helvetica-Bold").text("13. Assignment and Subletting");
    doc.font("Helvetica").text(sub1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(sub2, { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("14. Renewal");
    doc.font("Helvetica").text('The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date, on terms to be confirmed by the Landlord in writing. If no renewal notice is served within the prescribed window, the Landlord shall be entitled to place the Premises on the open leasing market.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("15. Termination");
    doc.font("Helvetica").text('Either party may terminate this Lease by giving two (2) months\' written notice after the first twelve (12) months of the term. Early termination by the Tenant before that date requires payment of one (1) month\'s rent as compensation. The Tenant shall yield up the Premises on the termination date in broom-clean condition.', { align: "justify" }).moveDown(0.7);

    const defl1 = 'If the Tenant fails to pay rent within fifteen (15) days of the due date, or commits any other material breach of this Lease not remedied within thirty (30) days of notice, the Landlord shall be entitled to terminate the Lease and re-enter the Premises in accordance with the laws of Qatar.';
    const defl2 = 'Termination under this clause shall not forfeit any accrued rights of the Landlord to claim arrears, interest, legal costs, or damages for loss of rental income until the Premises is re-let.';
    doc.font("Helvetica-Bold").text("16. Default");
    doc.font("Helvetica").text(defl1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(defl2, { align: "justify" }).moveDown(0.7);

    const not1 = 'All notices under this Lease shall be in writing and delivered by hand, registered courier, or verified electronic mail to the official addresses stated herein.';
    const not2 = 'Any notice delivered by hand or courier shall be deemed served upon delivery, and any notice transmitted via electronic mail shall be deemed served on the next Working Day following transmission with proof of delivery.';
    doc.font("Helvetica-Bold").text("17. Notices");
    doc.font("Helvetica").text(not1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(not2, { align: "justify" }).moveDown(0.7);

    const fm1 = 'Neither party shall be liable for failure to perform obligations where such failure arises from circumstances beyond reasonable control, including acts of God, civil commotion, war, governmental orders, epidemic restrictions, or major structural catastrophe affecting the Building.';
    const fm2 = 'If the Premises becomes totally uninhabitable due to an event of force majeure, rental payments shall abate until such time as habitability is restored, or either party may terminate the Lease upon thirty (30) days\' written notice without liability.';
    doc.font("Helvetica-Bold").text("18. Force Majeure");
    doc.font("Helvetica").text(fm1, { align: "justify" }).moveDown(0.5);
    doc.font("Helvetica").text(fm2, { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("19. Governing Law");
    doc.font("Helvetica").text('This Lease shall be governed by and construed in accordance with the laws of the State of Qatar, in particular Law No. 4 of 2008 Concerning the Leasing of Premises and any statutory modifications or re-enactments thereof.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("20. Dispute Resolution");
    doc.font("Helvetica").text('Any dispute arising out of or in connection with this Lease that cannot be resolved amicably within thirty (30) days shall be submitted to the exclusive jurisdiction of the Rental Dispute Resolution Committee at the Ministry of Municipality in Doha, Qatar. Both parties submit to the exclusive jurisdiction of the said Committee and waive any objections regarding forum conveniens.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("21. Entire Agreement");
    doc.font("Helvetica").text('This Lease constitutes the entire understanding between the parties with respect to the subject matter hereof and supersedes all prior agreements, representations, and negotiations. No amendment shall be binding unless executed in writing by both parties.', { align: "justify" }).moveDown(0.7);

    doc.font("Helvetica-Bold").text("22. Severability");
    doc.font("Helvetica").text('If any provision of this Lease is determined to be invalid, illegal, or unenforceable by any competent court or arbitral body, such provision shall be severed from the remainder of this Lease, which shall continue in full force and effect to the maximum extent permitted by applicable law.', { align: "justify" }).moveDown(0.7);

    doc.moveDown(1.5).font("Helvetica-Bold").text("SIGNATURES").moveDown(0.5).font("Helvetica");
    signatureBlock(doc, "For the Landlord", `${LANDLORD_SIGNATORY}, ${LANDLORD}`, "2027-01-20");
    signatureBlock(doc, "Tenant", "Daniel Okafor", "2027-01-20");

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function renderLease07Docx() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({ children: [new TextRun({ text: "RESIDENTIAL LEASE AGREEMENT", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "Reference: MCH-L-2027-0205" })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "PARTIES", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Landlord: ${LANDLORD}, Lusail, Doha, State of Qatar (the "Landlord").` })] }),
          new Paragraph({ children: [new TextRun({ text: 'Tenant: Sarah Jenkins, QID 28912345678 (the "Tenant").' })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "PREMISES", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "Apartment 0302, Tower A, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-A-0302), a three-bedroom apartment of approximately 156 sqm, together with parking bay A-13." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "1. Term", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: 'The term of this Lease is twenty-four (24) months, commencing on 1 March 2027 (the "Commencement Date") and expiring on 28 February 2029 (the "Expiry Date").' })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "2. Rent", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "The Tenant shall pay rent of QAR 132,000 per annum, payable annually in advance on or before the Commencement Date of each lease year. The total annual rent is QAR 132,000." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "3. Security Deposit", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "On signing, the Tenant shall pay a security deposit of QAR 11,000, refundable within thirty (30) days of the end of the Lease, less any amounts properly deducted for unpaid rent or damage beyond fair wear and tear." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "4. Rent Escalation", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "The rent shall increase by five percent (5%) on each anniversary of the Commencement Date." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "5. Renewal", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date, on terms to be confirmed by the Landlord in writing." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "6. Termination", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "Either party may terminate this Lease by giving two (2) months' written notice after the first twelve (12) months of the term. Early termination by the Tenant before that date requires payment of one (1) month's rent as compensation." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "7. Maintenance", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: "The Landlord is responsible for structural repairs and major equipment, including air-conditioning units and the water heater. The Tenant shall report defects promptly and keep the premises in good condition." })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "SIGNATURES", bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `For the Landlord: ${LANDLORD_SIGNATORY}, ${LANDLORD}` })] }),
          new Paragraph({ children: [new TextRun({ text: "Signature: /s/ Khalid Al-Mansoori    Date: 2027-02-15" })] }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({ children: [new TextRun({ text: "Tenant: Sarah Jenkins" })] }),
          new Paragraph({ children: [new TextRun({ text: "Signature: /s/ Sarah Jenkins    Date: 2027-02-15" })] }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(join(OUT_DIR, "lease-07-docx-MC-A-0302.docx"), buffer);
}

async function renderLease08Image() {
  const doc = new PDFDocument({
    size: "A4",
    margin: 60,
    info: { Title: "Residential Lease MCH-L-2026-0195", CreationDate: FIXED_CREATION_DATE },
  });
  doc.registerFont("Geist", GEIST_REGULAR);
  doc.registerFont("Geist-Bold", GEIST_BOLD);

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const promise = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Geist-Bold").fontSize(16).text("RESIDENTIAL LEASE AGREEMENT", { align: "center" });
  doc.font("Geist").fontSize(9).text("Reference: MCH-L-2026-0195", { align: "center" }).moveDown(1.5);

  doc.fontSize(10.5);
  doc.font("Geist-Bold").text("PARTIES");
  doc.font("Geist")
    .text(`Landlord: ${LANDLORD}, Lusail, Doha, State of Qatar (the "Landlord").`)
    .text('Tenant: Tariq Mansour, QID 28512345678 (the "Tenant").')
    .moveDown();

  doc.font("Geist-Bold").text("PREMISES");
  doc.font("Geist").text("Apartment 0301, Tower A, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-A-0301), a three-bedroom apartment of approximately 156 sqm, together with parking bay A-12.").moveDown();

  const clauses = [
    ["Term", "The term of this Lease is twelve (12) months, commencing on 1 December 2026 (the \"Commencement Date\") and expiring on 30 November 2027 (the \"Expiry Date\")."],
    ["Rent", "The Tenant shall pay rent of QAR 12,000 (Twelve Thousand Qatari Riyals) per month, payable monthly in advance on the first day of each month. The annual rent is QAR 144,000."],
    ["Security Deposit", "On signing, the Tenant shall pay a security deposit of QAR 12,000, refundable within thirty (30) days of the end of the Lease, less any amounts properly deducted for unpaid rent or damage beyond fair wear and tear."],
    ["Rent Escalation", "The monthly rent shall increase by five percent (5%) on each anniversary of the Commencement Date."],
    ["Renewal", "The Tenant may renew this Lease for a further twelve (12) months by giving written notice not less than sixty (60) days before the Expiry Date, on terms to be confirmed by the Landlord in writing."],
    ["Termination", "Either party may terminate this Lease by giving two (2) months' written notice after the first twelve (12) months of the term. Early termination by the Tenant before that date requires payment of one (1) month's rent as compensation."],
  ];

  clauses.forEach(([heading, body], i) => {
    doc.font("Geist-Bold").text(`${i + 1}. ${heading}`);
    doc.font("Geist").text(body, { align: "justify" }).moveDown(0.7);
  });

  doc.moveDown(1.5).font("Geist-Bold").text("SIGNATURES").moveDown(0.5).font("Geist");
  signatureBlock(doc, "For the Landlord", `${LANDLORD_SIGNATORY}, ${LANDLORD}`, "2026-11-20");
  signatureBlock(doc, "Tenant", "Tariq Mansour", "2026-11-20");

  doc.end();
  const pdfBuf = await promise;

  const imgBuf = await renderPageAsImage(new Uint8Array(pdfBuf), 1, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale: 2,
  });

  // Verify that the rendered PNG is not blank/all-white
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(Buffer.from(imgBuf));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  let nonWhitePixels = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    if (a > 0 && (r < 250 || g < 250 || b < 250)) {
      nonWhitePixels++;
    }
  }

  if (nonWhitePixels < 1000) {
    throw new Error(`Rendered PNG for lease-08 is blank or nearly empty (${nonWhitePixels} non-white pixels)`);
  }

  writeFileSync(join(OUT_DIR, "lease-08-image-MC-A-0301.png"), Buffer.from(imgBuf));

  // Build the .txt from what pdf.js extracts from that in-memory PDF so line breaks match the image
  const pdfProxy = await getDocumentProxy(new Uint8Array(pdfBuf));
  const extracted = await extractText(pdfProxy, { mergePages: true });
  writeFileSync(join(OUT_DIR, "lease-08-image-MC-A-0301.txt"), extracted.text);
}

async function renderLease09Inline() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 60,
      info: { Title: "Residential Lease MCH-L-2027-0210", CreationDate: FIXED_CREATION_DATE },
    });
    const stream = createWriteStream(join(OUT_DIR, "lease-09-inline-headings.pdf"));
    doc.pipe(stream);

    doc.font("Helvetica-Bold").fontSize(16).text("RESIDENTIAL LEASE AGREEMENT", { align: "center" }).moveDown(1.5);
    doc.font("Helvetica").fontSize(10.5);
    doc.text("This Residential Lease Agreement is entered into between Marina Crest Holdings W.L.L. (the Landlord) and Daniel Okafor, holder of QID 28756401234 (the Tenant), for the lease of Apartment 1204, Tower B, Marina Crest Residences, Lusail Marina District, Doha (Unit ID MC-B-1204), together with parking bay B-77.").moveDown();

    const inlineClauses = [
      "1. Term. The term of this Lease is twenty-four (24) months, commencing on 1 February 2027 and expiring on 31 January 2029.",
      "2. Rent. The Tenant shall pay monthly rent of QAR 9,500 in advance on the first day of each calendar month. The annual rent is QAR 114,000.",
      "3. Security Deposit. The Tenant shall pay a security deposit of QAR 9,500 upon execution of this agreement.",
      "4. Rent Escalation. The monthly rent shall increase by five percent (5%) on each anniversary of the commencement date.",
      "5. Renewal. The Tenant may renew this lease by giving sixty (60) days written notice prior to expiry.",
      "6. Termination. Either party may terminate with two (2) months written notice after the first twelve (12) months.",
    ];

    inlineClauses.forEach((c) => {
      doc.text(c, { align: "justify" }).moveDown(0.7);
    });

    doc.moveDown();
    doc.text("Signed for the Landlord by Khalid Al-Mansoori on 2027-01-20 (/s/ Khalid Al-Mansoori).");
    doc.text("Signed by the Tenant Daniel Okafor on 2027-01-20 (/s/ Daniel Okafor).");

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
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
    rules: { R1: "FAIL", R2: "FAIL", R3: "PASS", R4: "FAIL", R5: "FAIL", R6: "FAIL", R7: "NOT_DETERMINABLE" },
    flags: [
      "Unit ID not stated; owner to confirm (suggested MC-B-0902)",
      "Stated term (12 months) contradicts dates (18 months)",
      "Annual rent 72,000 != 6,200 x 12 (74,400)",
      "Tenant signature missing",
      "Renewal terms vague",
    ],
  },
  "lease-03-occupied-MC-B-1205.pdf": {
    unitId: "MC-B-1205",
    rules: { R1: "PASS", R2: "PASS", R3: "FAIL", R4: "PASS", R5: "PASS", R6: "PASS", R7: "FAIL" },
    flags: ["Overlaps the current lease on MC-B-1205 (Thomas Reyes, to 30 June 2027)","Term 48 months exceeds 36 without owner approval"],
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
  "lease-06-long-MC-B-1204.pdf": {
    unitId: "MC-B-1204",
    rules: { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS", R5: "PASS", R6: "PASS", R7: "PASS" },
    flags: [],
  },
  "lease-07-docx-MC-A-0302.docx": {
    unitId: "MC-A-0302",
    // Starts the day after the current lease on MC-A-0302 ends, so it is the unit's next lease
    rules: { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS", R5: "PASS", R6: "PASS", R7: "PASS" },
    flags: ["Rent is annual (monthly derived: 11,000)"],
  },
  "lease-08-image-MC-A-0301.png": {
    unitId: "MC-A-0301",
    rules: { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS", R5: "PASS", R6: "PASS", R7: "PASS" },
    flags: ["Text transcribed from image; quotes checked against the transcription"],
  },
};

async function main() {
  mkdirSync(CURRENT_DIR, { recursive: true });
  await Promise.all([
    ...leases.map((lease) => renderLease(lease)),
    ...currentLeases.map((lease) => renderLease(lease, CURRENT_DIR)),
    renderLease06Long(),
    renderLease07Docx(),
    renderLease08Image(),
    renderLease09Inline(),
  ]);

  writeFileSync(join(OUT_DIR, "expected.json"), JSON.stringify(expected, null, 2) + "\n");
  console.log(`Wrote sample leases + expected.json to ${OUT_DIR}`);
}

await main();
