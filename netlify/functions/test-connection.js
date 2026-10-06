// Connection tester. Just open  /api/test-connection  in a browser: it tests
// the values saved in Netlify's environment variables (the same ones the live
// poller uses, so a pass here means the poller will work too). You can also
// POST {orgId, eventId, apiKey} to try different values.
//
// Everything runs server-side. The response never includes supporter names,
// emails, phones or addresses. Once the raffle pot is confirmed working you
// can delete this file — it isn't needed day to day.

import {
  fetchAllActivities,
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
      pagesFetched: pages,
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
          ? "Connected, but no 'Raffle' purchases were found on this event yet. That's expected before sales start — or double-check the Event ID if you expected sales."
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
