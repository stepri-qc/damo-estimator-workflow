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
| 3 | Skill coverage by shift: live shifts, on call outside them | Built |
| 4 | Transformation capacity | Next |
| 5 | Governance and reconciliation | Planned |
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

Towers are **AMS**, **IMS** or **DMS** ([F] 1.3 service functions). Each tower chooses how its demand is sized:

| Volumetrics available? | AMS | IMS | DMS |
|---|---|---|---|
| **Yes** | Incidents + service requests a month | same | same |
| **No** | Apps by complexity S–XXL at 4 / 10 / 17.5 / 30 / 50 tickets per app a month ([F] Sc.1 midpoints), **or** MAU × incident rate (0.5–2%, [F] Sc.1 Step 2) | Complexity points: environments × 1 + hosting platforms × 1.5 + databases × 1 + security in scope 3, × 4.5 tickets per point | Complexity points: data products × 1 + pipelines × 0.5 + integrations × 1 + upstream × 0.75 + downstream × 0.75, × 3.4 tickets per point |

IMS/DMS weights and tickets per point come from the `damo-estimator` structural-complexity model (pipelines weight is new). All are `proposed` and editable in the stage's Benchmarks panel.

Every route ends in tickets a month, which then follow the framework effort chain ([F] 1.1, 1.4, 1.5, p.3):

```
L2 tickets = tickets × 70%            L1 is the client's service desk
L3 tickets = L2 tickets × 20%
A          = (L2 × 3h + L3 × 10h) ÷ 85% utilisation
B          = A × 25% (modern) or 35% (complex legacy)
tower FTE  = (A + B) ÷ 160 hours a month, keeping the L2/L3 split from the effort
```

**Skill sets** form the bottom layer. Each tower lists the skill sets it needs (Front end, Back end / APIs, Mobile, Infra / Cloud, SRE, Database, Data engineering, named special skills) with a share %. The tower's FTE is split by those shares (scaled to 100% if they don't add up). Defaults: AMS Back end 60 / Front end 40, IMS Infra 80 / Database 20, DMS Data engineering 100.

The base team absorbs work first, at skill-set level:

```
capacity = Stage 1 roster × spare capacity %                  (proposed 25%)
absorbed = min(FTE of skill sets marked "Base has skill", capacity)
added    = tower FTE − absorbed
stage 2  = added × (1 + Σ active stage 2 risk %)
```

"Base has skill" is on by default for Front end, Back end and Infra / Cloud. Added FTE is spread across locations in the same proportion as the Stage 1 roster. Stage 3 will set which shifts each skill covers.

Default example: AMS "Customer apps" (2 S, 3 M, 1 L apps), IMS "Cloud platform" (4 environments, 2 hosting platforms, 4 databases, security) and DMS "Analytics platform" (4 data products, 10 pipelines, 3 integrations, 3 upstream, 2 downstream). That is 172 tickets a month, 5.53 tower FTE, 1.50 absorbed, +4.03 added, +4.64 after 15% risk. The team is 12.0 FTE, rostered as 14 people.

## Stage 3: skill coverage by shift

Skill sets marked **Base has skill** in Stage 2 are on every shift through the Stage 1 roster, so they add nothing here. For every other skill set, you pick the Stage 1 shifts where it must be **live** (default: shift 1) and the people per live shift (default 1). On the remaining shifts it is **on call**, costed at 15% of a staffed shift (`proposed`, editable).

```
floor(skill, loc) = (live shifts at loc × people + on-call shifts at loc × on-call %) × days ÷ b
                    ÷ availability(loc) when leave backfill is on
floor(skill)      = Σ floor(skill, loc)
have(skill)       = Stage 2 FTE after absorption and risk
top-up            = Σ max(0, floor − have)
stage 3           = top-up × (1 + Σ active stage 3 risk %)
```

Specialists sit in the locations covering their shifts. Top-up keeps the skill's L2/L3 effort split.

Default example: Database (IMS) and Data engineering (DMS) are live on shift 1 (India) and on call on shifts 2–3. Each has a floor of 1.46 FTE. Database has 0.47 FTE of effort, so it adds 1.00. Data engineering already has 1.98, so it adds nothing. With a 5% risk, Stage 3 adds 1.05, so the team is 13.0 FTE, rostered as 15 people.

### Copy summary
**Copy summary** puts each stage's working, the location table, the assumptions and the risks on the clipboard as Markdown, ready for the deal-review deck or notes.
