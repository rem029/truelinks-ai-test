# 07 — README & submission

## Phase 1 — README (2 files: README.md, this file)
Done near the end so it describes the finished app; see the order in `00-plan`.
### Tasks
- [ ] How to run (stub + OpenRouter), API requirements
- [ ] Decisions, trade-offs, what's left out, where it breaks first at scale
- [ ] Product enhancement ideas (from `00-plan` log)
- [ ] Improvements we may not get to (owner's notes, 2026-10-06). Reconcile the README roadmap with these:
  - **Accessibility:** each unit gets a printable QR code for reporting an issue; scanning it opens the report form with the unit preselected (owner or reporter prints it).
  - **Authentication:** a login for owner and inspector (replaces the "role shortcuts, no login" plan in 09 phase 1 for the roadmap write-up).
  - **Access control:** owner sees leases and issues; inspector sees issues only.
  - **Revised lease in the same conversation:** let the owner re-upload a file or images when the tenant or owner sends a revised agreement. Design to write up: the upload becomes a new document version in the same review; code compares clauses with the previous version and re-extracts only fields whose source clause changed (accepted fields on unchanged clauses stay locked; accepted fields on changed clauses reopen, flagged "changed in revision"); rules re-run. On a confirmed lease the revision is an amendment: a new draft version of the record that needs confirming again, with the confirmed one kept in history.
### Results
-

## Phase 2 — Submission (2 files)
### Tasks
- [ ] Public repo link of own work
- [ ] 30-day note + shipped work write-up
- [ ] Email contact@truelinks.ai
### Results
-
