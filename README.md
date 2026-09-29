# DAMO Estimation Workflow

A step-by-step version of the DAMO estimator for deal reviews. It shows management how the estimate is built, one stage at a time. Each stage adds inputs, shows its working with the deal's own numbers, and records assumptions and risks. The fixed FTE bar at the bottom shows how each stage changes the team.

It is a companion to [`stepri-qc/damo-estimator`](https://github.com/stepri-qc/damo-estimator) and uses the same two sources:

| Tag | Source |
|---|---|
| `[F]` | DAMO Solution Estimation Framework (PDF) |
| `[P]` | AI_Works DAMO Team Pricing Sheet (xlsx) |

Values not taken from either source are marked `proposed`.

- **Source:** `index.html`. It is one self-contained file with no build step. State is saved in the browser's localStorage.
- **Deploy:** Netlify serves the repo root and the extraction functions (`netlify.toml`). See [Documents and AI extraction](#stage-0-documents-and-ai-extraction).

## Inputs start blank from Stage 2

Stage 1 opens with a working base-team example so the coverage maths is visible at once. From Stage 2 onward nothing is pre-filled. The deal team supplies every input:

- **Stage 2:** no towers. A new tower has no name, unanswered questions, blank numbers and no skill sets. Until a tower's questions are answered it adds nothing.
- **Stage 3:** no live shifts picked.
- **Stage 4:** AI adoption not chosen (Low is used until it is).
- **Stage 6:** complexity not chosen (no contingency until it is).
- **Stage 7:** term not chosen (1 year is shown until it is).
- **Stage 8:** the existing team is blank.
- **Suggested risks** for Stages 2–8 are listed but switched off, so none changes FTE until turned on.
- **Kept as defaults:** the agreed conventions (on-call 15%, SDM 1:8, framework benchmarks).

The "Default example" paragraphs below use sample inputs to show the maths. They are not what the tool pre-fills.

## Stages

| # | Stage | Status |
|---|---|---|
| 0 | Documents: upload RFP, incident dump, meeting notes, others; Claude proposes inputs | Built |
| 1 | Base team: coverage, location, shifts | Built |
| 2 | Service towers (AMS, IMS, DMS, AI platforms), demand, skill sets and AIOps scope | Built |
| 3 | Skill coverage by shift: live shifts, on call outside them | Built |
| 4 | Transformation capacity: scenario, POD share less AI engineers already added | Built |
| 5 | Reconciliation (work team vs base team, larger wins) and SDM 1:8 | Built |
| 6 | Seniority pyramid and contingency by complexity | Built |
| 7 | Term and YoY savings as reduced FTE; 1- to 5-year comparison | Built |
| 8 | Fact check against the existing team | Built |

## Stage 0: documents and AI extraction

The tool opens on an optional **Documents** page. Add what you have for the deal, run **Extract with AI**, and Claude proposes inputs for every stage. You tick what to apply; nothing changes until you do. **Skip to Stage 1** ignores the page.

| Card | Accepts | What happens in the browser |
|---|---|---|
| RFP | PDF, DOCX, TXT, MD, pasted text | Text extracted (pdf.js, mammoth) |
| Incident dump | CSV, XLSX, XLS | Summarised locally: date range, tickets a month, incidents vs requests, priority mix, top 20 groups, first rows. Only this summary is sent to Claude, not the raw export. |
| Meeting notes | PDF, DOCX, TXT, MD, pasted text | Text extracted |
| Others | PDF, DOCX, XLSX, CSV, TXT, MD, JSON, pasted text | Text extracted (spreadsheets as CSV per sheet) |

Documents stay in memory for the session and are not saved to localStorage.

**What Claude proposes**, each with a short quote and the document it came from: deal name, coverage window (hours, days, out-of-hours active or on-call, weekends), service towers (kind, name, volumetrics or structural counts or MAU, estate, skill sets), AI adoption, complexity, term, existing team, assumptions and risks by stage, and open questions for the client. Applied risks arrive switched off at 0%, and open questions are added to the Stage 1 assumptions. The prompt and the cleaning of Claude's reply (allowed values, numeric ranges, skill ids) live in `extract-prompt.mjs`, shared by every route.

**Three routes**, picked automatically:

1. **On Netlify:** the page posts the text to `netlify/functions/extract-inputs-background.mts`, which calls Claude (`claude-opus-5-5`, streaming, server-side fallback enabled) and writes the result to Netlify Blobs; the page polls `extract-status.mts`. Limit 600,000 characters.
2. **In the claude.ai artifact viewer:** runs on the viewer's own Claude account after they allow it. Limit about 250,000 characters.
3. **Anywhere else (or as a fallback):** **Copy prompt**, paste it into a Claude chat, paste the reply back, **Use this reply**.

### Netlify setup

Set these in Site configuration → Environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key. It stays on the server; the page never sees it. |
| `INTAKE_PASSPHRASE` | Recommended | If set, the page must send this passphrase (users type it once; it is remembered in their browser). Stops anyone with the URL spending your API credit. |

Netlify installs `package.json` dependencies (`@anthropic-ai/sdk`, `@netlify/blobs`, `@netlify/functions`) at build time. There is no build command.

## Stage 1: base team

Inputs:
- **Coverage window:** days a week and hours a day, with presets from 8×5 to 24×7.
- **Shifts per day:** sets the shift length (hours ÷ shifts).
- **Contracted hours per FTE a week:** 40 by default.
- **Utilisation per resource:** 85% by default ([F] G6). Each person is productive 85% of contracted hours.
- **Minimum L2 and L3 people on every shift.**
- **Delivery locations:** each has its own leave days and public holidays, and each shift is assigned to one location (follow-the-sun).
- **Active or on-call per shift:** each shift is either **Active** (fully staffed, real FTE) or **On-call (P1)**, where people are reachable for P1 incidents only. For 6- or 7-day coverage, weekends can be Active (each shift's own mode) or On-call all day. On-call shift-days count as the **on-call allowance** (default 15%) of a staffed shift. All shifts start Active.

Calculation (framework p.3 coverage modifier, split by location):

```
a = shifts per day × days a week                      shifts to cover each week
a′ = active shift-days + on-call shift-days × on-call %  staffed shift-equivalents (a′ = a when all active)
b = contracted hours ÷ shift length                   shifts one FTE covers each week
c = L2 per shift + L3 per shift                       people on every shift
roster(loc, tier) = staffed shift-equivalents at loc × people per shift(tier) ÷ b
                                                      Σ roster = (a′ × c) ÷ b
utilised(loc)     = roster ÷ 85% utilisation
backfill(loc)     = utilised ÷ availability           availability = (260 − leave − holidays) ÷ 260
risk              = backfill × (1 + Σ active risk %)
people            = rounded up per location and tier (or per location, total, or not at all)
```

A framework check confirms that the roster total equals `(a × c) ÷ b`. With on-call shifts, the check shows the all-active figure and how much the on-call choice saves. Example: 24×5 with the night shift (Romania) on-call gives 10 active + 5 on-call × 15% = 10.75 shift-equivalents, so the roster is 4.30 instead of 6.00. The p.3 example (24×5, 2 people per shift, 8h shifts) gives 6 FTE.

The default example is 24×5 with three 8h shifts: India covers two shifts and Romania covers one. The roster is 6.0 FTE, 7.06 after 85% utilisation, 8.0 after leave backfill, and 8.65 after an 8% risk modifier.

Utilisation covers productive time (training, meetings, admin). Leave and holidays are a separate step, so the two don't overlap.

This base team is the **floor**. Stages 2–4 build a second team from the work (towers, specialist shift cover, transformation), and Stage 5 compares the two: the larger one is used.

Rounding to whole people is applied once, to the final team, after all stages.

### Assumptions and risks
- Auto assumptions (A1–A7) are generated from the inputs and cite their source. Assumptions added during the review (U1…) can be edited.
- Each risk has a title, an impact/mitigation note, an on/off toggle and an **FTE modifier %**. Active modifiers are added up and applied to the stage's post-backfill FTE. A 0% risk is recorded but adds no FTE.

## Stage 2: service towers and complexity

Towers are **AMS**, **IMS**, **DMS** ([F] 1.3 service functions) or **AI platforms** (AI platforms and agentic solutions). Each tower's demand comes from up to three questions, asked in order:

1. **Do you have volumetric data?** If yes, enter incidents + service requests a month.
2. **If not, do you know the estate's structural complexity?** If yes:
   - AMS: T-shirt size the apps S–XXL at 4 / 10 / 17.5 / 30 / 50 tickets per app a month ([F] Sc.1 Step 1 midpoints).
   - IMS: complexity points = environments × 1 + hosting platforms × 1.5 + databases × 1 + security in scope 3, × 4.5 tickets per point.
   - DMS: complexity points = data products × 1 + pipelines × 0.5 + integrations × 1 + upstream × 0.75 + downstream × 0.75, × 3.4 tickets per point.
   - AI platforms: complexity points = AI agents / agentic workflows × 2 + models served × 1.5 + tool/system integrations × 0.5 + knowledge sources (RAG / vector stores) × 0.75 + regulated or high-risk use cases 4, × 3.5 tickets per point (`proposed`). The estate choice is Managed AI services (APIs) at the modern non-ticketing rate, or Self-hosted models / custom agents at the complex rate.
3. **If neither is known:** tickets = monthly active users × incident rate (0.5–2%, default 1%, [F] Sc.1 Step 2). The card also shows the **implied complexity**: equivalent medium (M) apps, and an estate band (small < 25 tickets a month, medium < 75, large < 200, very large above; `proposed`).

A path marker on each card shows which route is in use. Assumption B4 lists each tower's route, and the MAU route is called out as the least certain.

IMS/DMS weights and tickets per point come from the `damo-estimator` structural-complexity model (pipelines weight is new); the AI platform weights are new. All are `proposed` and editable in the stage's Benchmarks panel.

Every route ends in tickets a month, which then follow the framework effort chain ([F] 1.1, 1.4, 1.5, p.3):

```
L2 tickets = tickets × 70%            L1 is the client's service desk
L3 tickets = L2 tickets × 20%
A          = (L2 × 3h + L3 × 10h) ÷ 85% utilisation
B          = A × 25% (modern) or 35% (complex legacy)
tower FTE  = (A + B) ÷ 160 hours a month, keeping the L2/L3 split from the effort
```

**Skill sets** form the bottom layer. Each tower lists the skill sets it needs, picked from a grouped dropdown. **Application and infrastructure:** Full stack developer, Backend API dev, Front end dev, Mobile dev (Native / Android / iOS), Infra support engineer, Service Reliability Engineer, QA, L1 support engineer. **Data:** Data Support Engineer, Database, Data engineering. **AI platforms** (listed first on AI platform towers): AI Engineer, Prompt Engineer, MLOps Engineer, LLMOps / Agent Ops Engineer, AI Evaluation & Guardrails Engineer, Data Scientist. **Other:** Niche skill (name it) for a specific skill the deal team names (more than one can be added). Each has a share %, and the tower's FTE is split by those shares (scaled to 100% if they don't add up, split equally until entered). Towers start with no skill sets.

The tower team is built from the work alone. It does **not** sit on top of the base team:

```
backfill factor    = Σ over locations (roster share ÷ availability)   when leave backfill is on, else 1
support FTE        = tower FTE × backfill factor × (1 + Σ active stage 2 risk %)
```

Leave and holiday backfill is applied to the tower team the same way as to the base team, weighted by where the tower FTE sits, so the two teams are compared like for like at Stage 5. Stage 3 compares each specialist's floor with its backfilled FTE for the same reason.

"Base has skill" (on by default for Full stack developer, Backend API dev, Front end dev and Infra support engineer) means the skill set is covered on every shift by the base roster. Other skill sets get their own shift cover in Stage 3. Tower FTE is spread across locations in the same proportion as the Stage 1 roster.

**AIOps per tower** ([F] Part 3, Sc.4 Step 3). Each tower asks *Is AIOps in scope for this tower?* If yes, AI engineers are embedded at the framework ratio: one per N support FTE of that tower, to build intelligent alerting, RCA automation, ticket auto-classification and self-healing.

```
support FTE(tower) = tower FTE × backfill factor × (1 + Σ active stage 2 risk %)
N                  = 4 for Low client AI adoption, 8 for Moderate (Scenarios 1/3 vs 2/4)
                     8 flexes to 6 when the AIOps towers carry over 20 support FTE; overridable
AI engineers       = Σ support FTE(towers with AIOps in scope) ÷ N
stage 2 tower team = support FTE + AI engineers
```

The ratio panel appears once a tower has AIOps in scope. It sets client AI adoption, the same input Stage 4 uses for the scenario. AI engineers count as L3 engineering, are spread across locations like the Stage 1 roster, get no shift cover in Stage 3, and are kept on top of the base team at reconciliation (they build automation; they do not staff shifts). The Documents page proposes AIOps scope per tower when the documents mention it.

Default example: AMS "Customer apps" (2 S, 3 M, 1 L apps), IMS "Cloud platform" (4 environments, 2 hosting platforms, 4 databases, security) and DMS "Analytics platform" (4 data products, 10 pipelines, 3 integrations, 3 upstream, 2 downstream). That is 172 tickets a month and 5.53 tower FTE, or 6.36 after 15% risk.

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

Default example: Database (IMS) and Data engineering (DMS) are live on shift 1 (India) and on call on shifts 2–3. Each has a floor of 1.72 FTE. Database has 0.47 FTE of effort, so it adds 1.25. Data engineering already has 1.98, so it adds nothing. With a 5% risk, Stage 3 adds 1.32. The run team from the work is 6.36 + 1.32 = 7.68 FTE.

## Stage 4: transformation capacity

The framework scenario ([F] Part 2–3) is worked out, not picked:

- **AI adoption** is an input: Low or Moderate.
- **Volumetrics available** is derived from Stage 2. It counts as available when towers sized from ticket history carry at least 50% of the tower FTE.

| | Volumetrics unavailable | Volumetrics available |
|---|---|---|
| **Low AI** | Scenario 1: POD 10–15% (12.5), AIOps 1:4 | Scenario 3: POD 10–15% (12.5, `proposed`), AIOps 1:4 |
| **Moderate AI** | Scenario 2: POD 15–20% (17.5), AIOps 1:8 | Scenario 4: POD 20%+ (20), AIOps 1:8 |

```
support team = Stages 2–3 without the AI engineers
POD          = support team × transformation %     (scenario midpoint, overridable)
AI engineers = added in Stage 2 for towers with AIOps in scope
added        = max(0, POD − AI engineers)          AI engineers sit inside the Transformation POD
stage 4      = added × (1 + Σ active stage 4 risk %)
```

With no tower in AIOps scope the whole POD is added. With AIOps in scope, the POD adds only what the AI engineers don't already cover, so AIOps is never counted twice.

Transformation FTE is counted as L3 and spread across locations like the Stage 1 roster. The stage also shows the scenario's guidance from the comparison matrix (confidence, Y1 contingency, team shape, AIOps timeline, commercial model, volume band clause, YoY savings target) for the deal review.

Default example: no tower has ticket history and AI adoption is Low, so this is Scenario 1. The support team is 7.68 and the POD is 0.96. If AIOps is in scope for all three towers, Stage 2 already added 6.36 ÷ 4 = 1.59 AI engineers, which exceed the POD, so Stage 4 adds nothing. Without AIOps, Stage 4 adds the POD: 0.96, or 1.01 with a 5% risk. (Examples from Stage 5 on were worked before AIOps moved into the towers; they show the method, not these exact numbers.)

## Stage 5: reconciliation and governance

**Reconciliation.** The team from the work is compared with the base team from coverage:

```
work team     = Stages 2–4 (towers + specialist cover + transformation, with risk), without AI engineers
base team     = Stage 1 (coverage, with utilisation, leave and risk)
delivery team = max(work team, base team) + AI engineers
lift          = max(0, base team − work team)     spread over the base team's locations and tiers
```

- **Work team larger:** it is kept, and the shifts are staffed from within it.
- **Work team smaller:** it is lifted to the base team size. The page shows the spare share of time, which is available for enhancements or transformation.

The comparison is shown as bars and a table (base team, team from the work, delivery team used) with a generated sentence saying which one sets the team and by how much.

**SDM only**, at the DAMO convention of one Service Delivery Manager per 8 delivery FTE (editable):

```
SDM     = delivery team ÷ 8
stage 5 = SDM × (1 + Σ active stage 5 risk %)
```

The SDM is a separate governance tier (not L2/L3) and is based in one Stage 1 location: onshore by default, then nearshore, then the first location. With whole-person rounding, SDMs round to the nearest person (at least one), not up.

Default example: the work team is 9.70 and the base team is 8.65, so the work sets the team (+12%) and 9.70 is kept. The SDM is 9.70 ÷ 8 = 1.21. If the work team were smaller, for example 2.59 with only one small tower, it would be lifted by +6.05 to 8.65.

## Stage 6: seniority and contingency

**Engagement complexity** is a deal-team input. It sets both the grade pyramid and the contingency:

| Complexity | Lead : Senior : Consultant | Contingency |
|---|---|---|
| Low: modern estate, standard CRUD apps, few integrations | 1 : 2 : 4 | 5% |
| Medium: mixed estate, several integrations, some regulated flows | 1 : 2 : 3 | 7.5% |
| High: legacy or regulated core, heavy integrations, data/ML pipelines | 1 : 2 : 2 | 10% |

1 : 2 : 4 is the DAMO manual-estimation pyramid. The Medium and High ratios are `proposed`. The pyramid and the contingency % can both be overridden.

```
delivery    = Stage 5 delivery team + SDM
contingency = delivery × contingency %                  (5–10%, [F] 1.6)
stage 6     = contingency × (1 + Σ active stage 6 risk %)
```

- **Contingency** is added as FTE and spread across L2/L3 in each location, in proportion to each cell.
- **The pyramid sets the grade mix only.** It splits L2 and L3 FTE into Lead / Senior / Consultant without changing headcount. SDMs are graded Lead. Whole people per grade are allocated by largest remainder.

Default example (Medium): 10.91 × 7.5% = +0.82, so the team is 11.7 FTE, rostered as 13 people (6 L2, 6 L3, 1 SDM). By grade: 3 Lead (including the SDM), 4 Senior, 6 Consultant.

## Stage 7: term and YoY savings

This stage is **FTE only**. No cost or rate factors are used anywhere in the tool.

```
floor      = Stage 1 base team (kept whole every year; can be switched off)
base(Yn)   = floor + (delivery team + SDM − floor) × (1 − savings %)^(n−1)
FTE(Yn)    = base(Yn) × (1 + contingency(Yn)) × (1 + Σ active stage 7 risk %, from Y2)
             contingency(Y1) = Stage 6 %, contingency(Y2+) = min(Stage 6 %, 6%)
```

- **Savings % per year from Y2** defaults to the scenario's YoY savings target midpoint ([F] Part 3): Sc1 13.5%, Sc2 11%, Sc3 13.5%, Sc4 17.5%. It can be edited. Nothing is committed in Y1.
- **Contingency tapers** after Y1, following the framework's Y1 8–10% → Y2+ 5–7% ([F] 1.6).
- **Term comparison:** a table shows 1- to 5-year terms with FTE by year, FTE-years, average FTE a year and the reduction against a 1-year contract. A generated sentence explains why a 3-year or longer term is better.

Default example (3-year term): 11.7 → 11.2 → 11.0, averaging 11.31 FTE a year. That is 4% below a 1-year contract; 5 years averages 11.03 (−6%). The savings are small here because the 8.65 FTE coverage floor is most of the team. Switch the floor off, or use a larger estate, to see the full effect.

## Stage 8: fact check against the existing team

This stage **does not change the estimate**. You enter the team running the estate today (client or incumbent) by tier: L2 support, L3 engineering, SRE/automation, service/delivery managers and other roles. You also record where the numbers come from (org chart, RFP/handover pack, or verbal estimate) and a tolerance (default ±10%).

| Existing | Compared with |
|---|---|
| L2 support | Our L2 |
| L3 engineering + SRE/automation | Our L3 (includes transformation capacity) |
| Service/delivery managers | Our SDMs |
| Other roles | Not in our model: flagged "not in our scope" |

Each tier and the total is marked consistent, above or below. Bars compare today's team with our Year 1, our term average and our final year. A generated sentence explains the result:

- **Consistent:** Year 1 is within tolerance.
- **Above:** it shows how much is transformation capacity and contingency the existing team may not carry, and what we would be without them.
- **Below:** it points to out-of-scope roles and base-team absorption, then frames the gap as the productivity case.

It always ends with where the team lands by the end of the term against today, and it flags verbal estimates as directional. Risks in this stage are tracked only.

Default example: the existing team is 13 FTE (6 L2, 4 L3, 1 SRE, 1 manager, 1 other). Our Year 1 is 11.7 (−10%, consistent), and Year 3 is 11.0 (−15% against today).

## The FTE bar and stage results

The bar at the bottom builds up **one stage at a time**. It shows the team as it stands at the end of the stage you are on, not the final estimate:

| On stage | Bar shows |
|---|---|
| 1 | Base team from coverage |
| 2–4 | Larger of the base team and the team from the work so far |
| 5 | + SDM |
| 6 | + contingency (the Year 1 team) |
| 7–8 | Final team, plus the term average or the fact check |

Rounding to whole people is applied to whatever the bar shows. If the work team is smaller than the base team, the base team itself (its locations and tiers) is the delivery team.

Each stage ends with a **"Team after Stage N"** strip: FTE, people, the change from the previous stage, and one line on why.

## Overall estimate: deal desk views

The Overall estimate panel at Stage 8 adds three views for approval:

- **Year 1 team by role.** Every FTE traced to the skill set and tower that asked for it, plus AI engineers, transformation, shift cover (when the base team is larger) and SDM. Contingency is spread over the delivery roles. The rows add up to the Year 1 team.
- **Allowances in the Year 1 team.** Productive need, then the productive-time allowance (utilisation), leave backfill, contingency and risk, each measured by switching it off in turn and re-running the engine, so they add up even though reconciliation keeps the larger of two teams. The headline is the buffer above productive capacity (leave + contingency + risk) in FTE and %, plus rounding.
- **Deviations from the framework.** Every benchmark, ratio or allowance changed from its framework or agreed value, with both values and the source. Empty when nothing was changed.

### Version and approval

The panel also holds version, prepared by, status (Draft / Submitted for approval / Approved), approver and approval date. Approving stores a fingerprint of every input. If any input changes afterwards, the header badge, the panel and both summaries say **Changed since approval** until it is approved again or set back to Draft.

**Save file** writes every input and the approval block to `<deal>-v<version>.damo.json`. **Open file** loads one back (it replaces the estimate on screen), so an estimate can be shared, archived with the deal and reopened exactly as approved. Browser storage is still used between visits.

## Customer summary

**Customer summary** (in the Overall estimate panel) downloads a client-facing page:

- Year 1 team, support window and the year-by-year team over the term
- How they are covered, shift by shift, in plain words (working vs on call for P1)
- What is in scope, how each service was sized, and whether AIOps is included
- The Year 1 team by role (merged across towers) and by location
- What we need from the client (L1 service desk, access, knowledge transfer, contacts; AI costs when relevant)
- The deal team's own assumptions, and what would change the team size

It leaves out contingency, risk modifiers, rounding lines, framework references and the stage working.

## Summary document

Stage 8 ends with an **Overall estimate** panel: headline figures (Year 1 team, rostered people, term average, scenario) and a table of how each stage built the team. **Download summary** (in that panel and in the header) produces a self-contained HTML document containing:

- the headline figures and the stage-by-stage build table, with rounding and the final Year 1 team
- the final team by location and tier
- for every stage: its result line, the full working, its tables, assumptions and risks

Open it in any browser and print to PDF if needed. In the claude.ai viewer the file is offered through the page's download prompt; on Netlify it downloads directly. A sample built from the example inputs is in [`docs/sample-estimate-summary.html`](docs/sample-estimate-summary.html).

### Copy summary
**Copy summary** puts each stage's working, the location table, the assumptions and the risks on the clipboard as Markdown, ready for the deal-review deck or notes.
