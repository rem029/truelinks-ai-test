# 05 — Issue agent (Part B) · Must

Goal: photos for a unit → condition, equipment, draft work order → human review → saved on the unit.

## Phase 1 — Report + analyse
### Tasks
- [ ] Report from the unit page: reporter role (tenant/inspector) as a field, note, 1..n photos
- [ ] Vision: per-photo condition (new/good/worn/damaged/undeterminable), damages, equipment
- [x] Sample photos in `data/sample-photos/` + `expected.json`
### Results
- 9 AI-generated photos (prompts in `PROMPTS.md`), compressed to ~1.9 MB total.
- `expected.json` written from what the photos actually show. Differences from prompts worth testing:
  - issue-02 photo 2 shows a corroded **drain** leak, not the tap → two faults; responsibility split (tap = tenant minor repair per lease 02 §7, drain maybe > QAR 500).
  - issue-03 adds exposed wiring + wet power socket → urgent safety advice.
  - issue-01 has AI-generated brand text on the AC → agent must not assert a brand.
  - issue-04 = no false positives; issue-05 = ask for a clearer photo.

## Phase 2 — Work order
### Tasks
- [ ] Agent loop with `get_unit_lease` (responsibility from maintenance clause), `draft_work_order`, `ask_user`
- [ ] Cards: condition + equipment, draft work order (title, what's wrong, unit, severity, category, responsibility + clause, photos)
- [ ] No issue → say so, no draft; unclear photo → ask for another
- [ ] Accept / reject / edit, or typed correction → patch → re-draft
- [ ] Confirm → saved against unit + active lease
### Results
-
