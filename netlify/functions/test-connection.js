// Connection tester. Just open  /api/test-connection  in a browser: it tests
// the values saved in Netlify's environment variables (the same ones the live
// poller uses, so a pass here means the poller will work too). You can also
// POST {orgId, eventId, apiKey} to try different values.
//
// Everything runs server-side. The response never includes supporter names,
// emails, phones or addresses. Once the raffle pot is confirmed working you
// can delete this file — it isn't needed day to day.

import {
  authHeaders,
  activitiesUrl,
  eventsUrl,
  describeShape,
  fetchAllActivities,
  fetchAllEvents,
  fetchRecentActivities,
  checkEvent,
  bareId,
  summarize,
  isRaffle,
  isCollected,
  lineRevenue,
  num,
  OneCauseError,
} from "../lib/onecause.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// One raw request, reporting only the STRUCTURE of the reply (and, for the
// events list only, a short text preview — event names/IDs, no personal data).
async function probe(url, apiKey, previewChars = 0) {
  try {
    const res = await fetch(url, { headers: authHeaders(apiKey) });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON
    }
    return {
      status: res.status,
      shape: parsed !== null ? describeShape(parsed) : "reply was not JSON",
      preview: previewChars ? text.slice(0, previewChars) : undefined,
    };
  } catch (e) {
    return { error: String(e) };
  }
}

// Enough of an ID to recognize it, not enough to use it.
const hint = (v) => (v ? `${String(v).length} chars, ends "${String(v).slice(-4)}"` : "(not set)");

function hintFor(status) {
  switch (status) {
    case 401:
      return (
        "OneCause rejected the API key. This tool sends it the way OneCause documents " +
        "(Authorization: api <key>), so the key itself is the problem. Keys stop working if " +
        "they were regenerated, if the person who created them changed their OneCause password " +
        "or was removed, or if the API project was deleted. Generate a fresh key under " +
        "Integrations > New API Project and paste that one."
      );
    case 403:
      return "The key was accepted but isn't allowed to read this organization. Make sure the key was created by an Admin on the same OneCause organization as the Org ID.";
    case 404:
      return "OneCause couldn't find that Organization ID. Re-copy the Org ID shown next to your API key on the Integrations page.";
    case 400:
      return "OneCause didn't like the request — most often the Event ID. It should be the long 36-character ID (letters, numbers and dashes) with no 'vevt:' needed.";
    case 429:
      return "OneCause says too many requests were made. Wait a minute and try again.";
    default:
      return "Unexpected response from OneCause. The details below show exactly what came back.";
  }
}

