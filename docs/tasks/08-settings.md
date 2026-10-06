# 08 — Settings · Stretch 4

Goal: owner manages units and rules in the UI; seeded from `data/` on first run.

## Phase 1 — Units + rules
### Tasks
- [x] Settings in the sidebar footer opens a modal (native `<dialog>`) with Rules and Units tabs
- [x] Units: list, add (joins an existing building, starts available)
- [ ] Units: edit, change status (later)
- [x] Rules: list the current ruleset; add a field-comparison rule (code checks) or a plain-language rule (the model judges with a verified quote); adding saves a new ruleset version
- [x] Rules: edit (comparison and plain-language rules fully; built-in R1–R7 severity only), delete with confirmation, version history (read-only past versions) and restore; every change saves a new version with a change note
- [x] Lease results show which ruleset version they used (already stored per lease and per result)
### Results
- Owner request: "view current and able to add" for rules and units; both kinds of rule ("can combine options 1 + 2").
- **Rule kinds** (`Rule.kind`): `builtin` (R1–R7, hand-written checks), `comparison` (field op number, field op factor × field, or boolean field = yes/no; checked by `comparisonRule.ts`), `ai` (judged in the background analysis; `ownerRuleResults.ts` keeps a PASS only with a verified quote). `RuleResult.checkedBy` is `code` or `ai`; re-evaluation keeps the last AI verdict. Rules JSON lives in the existing `rules_json` column, so no migration.
- **Versions:** `1.0` → `1.1` per added rule; new ids continue at R8. Open drafts pick up the new version the next time they are re-evaluated.
- **API:** `GET /api/rulesets/current`, `POST /api/rulesets/current/rules` (`NewRule`), `POST /api/units` (`NewUnit`, 409 on a duplicate id).
- **Real model** (lease 01, two AI rules): "must forbid subletting without consent" → FAIL (no clause); "landlord responsible for AC repairs" → PASS quoting clause 7, quote verified.
- **e2e:** `e2e/settings.spec.ts` adds a field rule (Monthly Rent ≤ 9,000), an AI rule and a unit, then lease 01 fails R8 with "Monthly Rent is 9,500".
- **History (owner follow-up):** "we cannot access previous versions or delete/edit a rule; every change should give a new version". Migration `006_ruleset_change_note` adds `rulesets.change_note`. `rulesetChanges.ts` holds add/edit/delete/restore; each saves the next version via one `saveVersion`. Rule ids continue past every id in any version, so a deleted R9 never returns as a different rule in old results. Restore copies an old version forward; nothing is rewritten. API: `GET /api/rulesets`, `PATCH`/`DELETE /api/rulesets/current/rules/:ruleId`, `POST /api/rulesets/:version/restore`.
- **Layout pass (`/impeccable layout`, owner: "too dense"):** list first, forms replace the list with a back link; rules as a readable list with a quiet "checked by" line; rule kind as two option cards; units table down to 4 columns; spacing on a 4-based scale; SVG icons instead of glyphs; fixed dialog height; full-screen on phones.
- Not done: edit/retire units; switching a rule off without deleting it; re-checking open drafts on demand.

## Phase 2 — Models (owner request)
Until this phase the models are set in `.env` (`OPENROUTER_MODEL` for judgement, `OPENROUTER_FAST_MODEL` for simple jobs); `.env` stays the default when nothing is saved.
### Tasks
- [ ] Settings screen: pick the default and the fast model from OpenRouter's model list (`GET https://openrouter.ai/api/v1/models`), filtered to models that support JSON output (and images and tools for the default model)
- [ ] Show each model's price per million input/output tokens, plus an estimated cost per lease (from the logged token counts of recent extractions)
- [ ] Save the choice in the DB; the provider reads it per call, so a change applies without a restart. Log which model each call used (already in the model log line).
- [ ] Optional: "test on sample lease" button that runs one extraction and shows time, cost and whether the values matched the fixture (the comparison done by hand in task 04 phase 2)
### Results
-
