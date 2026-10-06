// Fast read-only endpoint. The public pages (the website's raffle page and the
// bar TV display) poll this every so often. It never talks to OneCause
// directly — it just returns whatever the scheduled function last cached — so
// any number of viewers can hit it without touching OneCause's rate limits.

import { getStore } from "@netlify/blobs";

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  // Public, read-only totals — safe to read from the main website's raffle page.
  "Access-Control-Allow-Origin": "*",
};

export default async () => {
  const store = getStore("raffle-pot");
  const snapshot = await store.get("current", { type: "json" });
  const status = await store.get("status", { type: "json" });

  if (!snapshot) {
    return new Response(
      JSON.stringify({
        totalRevenue: 0,
        ticketCount: 0,
        winnerPot: 0,
        programShare: 0,
        lastUpdated: null,
        note: "No data yet — waiting for first successful poll.",
        pollOk: status ? status.ok : null,
      }),
      { headers: HEADERS }
    );
  }

  return new Response(
    JSON.stringify({ ...snapshot, pollOk: status ? status.ok : null }),
    { headers: HEADERS }
  );
};

export const config = {
  path: "/api/pot-total",
};
