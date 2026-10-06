// Public, read-only endpoint:  /api/pot-total
//
// The raffle page (and the bar-TV display) call this to show the TOTAL pot.
// It asks OneCause for the event's paid raffle activity, totals it, and caches
// the answer so that no matter how many people have the page open, OneCause is
// contacted about once a minute:
//   1. in-memory cache inside this function (~45s), and
//   2. Netlify's CDN cache in front of it (60s, serving slightly stale data
//      while it refreshes in the background).
//
// No database or extra packages needed. If OneCause hiccups, the last good
// total is returned (flagged pollOk:false) instead of an error.
//
// All OneCause specifics (auth header, endpoint, field names) live in
// ../lib/onecause.js.

import { fetchAllActivities, summarize } from "../lib/onecause.js";

const MEMORY_TTL_MS = 45 * 1000;
let cache = null; // { at: ms, snapshot: {...} } — survives while the function stays warm

function respond(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    // Browsers always ask; Netlify's CDN may reuse an answer for 60s.
    "Cache-Control": "public, max-age=0, must-revalidate",
    // Public, read-only totals — safe to read from any page.
    "Access-Control-Allow-Origin": "*",
  };
  if (status === 200) {
    headers["Netlify-CDN-Cache-Control"] = "public, max-age=60, stale-while-revalidate=120";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default async () => {
  const orgId = (process.env.ONECAUSE_ORG_ID || "").trim();
  const eventId = (process.env.ONECAUSE_EVENT_ID || "").trim();
  const apiKey = (process.env.ONECAUSE_API_KEY || "").trim();
  const winnerSharePct = parseFloat(process.env.RAFFLE_WINNER_SHARE_PCT || "50");

  if (!orgId || !eventId || !apiKey) {
    console.error("Missing ONECAUSE_ORG_ID, ONECAUSE_EVENT_ID, or ONECAUSE_API_KEY env vars");
    return respond({ error: "not configured" }, 503);
  }

  if (cache && Date.now() - cache.at < MEMORY_TTL_MS) {
    return respond(cache.snapshot);
  }

  try {
    const { rows } = await fetchAllActivities({ orgId, eventId, apiKey });
    const snapshot = {
      ...summarize(rows, { winnerSharePct }),
      lastUpdated: new Date().toISOString(),
      pollOk: true,
    };
    cache = { at: Date.now(), snapshot };
    return respond(snapshot);
  } catch (err) {
    console.error(
      "OneCause fetch failed:",
      err && err.status ? `HTTP ${err.status} from ${err.url} — ${err.bodyText}` : String(err)
    );
    // Serve the last good total if we have one (the page shows its "as of" time).
    if (cache) return respond({ ...cache.snapshot, pollOk: false });
    return respond({ error: "temporarily unavailable" }, 503);
  }
};

export const config = {
  path: "/api/pot-total",
};
