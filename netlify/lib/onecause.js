// Shared OneCause Public API helpers, used by both the scheduled poller and
// the connection tester so they can never disagree about how to talk to
// OneCause.
//
// Source of truth: OneCause Help Center
//   - "OneCause Public API: Overview, Setup, & Endpoint Guide"
//   - "OneCause Public API: Paid Activity Endpoint"
//
// Facts taken from those docs:
//   * Auth header is   Authorization: api <YOUR_API_KEY>
//     ("api" lowercase, one space, then the key — NOT "Bearer", NOT X-Api-Key)
//   * Paid activity endpoint (new version, June 2026):
//       GET https://phaas-public-api.onecause.com/v2/organizations/{orgId}/supporters/activities-v3
//   * Filter to one event with   originIDs=vevt:{eventId}
//   * Pagination: pageSize (max 1000) + pageNumber; the response carries
//     next_page_number, which is null on the last page.
//   * Raffle lines have purchased_item_type = "Raffle".
//   * payment_status is "successful", "failed", "refunded", or blank (unpaid).

const BASE = "https://phaas-public-api.onecause.com/v2";
const PAGE_SIZE = 1000;
const MAX_PAGES = 100; // safety valve so a bad response can never loop forever

export class OneCauseError extends Error {
  constructor(status, bodyText, url) {
    super(`OneCause API returned ${status}`);
    this.status = status;
    this.bodyText = bodyText;
    this.url = url;
  }
}

export function authHeaders(apiKey) {
  return { Authorization: `api ${apiKey}`, Accept: "application/json" };
}

// Accept an Event ID exactly as OneCause shows it: with or without the
// "VEVT"/"vevt:" prefix, in any capitalization. (The ID itself keeps its case.)
export function stripEventPrefix(eventId) {
  return String(eventId ?? "").trim().replace(/^vevt[:\s_-]*/i, "");
}

export function activitiesUrl(orgId, eventId, pageNumber = 1, pageSize = PAGE_SIZE) {
  // OneCause's API wants the lowercase "vevt:" prefix in front of the ID, so
  // strip whatever prefix was pasted and add it exactly once.
  const origin = `vevt:${stripEventPrefix(eventId)}`;
  return (
    `${BASE}/organizations/${encodeURIComponent(orgId)}/supporters/activities-v3` +
    `?originIDs=${origin}&pageSize=${pageSize}&pageNumber=${pageNumber}`
  );
}

// OneCause's real replies are { code, status, type, payload: { items: [...],
// nextPageNumber } } — the rows are one level down in payload.items. Be
// tolerant of other layouts too: a bare array, or the first array-valued
// property (directly on the reply, or one level down).
export function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    // First array directly on the response...
    for (const value of Object.values(json)) {
      if (Array.isArray(value)) return value;
    }
    // ...otherwise the first array one level down, e.g. { data: { items: [...] } }
    for (const value of Object.values(json)) {
      if (value && typeof value === "object") {
        for (const inner of Object.values(value)) {
          if (Array.isArray(inner)) return inner;
        }
      }
    }
  }
  return [];
}

// OneCause's real replies look like
//   { code, status, type, payload: { items: [...], nextPageNumber: 2 | null } }
// (their docs call it next_page_number). Look in every place it might be.
export function nextPageNumber(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const payload = json.payload && typeof json.payload === "object" ? json.payload : {};
  const n =
    json.next_page_number ?? json.nextPageNumber ??
    payload.next_page_number ?? payload.nextPageNumber ?? null;
  return n === null || n === undefined || n === "" ? null : Number(n);
}

// Fetches every page from a paged OneCause endpoint. `buildUrl(pageNumber)`
// returns the URL for a page. Throws OneCauseError on any non-2xx response.
async function fetchAllPages(buildUrl, apiKey, fetchImpl = fetch) {
  const rows = [];
  let pageNumber = 1;
  let pages = 0;

  while (pageNumber && pages < MAX_PAGES) {
    const url = buildUrl(pageNumber);
    const res = await fetchImpl(url, { headers: authHeaders(apiKey) });
    const text = await res.text();
    if (!res.ok) throw new OneCauseError(res.status, text.slice(0, 500), url);

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new OneCauseError(res.status, `Response was not JSON: ${text.slice(0, 200)}`, url);
    }

    const pageRows = extractRows(json);
    rows.push(...pageRows);
    pages += 1;

    const next = nextPageNumber(json);
    // Stop if the API says there's no next page, or (defensively) if it keeps
    // pointing at a page we've already read.
    pageNumber = next && next > pageNumber ? next : null;
  }

  return { rows, pages };
}

// Every paid/refunded activity for the event.
export function fetchAllActivities({ orgId, eventId, apiKey }, fetchImpl = fetch) {
  return fetchAllPages((p) => activitiesUrl(orgId, eventId, p), apiKey, fetchImpl);
}

export function num(value) {
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function isRaffle(row) {
  return String(row.purchased_item_type || "").trim().toLowerCase() === "raffle";
}

// Only count money that has actually been collected and not given back.
export function isCollected(row) {
  const status = String(row.payment_status || "").trim().toLowerCase();
  return status === "successful" && !row.refund_id;
}

// What this line contributed to the pot: the full amount paid, minus anything
// a supporter added on top (sales tax, "cover the fees" donation, ticket fee).
// Using the total-paid field avoids guessing whether the price field is
// per-ticket or per-line.
export function lineRevenue(row) {
  const total = num(row.activity_total_amount_in_dollars);
  const extras =
    num(row.activity_sales_tax_in_dollars) +
    num(row.activity_covered_cost_in_dollars) +
    num(row.activity_ticket_fee_paid_by_supporter_in_dollars);
  const net = total - extras;
  if (total > 0) return Math.max(net, 0);
  // Fall back to price x quantity if the total field is missing.
  return num(row.activity_price_in_dollars) * Math.max(num(row.quantity), 1);
}

// Ticket packages sold on the raffle page: dollars -> tickets.
const PACKAGE_TICKETS = { 5: 1, 10: 3, 25: 10 };

// Best-effort ticket count. Packages can be recorded as quantity-of-packages or
// quantity-of-tickets, so look at the per-unit dollar amount to decide.
export function estimateTickets(revenue, quantity) {
  const qty = Math.max(Math.round(num(quantity)), 1);
  const unit = Math.round((revenue / qty) * 100) / 100;
  if (PACKAGE_TICKETS[unit]) return PACKAGE_TICKETS[unit] * qty; // qty = packages
  return qty; // otherwise assume qty already counts individual tickets
}

export function summarize(rows, { winnerSharePct = 50 } = {}) {
  const raffleRows = rows.filter(isRaffle);
  const collected = raffleRows.filter(isCollected);

  let totalRevenue = 0;
  let ticketCount = 0;
  for (const row of collected) {
    const revenue = lineRevenue(row);
    totalRevenue += revenue;
    ticketCount += estimateTickets(revenue, row.quantity);
  }
  totalRevenue = Math.round(totalRevenue * 100) / 100;

  const winnerPot = Math.round(((totalRevenue * winnerSharePct) / 100) * 100) / 100;
  const programShare = Math.round((totalRevenue - winnerPot) * 100) / 100;

  return {
    totalRevenue,
    ticketCount,
    winnerPot,
    programShare,
    winnerSharePct,
    purchaseCount: collected.length,
    raffleLinesSeen: raffleRows.length,
    refundedOrUnpaidLines: raffleRows.length - collected.length,
  };
}
