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
| 2 | Service towers and complexity (FE, BE, Mobile, Infra, SRE, Data, special skills) | Built |
| 3 | Special-skill coverage: every shift or only some | Next |
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

The default example is 24×5 with three 8h shifts: India covers two shifts and Romania covers one. The roster is 6.0 FTE, 6.8 FTE after backfill, and 7.35 FTE after an 8% risk modifier.

Rounding to whole people is applied once, to the final team, after all stages.

### Assumptions and risks
- Auto assumptions (A1–A6) are generated from the inputs and cite their source. Assumptions added during the review (U1…) can be edited.
- Each risk has a title, an impact/mitigation note, an on/off toggle and an **FTE modifier %**. Active modifiers are added up and applied to the stage's post-backfill FTE. A 0% risk is recorded but adds no FTE.

## Stage 2: service towers and complexity

Towers are skill sets: Front end, Back end / APIs, Mobile, Infra / Cloud, SRE, Data, and named special skills. Each tower is rated S / M / L / XL / XXL, using the framework's complexity descriptions ([F] Scenario 1, Step 1). Each size adds a set FTE (proposed: S 0.5, M 1, L 1.5, XL 2, XXL 3; editable).

The base team absorbs work first:

```
demand     = Σ FTE per tower size
capacity   = Stage 1 roster × spare capacity %           (proposed 25%)
absorbed   = min(demand of towers the base team has skills for, capacity)
added      = demand − absorbed
stage 2    = added × (1 + Σ active stage 2 risk %)
```

Each tower has a **Base team has this skill** switch. It is on by default for Front end, Back end and Infra, and off for Mobile, SRE, Data and special skills. Absorbed FTE is shared across skill-matched towers in proportion to their demand. Tower FTE is split L2/L3 (proposed 40/60) and across locations in the same proportion as the Stage 1 roster. Stage 3 will refine which shifts each skill covers.

Default example: Back end M, Front end S, Infra M and Data L give 4.0 FTE of demand. The base team absorbs 1.5 (6.0 × 25%), leaving 2.5 added. A 15% risk modifier takes that to +2.88, so the team is 10.22 FTE, rostered as 12 people.

### Copy summary
**Copy summary** puts each stage's working, the location table, the assumptions and the risks on the clipboard as Markdown, ready for the deal-review deck or notes.