export default async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Use GET or POST" }, 405);
  }

  let body = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      // empty body is fine — fall back to environment variables
    }
  }

  const orgId = (body.orgId || process.env.ONECAUSE_ORG_ID || "").trim();
  const eventId = (body.eventId || process.env.ONECAUSE_EVENT_ID || "").trim();
  const apiKey = (body.apiKey || process.env.ONECAUSE_API_KEY || "").trim();
  const usedEnv = {
    orgId: !body.orgId && !!process.env.ONECAUSE_ORG_ID,
    eventId: !body.eventId && !!process.env.ONECAUSE_EVENT_ID,
    apiKey: !body.apiKey && !!process.env.ONECAUSE_API_KEY,
  };

  const missing = [];
  if (!orgId) missing.push("Organization ID");
  if (!eventId) missing.push("Event ID");
  if (!apiKey) missing.push("API Key");
  if (missing.length) {
    return json({
      success: false,
      message: `Missing: ${missing.join(", ")}. Fill them in, or save them as Netlify environment variables and leave the fields blank.`,
    });
  }

  try {
    const { rows, pages } = await fetchAllActivities({ orgId, eventId, apiKey });

    // Separate check: is the saved Event ID actually one of this account's
    // events? (Zero sales looks identical whether the ID is right or wrong, so
    // this is what proves it before the raffle starts.) Never fails the test.
    let eventCheck;
    try {
      const { rows: eventRows } = await fetchAllEvents({ orgId, apiKey });
      eventCheck = checkEvent(eventRows, eventId);
      eventCheck.verdict = eventCheck.savedEventIdFound
        ? `GOOD: the saved Event ID is "${eventCheck.match.name}" (${eventCheck.match.status || "status unknown"}). Make sure that's your raffle event.`
        : "PROBLEM: the saved Event ID doesn't match any event in this OneCause account. Pick your raffle event from the 'events' list below and save its ID as ONECAUSE_EVENT_ID.";
    } catch (e) {
      eventCheck = {
        verdict: "Couldn't read the event list, so the Event ID couldn't be double-checked.",
        detail: e instanceof OneCauseError ? `HTTP ${e.status}: ${e.bodyText}` : String(e),
      };
    }

    // Where did recent raffle purchases actually land? Looks at the last few
    // days across the WHOLE account (not just the saved event) so a purchase
    // made on a different event than the saved Event ID is spotted at once.
    // Never fails the test.
    let recentRaffle;
    try {
      const sinceDate = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { rows: recentRows } = await fetchRecentActivities({ orgId, apiKey, sinceDate });
      const raffleAnywhere = recentRows.filter(isRaffle);
      const saved = bareId(eventId).toLowerCase();
      const onSavedEvent = raffleAnywhere.filter((r) => bareId(r.origin_id).toLowerCase() === saved);
      const elsewhere = raffleAnywhere.filter((r) => bareId(r.origin_id).toLowerCase() !== saved);

      let verdict;
      if (raffleAnywhere.length === 0) {
        verdict =
          "No raffle purchases anywhere in your OneCause account in the last 3 days. If you just bought a ticket, give OneCause a few minutes and reload this page.";
      } else if (elsewhere.length === 0) {
        verdict = `GOOD: ${onSavedEvent.length} recent raffle purchase(s) are on the saved event.`;
      } else if (onSavedEvent.length === 0) {
        const where = [...new Set(elsewhere.map((r) => `"${r.origin_name}" (id ${bareId(r.origin_id)})`))].join("; ");
        verdict = `PROBLEM: recent raffle purchases were found, but on a DIFFERENT event than the saved Event ID: ${where}. Save that event's ID as ONECAUSE_EVENT_ID.`;
      } else {
        verdict = `Mixed: ${onSavedEvent.length} raffle purchase(s) on the saved event and ${elsewhere.length} on other events (see list).`;
      }

      recentRaffle = {
        verdict,
        sinceDateUTC: sinceDate,
        activitiesInAccountSince: recentRows.length,
        raffleActivities: raffleAnywhere.slice(0, 20).map((r) => ({
          event_name: r.origin_name,
          event_id: bareId(r.origin_id),
          on_saved_event: bareId(r.origin_id).toLowerCase() === saved,
          item: r.activity_details || r.integration_description || null,
          amount_paid: r.activity_total_amount_in_dollars,
          payment_status: r.payment_status,
          created: r.created,
        })),
      };
    } catch (e) {
      recentRaffle = {
        verdict: "Couldn't check recent account-wide activity.",
        detail: e instanceof OneCauseError ? `HTTP ${e.status}: ${e.bodyText}` : String(e),
      };
    }

    const itemTypeCounts = {};
    for (const row of rows) {
      const type = row.purchased_item_type || "(blank)";
      itemTypeCounts[type] = (itemTypeCounts[type] || 0) + 1;
    }

    const raffleRows = rows.filter(isRaffle);
    const collected = raffleRows.filter(isCollected);
    const sum = (fn) => Math.round(collected.reduce((s, r) => s + fn(r), 0) * 100) / 100;

    // Only operational, non-personal fields are echoed back.
    const sampleRaffleRows = raffleRows.slice(0, 3).map((r) => ({
      purchased_item_type: r.purchased_item_type,
      activity_details: r.activity_details,
      integration_description: r.integration_description,
      quantity: r.quantity,
      activity_price_in_dollars: r.activity_price_in_dollars,
      activity_total_amount_in_dollars: r.activity_total_amount_in_dollars,
      activity_sales_tax_in_dollars: r.activity_sales_tax_in_dollars,
      activity_covered_cost_in_dollars: r.activity_covered_cost_in_dollars,
      activity_ticket_fee_paid_by_supporter_in_dollars: r.activity_ticket_fee_paid_by_supporter_in_dollars,
      payment_status: r.payment_status,
      payment_type: r.payment_type,
      origin_name: r.origin_name,
      created: r.created,
    }));

    const summary = summarize(rows, {
      winnerSharePct: parseFloat(process.env.RAFFLE_WINNER_SHARE_PCT || "50"),
    });

    return json({
      success: true,
      authUsed: "Authorization: api <key>",
      credentialsFromNetlifyEnv: usedEnv,
      whatYouSaved: { orgId: hint(orgId), eventId: hint(eventId) },
      // What OneCause's replies actually look like (structure only).
      responseShapes: {
        events: await probe(eventsUrl(orgId, 1, 5), apiKey, 600),
        activitiesOnSavedEvent: await probe(activitiesUrl(orgId, eventId, 1, 5), apiKey),
      },
      pagesFetched: pages,
      eventCheck,
      recentRaffleAnywhere: recentRaffle,
      activitiesOnThisEvent: rows.length,
      itemTypesSeen: itemTypeCounts,
      raffle: {
        linesSeen: raffleRows.length,
        collected: collected.length,
        refundedOrUnpaid: raffleRows.length - collected.length,
      },
      // The page/display use "totalPotThePageWillShow". The other sums are here
      // so you can compare against OneCause's own raffle report and we can pick
      // the right one if they ever disagree.
      totals: {
        totalPotThePageWillShow: summary.totalRevenue,
        sumOfTotalPaid: sum((r) => num(r.activity_total_amount_in_dollars)),
        sumOfPriceField: sum((r) => num(r.activity_price_in_dollars)),
        sumOfPriceTimesQuantity: sum((r) => num(r.activity_price_in_dollars) * Math.max(num(r.quantity), 1)),
        sumNetOfTaxCoverCostAndFees: sum(lineRevenue),
      },
      estimatedTicketsSold: summary.ticketCount,
      sampleRaffleRows,
      note:
        raffleRows.length === 0
          ? "Connected, but no 'Raffle' purchases were found on this event yet. That's expected before sales start. Check eventCheck.verdict above to confirm the Event ID is the right event."
          : undefined,
    });
  } catch (err) {
    if (err instanceof OneCauseError) {
      return json({
        success: false,
        message: hintFor(err.status),
        status: err.status,
        oneCauseSaid: err.bodyText,
        requestedUrl: err.url,
      });
    }
    return json({ success: false, message: "Couldn't reach OneCause.", detail: String(err) });
  }
};

export const config = {
  path: "/api/test-connection",
};
