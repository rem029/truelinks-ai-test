# 08 — Settings · Stretch 4

Goal: owner manages units and rules in the UI; seeded from `data/` on first run.

## Phase 1 — Units + rules
### Tasks
- [ ] Units: list, add, edit, change status
- [ ] Rules: edit threshold / severity / enabled; saving creates a new ruleset version
- [ ] Lease results show which ruleset version they used
### Results
-

## Phase 2 — Models (owner request)
Until this phase the models are set in `.env` (`OPENROUTER_MODEL` for judgement, `OPENROUTER_FAST_MODEL` for simple jobs); `.env` stays the default when nothing is saved.
### Tasks
- [ ] Settings screen: pick the default and the fast model from OpenRouter's model list (`GET https://openrouter.ai/api/v1/models`), filtered to models that support JSON output (and images and tools for the default model)
- [ ] Show each model's price per million input/output tokens, plus an estimated cost per lease (from the logged token counts of recent extractions)
- [ ] Save the choice in the DB; the provider reads it per call, so a change applies without a restart. Log which model each call used (already in the model log line).
- [ ] Optional: "test on sample lease" button that runs one extraction and shows time, cost and whether the values matched the fixture (the comparison done by hand in task 04 phase 2)
### Results
-
