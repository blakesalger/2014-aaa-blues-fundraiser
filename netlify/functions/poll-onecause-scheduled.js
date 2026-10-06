// Scheduled function — runs automatically on the schedule at the bottom of
// this file. Pulls the paid raffle activity for the event from the OneCause
// Public API, totals it, and caches the result in Netlify Blobs so the public
// pages can read it fast (and as often as they like) without ever calling
// OneCause directly.
//
// All the OneCause specifics (auth header, endpoint, field names) live in
// ../lib/onecause.js, which follows OneCause's published API docs.

import { getStore } from "@netlify/blobs";
import { fetchAllActivities, summarize, OneCauseError } from "../lib/onecause.js";

export default async () => {
  // trim(): a stray space or newline from copy/paste would otherwise break auth
  const orgId = (process.env.ONECAUSE_ORG_ID || "").trim();
  const eventId = (process.env.ONECAUSE_EVENT_ID || "").trim();
  const apiKey = (process.env.ONECAUSE_API_KEY || "").trim();
  const winnerSharePct = parseFloat(process.env.RAFFLE_WINNER_SHARE_PCT || "50");

  if (!orgId || !eventId || !apiKey) {
    console.error("Missing ONECAUSE_ORG_ID, ONECAUSE_EVENT_ID, or ONECAUSE_API_KEY env vars");
    return new Response("Missing config", { status: 500 });
  }

  const store = getStore("raffle-pot");

  try {
    const { rows, pages } = await fetchAllActivities({ orgId, eventId, apiKey });
    const summary = summarize(rows, { winnerSharePct });

    const snapshot = {
      ...summary,
      lastUpdated: new Date().toISOString(),
    };

    await store.setJSON("current", snapshot);
    await store.setJSON("status", { ok: true, at: snapshot.lastUpdated });
    console.log(`Updated pot snapshot from ${rows.length} activities over ${pages} page(s):`, snapshot);

    return new Response(JSON.stringify(snapshot), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Keep serving the last good total; just record that the latest poll failed.
    const detail =
      err instanceof OneCauseError
        ? `HTTP ${err.status} from ${err.url} — ${err.bodyText}`
        : String(err);
    console.error("Poll failed:", detail);
    try {
      await store.setJSON("status", { ok: false, at: new Date().toISOString() });
    } catch {
      // ignore — logging the failure above is what matters
    }
    return new Response(JSON.stringify({ error: "poll failed — see function logs" }), {
      status: 500,
    });
  }
};

export const config = {
  // Every minute (Netlify's minimum granularity). The display pages poll the
  // cached value far more often than this, which is what makes it feel live.
  schedule: "* * * * *",
};
