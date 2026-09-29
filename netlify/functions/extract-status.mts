import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Polled by the page after it starts extract-inputs-background.
export default async (req: Request, _context: Context) => {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const store = getStore({ name: "damo-workflow-extraction-jobs", consistency: "strong" });
  const result = await store.get(jobId, { type: "json" });
  return new Response(JSON.stringify(result || { status: "pending" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
