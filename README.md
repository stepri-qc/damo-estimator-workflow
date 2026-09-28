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
| 4 | Transformation capacity: scenario, POD share, AIOps ratio | Built |
| 5 | Governance (SDM 1:8) and coverage-led vs effort-led comparison | Built |
| 6 | Seniority pyramid and contingency by complexity | Built |
| 7 | Term and YoY savings as reduced FTE; 1- to 5-year comparison | Built |
| 8 | Brownfield existing capacity | Next |

## Stage 1: base team

Inputs:
- **Coverage window:** days a week and hours a day, with presets from 8×5 to 24×7.
- **Shifts per day:** sets the shift length (hours ÷ shifts).
- **Contracted hours per FTE a week:** 40 by default.
- **Utilisation per resource:** 85% by default ([F] G6). Each person is productive 85% of contracted hours.
- **Minimum L2 and L3 people on every shift.**
- **Delivery locations:** each has its own leave days and public holidays, and each shift is assigned to one location (follow-the-sun).

Calculation (framework p.3 coverage modifier, split by location):

```
a = shifts per day × days a week                      shifts to cover each week
b = contracted hours ÷ shift length                   shifts one FTE covers each week
c = L2 per shift + L3 per shift                       people on every shift
roster(loc, tier) = shifts per week at loc × people per shift(tier) ÷ b
                                                      Σ roster = (a × c) ÷ b
utilised(loc)     = roster ÷ 85% utilisation
backfill(loc)     = utilised ÷ availability           availability = (260 − leave − holidays) ÷ 260
risk              = backfill × (1 + Σ active risk %)
people            = rounded up per location and tier (or per location, total, or not at all)
```

A framework check confirms that the roster total equals `(a × c) ÷ b`. The p.3 example (24×5, 2 people per shift, 8h shifts) gives 6 FTE.

The default example is 24×5 with three 8h shifts: India covers two shifts and Romania covers one. The roster is 6.0 FTE, 7.06 after 85% utilisation, 8.0 after leave backfill, and 8.65 after an 8% risk modifier.

Utilisation covers productive time (training, meetings, admin). Leave and holidays are a separate step, so the two don't overlap.

Rounding to whole people is applied once, to the final team, after all stages.

### Assumptions and risks
- Auto assumptions (A1–A7) are generated from the inputs and cite their source. Assumptions added during the review (U1…) can be edited.
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

Default example: AMS "Customer apps" (2 S, 3 M, 1 L apps), IMS "Cloud platform" (4 environments, 2 hosting platforms, 4 databases, security) and DMS "Analytics platform" (4 data products, 10 pipelines, 3 integrations, 3 upstream, 2 downstream). That is 172 tickets a month, 5.53 tower FTE, 1.50 absorbed, +4.03 added, +4.64 after 15% risk. With the updated Stage 1, the team is 13.3 FTE.

## Stage 3: skill coverage by shift

Skill sets marked **Base has skill** in Stage 2 are on every shift through the Stage 1 roster, so they add nothing here. For every other skill set, you pick the Stage 1 shifts where it must be **live** (default: shift 1) and the people per live shift (default 1). On the remaining shifts it is **on call**, counted as 15% of a staffed shift (`proposed`, editable).

```
floor(skill, loc) = (live shifts at loc × people + on-call shifts at loc × on-call %) × days ÷ b ÷ 85% utilisation
                    ÷ availability(loc) when leave backfill is on
floor(skill)      = Σ floor(skill, loc)
have(skill)       = Stage 2 FTE after absorption and risk
top-up            = Σ max(0, floor − have)
stage 3           = top-up × (1 + Σ active stage 3 risk %)
```

Specialists sit in the locations covering their shifts. Top-up keeps the skill's L2/L3 effort split.

Default example: Database (IMS) and Data engineering (DMS) are live on shift 1 (India) and on call on shifts 2–3. Each has a floor of 1.72 FTE. Database has 0.47 FTE of effort, so it adds 1.25. Data engineering already has 1.98, so it adds nothing. With a 5% risk, Stage 3 adds 1.31, so the team is 14.6 FTE, rostered as 17 people.

## Stage 4: transformation capacity

The framework scenario ([F] Part 2–3) is worked out, not picked:

- **AI adoption** is an input: Low or Moderate.
- **Volumetrics available** is derived from Stage 2. It counts as available when towers sized from ticket history carry at least 50% of the tower FTE.

| | Volumetrics unavailable | Volumetrics available |
|---|---|---|
| **Low AI** | Scenario 1: POD 10–15% (12.5), AIOps 1:4 | Scenario 3: POD 10–15% (12.5, `proposed`), AIOps 1:4 |
| **Moderate AI** | Scenario 2: POD 15–20% (17.5), AIOps 1:8 | Scenario 4: POD 20%+ (20), AIOps 1:8 |

```
team so far = Stages 1–3
POD         = team so far × transformation %      (scenario midpoint, overridable)
AIOps       = team so far ÷ ratio                 (1:8 flexes to 1:6 over 20 FTE; overridable)
added       = max(POD, AIOps)                     AIOps engineers sit inside the Transformation POD
stage 4     = added × (1 + Σ active stage 4 risk %)
```

