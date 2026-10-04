# TrueLinks Lease & Issue Agents

A small full-stack service where AI agents turn a lease document into a structured, verifiable lease record, validate it against an owner's rules, and turn property photos into draft work orders — all linked to the unit.

> Work in progress.

## Repository layout

```
apps/api          Express 5 API (TypeScript)
apps/web          Vite + React UI (TypeScript)
packages/shared   Shared types / schemas
data/             Owner ruleset, units, sample leases & photos
scripts/          Dev utilities (sample data generation)
```

## Sample data

- `data/owner_ruleset.json`, `data/units.json` — provided with the brief.
- `data/sample-leases/` — generated test leases (PDF), each designed to exercise specific rules. Regenerate with `npm run samples:leases`.

| File | Unit | Exercises |
|---|---|---|
| `lease-01-clean-MC-B-1204.pdf` | MC-B-1204 (available) | Happy path — all rules PASS |
| `lease-02-problems-MC-B-0902.pdf` | MC-B-0902 | R1, R2, R4, R5, R6 FAIL; unit matched by label + parking bay (no unit ID) |
| `lease-03-occupied-MC-B-1205.pdf` | MC-B-1205 (occupied) | R3 (48-month term), R7 (unit occupied) FAIL |
| `lease-04-quarterly-no-deposit-MC-A-0301.pdf` | MC-A-0301 | Quarterly rent normalisation; no deposit → R1 NOT_DETERMINABLE |
| `lease-05-unknown-unit-rent-conflict.pdf` | Tower C (not in records) | R7 FAIL; conflicting monthly rent (8,500 vs 8,000) must be flagged, not silently resolved |

`data/sample-leases/expected.json` holds the expected rule outcomes and flags per lease, used by tests and the stub model provider.

## Decisions

- **Term length counts the expiry date as inclusive.** A lease from 1 Nov 2026 to 31 Oct 2028 is 24 months. Rule R4 uses this convention.

## Product ideas

_Collected as we build._
