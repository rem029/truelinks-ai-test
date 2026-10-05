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
### Tasks
- [ ] Agent loop with `get_unit_lease` (responsibility from maintenance clause), `draft_work_order`, `ask_user`
- [ ] Cards: condition + equipment, draft work order (title, what's wrong, unit, severity, category, responsibility + clause, photos)
- [ ] No issue → say so, no draft; unclear photo → ask for another
- [ ] Accept / reject / edit, or typed correction → patch → re-draft
- [ ] Confirm → saved against unit + active lease
### Results
-