Transformation FTE is counted as L3 and spread across locations like the Stage 1 roster. The stage also shows the scenario's guidance from the comparison matrix (confidence, Y1 contingency, team shape, AIOps timeline, commercial model, volume band clause, YoY savings target) for the deal review.

Default example: no tower has ticket history and AI adoption is Low, so this is Scenario 1. The team so far is 14.60. The POD is 1.83 and AIOps at 1:4 is 3.65, so 3.65 is added, or 3.83 with a 5% risk. The team is 18.4 FTE, rostered as 21 people. With Moderate AI (Scenario 2), the POD of 2.56 exceeds AIOps at 1:8 (1.83), so Stage 4 adds 2.68 instead.

## Stage 5: governance and reconciliation

**SDM only**, at the DAMO convention of one Service Delivery Manager per 8 delivery FTE (editable):

```
delivery team = Stages 1–4
SDM           = delivery team ÷ 8
stage 5       = SDM × (1 + Σ active stage 5 risk %)
```

The SDM is a separate governance tier (not L2/L3) and is based in one Stage 1 location: onshore by default, then nearshore, then the first location. With whole-person rounding, SDMs round to the nearest person (at least one), not up.

**Side-by-side comparison** for the review:

| View | What sets it | Calculation |
|---|---|---|
| Coverage-led | Support window and shifts | Stage 1 roster ÷ utilisation ÷ leave availability (before risk) |
| Effort-led | Ticket volume and complexity | Stage 2 tower (A + B) ÷ 160h (before absorption and risk) |
| Single-method estimate | Larger of the two | Coverage as a floor on effort ([F] 1.1 C) |
| This workflow, delivery | Stages 1–3 with risk | Base team + tower work not absorbed + specialist cover |

A generated sentence says which one sets the team, by how much, how much spare time a single team would have, and why the workflow's delivery team is above the single-method estimate.

Default example: coverage-led 8.00, effort-led 5.53, single-method 8.00, workflow delivery 14.60. The support window sets the team (45% above effort, about 31% spare time). The SDM is 18.44 ÷ 8 = 2.30, so the team is 20.7 FTE, rostered as 23 people (9 L2, 12 L3, 2 SDM).

## Stage 6: seniority and contingency

**Engagement complexity** is a deal-team input. It sets both the grade pyramid and the contingency:

| Complexity | Lead : Senior : Consultant | Contingency |
|---|---|---|
| Low: modern estate, standard CRUD apps, few integrations | 1 : 2 : 4 | 5% |
| Medium: mixed estate, several integrations, some regulated flows | 1 : 2 : 3 | 7.5% |
| High: legacy or regulated core, heavy integrations, data/ML pipelines | 1 : 2 : 2 | 10% |

1 : 2 : 4 is the DAMO manual-estimation pyramid. The Medium and High ratios are `proposed`. The pyramid and the contingency % can both be overridden.

```
team so far = Stages 1–5
contingency = team so far × contingency %            (5–10%, [F] 1.6)
stage 6     = contingency × (1 + Σ active stage 6 risk %)
```

- **Contingency** is added as FTE and spread across L2/L3 in each location, in proportion to each cell.
- **The pyramid sets the grade mix only.** It splits L2 and L3 FTE into Lead / Senior / Consultant without changing headcount. SDMs are graded Lead. Whole people per grade are allocated by largest remainder.

Default example (Medium): 20.74 × 7.5% = +1.56, so the team is 22.3 FTE, rostered as 23 people. By grade: 6 Lead (including 2 SDMs), 7 Senior, 10 Consultant.

## Stage 7: term and YoY savings

This stage is **FTE only**. No cost or rate factors are used anywhere in the tool.

```
floor      = Stage 1 base team (kept whole every year; can be switched off)
base(Yn)   = floor + (Stages 1–5 − floor) × (1 − savings %)^(n−1)
FTE(Yn)    = base(Yn) × (1 + contingency(Yn)) × (1 + Σ active stage 7 risk %, from Y2)
             contingency(Y1) = Stage 6 %, contingency(Y2+) = min(Stage 6 %, 6%)
```

- **Savings % per year from Y2** defaults to the scenario's YoY savings target midpoint ([F] Part 3): Sc1 13.5%, Sc2 11%, Sc3 13.5%, Sc4 17.5%. It can be edited. Nothing is committed in Y1.
- **Contingency tapers** after Y1, following the framework's Y1 8–10% → Y2+ 5–7% ([F] 1.6).
- **Term comparison:** a table shows 1- to 5-year terms with FTE by year, FTE-years, average FTE a year and the reduction against a 1-year contract. A generated sentence explains why a 3-year or longer term is better.

Default example (3-year term): 22.3 → 20.3 → 18.8, averaging 20.44 FTE a year. That is 8% below a 1-year contract; 5 years averages 19.0 (−15%). Without the coverage floor, a 3-year term averages 19.3 (−14%).

### Copy summary
**Copy summary** puts each stage's working, the location table, the assumptions and the risks on the clipboard as Markdown, ready for the deal-review deck or notes.
