# 05 — Issue agent (Part B) · Must

Goal: photos for a unit → condition, equipment, draft work order → human review → saved on the unit.

## Phase 1 — Report + analyse
### Tasks
- [x] Report: reporter role (tenant/inspector) as a field, note, 1..n photos (from the start page for now; the unit page comes in 06 phase 2)
- [x] Vision: per-photo condition (new/good/worn/damaged/undeterminable), damages, equipment
- [x] Sample photos in `data/sample-photos/` + `expected.json`
### Results
- 9 AI-generated photos (prompts in `PROMPTS.md`), compressed to ~1.9 MB total.
- `expected.json` written from what the photos actually show. Differences from prompts worth testing:
  - issue-02 photo 2 shows a corroded **drain** leak, not the tap → two faults; responsibility split (tap = tenant minor repair per lease 02 §7, drain maybe > QAR 500).
  - issue-03 adds exposed wiring + wet power socket → urgent safety advice.
  - issue-01 has AI-generated brand text on the AC → agent must not assert a brand.
  - issue-04 = no false positives; issue-05 = ask for a clearer photo.
- **Report + analysis (Oct 5), written by agy and reviewed by Claude:**
  - `POST /conversations/:id/issue-report` (multipart: `reporterRole`, `note`, 1–6 JPEG/PNG/WebP `photos`) → `reportIssue`: checks the conversation is an issue on a unit with no report yet (409 otherwise), analyses every photo, then saves the files and, in one transaction, the issue, the user message (photos attached) and the reply with a `condition` card. A model failure is 502 with the reason and saves nothing.
  - `analyzePhoto`: one call per photo, in parallel, default model with low reasoning, Zod schema `{condition, damages, equipment, note}` (enum and strings only, which mimo handles). Prompt `photoAnalysis.md`: only what's visible, conditions defined, no brands, safety hazards count as damage, the reporter's note is context but the photo decides.
  - Shared: `IssueCondition` gains `good`; `IssuePhoto` gains `mimeType` and `note`; new `ConditionCard` (no actions); `ConversationDetails.issue`; `ConversationSummary.photoCount`.
  - The reply text is built in code (`summaryText.ts`): "Looked at 2 photos: 1 damaged, 1 worn. Seen: …" (up to 5 damages, de-duplicated), "No damage seen." when everything is new or good, or "please send a clearer one" when nothing can be judged.
  - Photos are stored at `var/uploads/issues/<issueId>/<photoId>.<ext>`, with the extension taken from the image type, never the uploaded filename. `GET /conversations/:id/photos/:photoId` serves them.
  - **Real models:** mimo judged all 9 sample photos correctly (issue-05: undeterminable, "very dark, grainy") but returned empty content for 2–3 photos per run, even after its retry, so the whole report failed with 502 (the owner hit this). Flash Lite never failed but called issue-05 "damaged, mold". Fix: mimo first, Flash Lite only for a photo mimo couldn't answer (`photo-analysis fallback` log line). All 9 now pass. The provider's retry and error log lines now include the validation reason.
  - Web: "Report an issue" on the start page (pick a unit), `IssueThreadPage` with `IssueReportForm` (role, note, photo previews, "Looking at N photos… Ns") and `ConditionCardView`. `#/c/<id>` picks the page by the conversation's kind; the loaded details are passed in, so the page doesn't fetch twice. Issue reports appear in the start page's history.
  - Tests: `reportIssue` (happy path, unclear photo, no damage, 409, 400s, 502 saves nothing), `summaryText` against `expected.json`, the fallback, photo paths, and the photo route's 404s. The stub returns the fixture for each photo, and "stub: no fixture for this photo" otherwise.
  - Incident: `var/` (database and uploads) was deleted while the dev server was running. The database was recovered from the server's open file handle, and the integrity check passed. Lease files uploaded before then are gone, so their "open original" links 404.

