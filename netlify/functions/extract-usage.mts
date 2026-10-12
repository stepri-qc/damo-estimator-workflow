import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { summarize } from "../../lib/usage.mjs";

// Admin report on extraction usage and cost: AI extraction (tokens) and tool usage (function runs and time), separately.
// Open with  /.netlify/functions/extract-usage?days=30  and the header  x-usage-key: <USAGE_ADMIN_KEY>
// (the page usage.html does this). Add &format=csv for one row per run. Without USAGE_ADMIN_KEY set, the report is off.
export default async (req: Request, _context: Context) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const key = Netlify.env.get("USAGE_ADMIN_KEY");
  if (!key) return json({ error: "The usage report is off: set USAGE_ADMIN_KEY on the site to turn it on." }, 403);
  const url = new URL(req.url);
  if ((req.headers.get("x-usage-key") || url.searchParams.get("key")) !== key) return json({ error: "Wrong or missing key" }, 401);

  const store = getStore({ name: "damo-workflow-usage", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "run/" });
  const records: any[] = [];
  for (const b of blobs) {
    const r = await store.get(b.key, { type: "json" });
    if (r) records.push(r);
  }
  const rate = (name: string) => { const v = Number(Netlify.env.get(name)); return Number.isFinite(v) && v > 0 ? v : 0; };
  const days = Number(url.searchParams.get("days")) || 30;
  const cfg = { days, hostingMonthlyUsd: rate("HOSTING_MONTHLY_USD"), usdPerFunctionSecond: rate("USD_PER_FUNCTION_SECOND"), usdPerThousandInvocations: rate("USD_PER_THOUSAND_INVOCATIONS") };

  if (url.searchParams.get("format") === "csv") {
    const cols = ["at", "outcome", "model", "docs", "chars", "inputTokens", "outputTokens", "cacheReadTokens", "costUsd", "durationMs", "stopReason", "fellBack"];
    const cutoff = Date.now() - days * 86400000;
    const rows = records.filter((r) => new Date(r.at).getTime() >= cutoff).sort((a, b) => a.at.localeCompare(b.at));
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=extraction-usage.csv", "Cache-Control": "no-store" } });
  }
  return json(summarize(records, cfg));
};
