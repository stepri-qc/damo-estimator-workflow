# DAMO Estimation Workflow

A step-by-step version of the DAMO estimator for deal reviews. It shows management how the estimate is built, one stage at a time. Each stage adds inputs, shows its working with the deal's own numbers, and records assumptions and risks. The fixed FTE bar at the bottom shows how each stage changes the team.

It is a companion to [`stepri-qc/damo-estimator`](https://github.com/stepri-qc/damo-estimator) and uses the same two sources:

| Tag | Source |
|---|---|
| `[F]` | DAMO Solution Estimation Framework (PDF) |
| `[P]` | AI_Works DAMO Team Pricing Sheet (xlsx) |

Values not taken from either source are marked `proposed`.

- **Source:** `index.html`. It is one self-contained file with no build step. State is saved in the browser's localStorage.
- **Deploy:** Netlify serves the repo root (`netlify.toml`).

## Stages

| # | Stage | Status |
|---|---|---|
| 1 | Base team: coverage, location, shifts | Built |
| 2 | Service towers and complexity (FE, BE, Mobile, Infra, SRE, Data, special skills) | Next |
| 3 | Special-skill coverage: every shift or only some | Planned |
| 4 | Transformation capacity | Planned |
| 5 | Effort-based cross-check (A + B tickets) | Planned |
| 6 | Seniority and risk multipliers | Planned |
| 7 | Commitment term and YoY savings | Planned |
| 8 | Brownfield existing capacity | Planned |

## Stage 1: base team

Inputs:
- **Coverage window:** days a week and hours a day, with presets from 8×5 to 24×7.
- **Shifts per day:** sets the shift length (hours ÷ shifts).
- **Contracted hours per FTE a week:** 40 by default.
- **Minimum L2 and L3 people on every shift.**
- **Delivery locations:** each has its own leave days and public holidays, and each shift is assigned to one location (follow-the-sun).

Calculation (framework p.3 coverage modifier, split by location):

```
a = shifts per day × days a week                      shifts to cover each week
b = contracted hours ÷ shift length                   shifts one FTE covers each week
c = L2 per shift + L3 per shift                       people on every shift
roster(loc, tier) = shifts per week at loc × people per shift(tier) ÷ b
                                                      Σ roster = (a × c) ÷ b
backfill(loc)     = roster ÷ availability             availability = (260 − leave − holidays) ÷ 260
risk              = backfill × (1 + Σ active risk %)
people            = rounded up per location and tier (or per location, total, or not at all)
```

A framework check confirms that the roster total equals `(a × c) ÷ b`. The p.3 example (24×5, 2 people per shift, 8h shifts) gives 6 FTE.

The default example is 24×5 with three 8h shifts: India covers two shifts and Romania covers one. The roster is 6.0 FTE, 6.8 FTE after backfill, and 7.3 FTE after an 8% risk modifier. Rounding up per location and tier gives 10 people.

### Assumptions and risks
- Auto assumptions (A1–A6) are generated from the inputs and cite their source. Assumptions added during the review (U1…) can be edited.
- Each risk has a title, an impact/mitigation note, an on/off toggle and an **FTE modifier %**. Active modifiers are added up and applied to the stage's post-backfill FTE. A 0% risk is recorded but adds no FTE.

### Copy summary
**Copy summary** puts the stage working, the location table, the assumptions and the risks on the clipboard as Markdown, ready for the deal-review deck or notes.
