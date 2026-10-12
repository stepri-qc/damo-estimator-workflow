/* Usage logging for the extraction function.
   Two kinds of cost are reported separately:
   - AI extraction: the tokens the model used, priced at list rates (times PRICE_MULTIPLIER for a negotiated discount).
   - Tool usage: what it takes to run the tool itself (function runs, run time, status polls), priced from rates you configure.
   Nothing from the documents or the answer is stored: only counts, sizes, the model and the outcome. */

/* USD per million tokens. list prices; edit here, or set PRICE_MULTIPLIER (e.g. 0.8) for a contract discount */
export const PRICES = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-fable-5-1": { in: 10, out: 50 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
};

export function costOf(model, u, multiplier = 1) {
  const p = PRICES[model];
  if (!p || !u) return { costUsd: 0, priced: false };
  const inTok = u.input_tokens || 0, outTok = u.output_tokens || 0, cr = u.cache_read_input_tokens || 0, cw = u.cache_creation_input_tokens || 0;
  const usd = (inTok * p.in + cw * p.in + cr * (p.cacheRead ?? p.in) + outTok * p.out) / 1e6;
  return { costUsd: usd * multiplier, priced: true };
}

export const POLL_SECONDS = 2; /* the page asks for the result every 2 s */

/* One record per run. outcome: ok, bad_passphrase, no_docs, too_long, no_key, refused, truncated, empty, bad_json, auth_error, rate_limited, api_error, error */
export async function logRun(store, rec) {
  const at = rec.at || new Date().toISOString();
  await store.setJSON(`run/${at}-${rec.jobId || "x"}`, { ...rec, at });
}

const dayOf = (iso) => String(iso).slice(0, 10);
const num = (v) => (Number.isFinite(+v) ? +v : 0);

/* records: the stored run records; cfg: {days, now, hostingMonthlyUsd, usdPerFunctionSecond, usdPerThousandInvocations} */
export function summarize(records, cfg = {}) {
  const now = cfg.now ? new Date(cfg.now) : new Date();
  const days = Math.max(1, Math.min(366, +cfg.days || 30));
  const from = new Date(now.getTime() - days * 86400000);
  const rows = records.filter((r) => r && r.at && new Date(r.at) >= from && new Date(r.at) <= now);
  const ai = { runs: 0, succeeded: 0, failed: 0, notSent: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0, maxRunUsd: 0, unpricedRuns: 0, byModel: {}, byOutcome: {} };
  const byDay = {};
  let fnSeconds = 0;
  rows.forEach((r) => {
    ai.byOutcome[r.outcome] = (ai.byOutcome[r.outcome] || 0) + 1;
    const sent = num(r.inputTokens) + num(r.outputTokens) > 0;
    const secs = num(r.durationMs) / 1000;
    fnSeconds += secs;
    const d = (byDay[dayOf(r.at)] ||= { date: dayOf(r.at), runs: 0, aiCostUsd: 0, functionSeconds: 0 });
    d.runs++; d.functionSeconds += secs;
    if (!sent) { ai.notSent++; return; }
    ai.runs++;
    if (r.outcome === "ok") ai.succeeded++; else ai.failed++;
    ai.inputTokens += num(r.inputTokens); ai.outputTokens += num(r.outputTokens); ai.cacheReadTokens += num(r.cacheReadTokens);
    ai.costUsd += num(r.costUsd); d.aiCostUsd += num(r.costUsd);
    ai.maxRunUsd = Math.max(ai.maxRunUsd, num(r.costUsd));
    if (r.priced === false) ai.unpricedRuns++;
    const m = (ai.byModel[r.model || "unknown"] ||= { runs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    m.runs++; m.inputTokens += num(r.inputTokens); m.outputTokens += num(r.outputTokens); m.costUsd += num(r.costUsd);
  });
  ai.avgRunUsd = ai.runs ? ai.costUsd / ai.runs : 0;
  const polls = rows.reduce((n, r) => n + Math.ceil(num(r.durationMs) / 1000 / POLL_SECONDS) + 1, 0);
  const invocations = rows.length + polls;
  const hasRates = [cfg.hostingMonthlyUsd, cfg.usdPerFunctionSecond, cfg.usdPerThousandInvocations].some((v) => Number.isFinite(+v) && +v > 0);
  const tool = {
    extractionRuns: rows.length,
    functionSeconds: fnSeconds,
    estimatedStatusPolls: polls,
    estimatedInvocations: invocations,
    estimatedUsd: hasRates
      ? num(cfg.hostingMonthlyUsd) * (days / 30) + fnSeconds * num(cfg.usdPerFunctionSecond) + (invocations / 1000) * num(cfg.usdPerThousandInvocations)
      : null,
    rates: { hostingMonthlyUsd: num(cfg.hostingMonthlyUsd), usdPerFunctionSecond: num(cfg.usdPerFunctionSecond), usdPerThousandInvocations: num(cfg.usdPerThousandInvocations) },
    note: hasRates ? "Priced from the HOSTING_MONTHLY_USD, USD_PER_FUNCTION_SECOND and USD_PER_THOUSAND_INVOCATIONS settings." : "No hosting rates are set, so no tool cost is calculated. Set HOSTING_MONTHLY_USD, USD_PER_FUNCTION_SECOND and USD_PER_THOUSAND_INVOCATIONS to price it.",
  };
  return {
    period: { days, from: from.toISOString(), to: now.toISOString() },
    aiExtraction: ai,
    toolUsage: tool,
    totalEstimatedUsd: ai.costUsd + (tool.estimatedUsd || 0),
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