## Phase 2 — Work order
### Design
- Code decides when the agent runs: every photo new/good → "no damage", no draft; every photo undeterminable → ask for a clearer photo (the report form accepts more photos on the same issue); otherwise run the work-order turn.
- `WorkOrder` gains `responsibility` (landlord/tenant/split/unknown), `responsibilityReason`, `responsibilityClause` (clause id, heading, verbatim quote), `leaseId`, `updatedAt` (migration 005).
- Tools: `get_unit_lease` (the unit's confirmed lease: tenant + clauses, or "none on file"), `draft_work_order` (code checks the quote against the clause, stores the draft, replaces an earlier draft), `ask_user`. No tool accepts the work order.
- Card actions on the `workOrder` card: accept (= confirm, saved with the lease id, conversation confirmed), reject (stays open, asks what's wrong), edit (Zod-validated partial). A typed message runs the turn again with the current draft → redraft.
### Tasks
- [x] Agent loop with `get_unit_lease` (responsibility from maintenance clause), `draft_work_order`, `ask_user`
- [x] Cards: condition + equipment, draft work order (title, what's wrong, unit, severity, category, responsibility + clause, photos)
- [x] No issue → say so, no draft; unclear photo → ask for another
- [x] Accept / reject / edit, or typed correction → patch → re-draft
- [x] Confirm → saved against unit + active lease
### Results
- **Written by Claude, not agy (Oct 5).** agy-bridge timed out (600 s) on 5 of 6 jobs, including tiny ones. It wrote the shared schema, migration 005 and the repository mapping; the owner said to do the rest directly if it kept failing.
- API:
  - `workOrderTools.ts`: `get_unit_lease` (newest confirmed lease for the unit + its document's clauses), `draft_work_order`, and `ask_user`. `buildDraft` is pure: lease read first, clause must be in the lease, quote checked with `verifyQuote`, `unknown` only without a lease, and a redraft keeps the id and `createdAt`.
  - `workOrderTurn.ts`: `needsWorkOrder` (any damage listed) gates the agent. The turn includes the photo findings and the current draft in the system prompt plus the last 10 messages, saves the draft and reply in one transaction, and logs `work-order conversation= steps/tools= asked= drafted= ms=`. Prompt: `prompts/workOrderDraft.md`.
  - `reportIssue` runs the turn after saving the report. It now appends photos to an existing report until a work order exists (409 after that), so "send a clearer photo" works in the same thread.
  - `applyWorkOrderAction.ts`: accept (status accepted, conversation confirmed), reject (stays open, no card), edit (Zod-validated partial; changing the party drops the clause). Any action after accept is 409.
  - `services/conversations/conversationTurn.ts` sends `/actions` and `/messages` to the lease or issue service by conversation kind.
  - `ConversationDetails.workOrder` and `ReportIssueResponse.workOrder`; `WorkOrderTurnResponse`.
  - Stub: `stubWorkOrder.ts` reads the lease, then drafts from `expected.json` (or asks for a clearer photo); "low/medium/high" in a typed message changes the severity, so the redraft path runs without a key.
- Web: `WorkOrderCardView` (status, unit, severity, urgent, category, description, responsible + reason + quoted clause, photo thumbnails; Accept work order / Reject / Edit on the newest card while open), `WorkOrderEditForm` (sends only changed fields), a Composer on the issue page, and an "Add more photos" form while no work order exists.
- Tests: `buildDraft` rules, `applyWorkOrderEdit`, and the full loop with the stub (draft against a confirmed lease → typed correction → accept → 409; reject → edit, bad edit 400); `reportIssue` happy path now ends with a draft; clearer-photo append then 409. 363 tests pass.
- **Real models (mimo), in-memory DB with leases 01/02/04 confirmed:**
  - issue-02 → one plumbing work order, two faults, `split`, quoting lease 02 §7 ("Minor repairs under QAR 500 are the responsibility of the Tenant…"). ~47 s including photo analysis.
  - issue-03 → "Water heater leaking with exposed wiring near socket", high, urgent, "Isolate the power/water until inspected", `landlord` quoting lease 04's maintenance clause.
  - issue-04 → no damage, no agent call.
  - Correction "make severity high" → redrafted with only the severity changed, but took 104 s (6 steps; one step reasoned for 73 s).
- **Browser test (Oct 5, real models):** report → draft (landlord, lease 01 quote) → edit severity → typed correction ("mark it urgent") → accept → saved with the lease id, conversation confirmed. Fixes after it: the report button says "Looking at the photos and drafting a work order…"; the issue page scrolls to each new reply and shows the typed message with "Redrafting the work order…" while waiting; edits read "Changed severity to high, marked urgent"; the summary's "Seen:" list shows 3 damages cut at 60 characters plus "and N more".
- Follow-ups: the correction turn is slow (32–104 s; try `reasoningEffort: 'low'`). Without a confirmed lease the agent keeps responsibility `unknown` even when the owner states it in chat (only the Edit form can set it) — decide whether an owner-stated party should count, sourced to their message.
