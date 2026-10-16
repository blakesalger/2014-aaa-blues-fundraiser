// Keeps the 50/50 Total Pot in sync with OneCause. /api/pot-total returns the
// total (cached by the function in netlify/functions). Used on the raffle page
// and the Alumni Auction promo. If the data isn't available (not configured, or
// previewing locally) any fallback text is left alone and elements marked
// data-pot-reveal stay hidden.
(function () {
  var amountEls = document.querySelectorAll(".raffle-pot-amount");
  var asofEls = document.querySelectorAll(".raffle-pot-asof");
  var revealEls = document.querySelectorAll("[data-pot-reveal]");
  if (!amountEls.length || !window.fetch) return;

  function money(n) {
    var whole = Math.abs(n - Math.round(n)) < 0.005;
    return "$" + n.toLocaleString("en-US", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2
    });
  }

  function asOf(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }) + " CT";
  }

  function setAll(els, text) {
    for (var i = 0; i < els.length; i++) els[i].textContent = text;
  }

  function refresh() {
    fetch("/api/pot-total", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.lastUpdated || typeof data.totalRevenue !== "number") return;
        var label = asOf(data.lastUpdated);
        if (!label) return;
        setAll(amountEls, money(data.totalRevenue));
        setAll(asofEls, "as of " + label);
        for (var i = 0; i < revealEls.length; i++) revealEls[i].hidden = false;
      })
      .catch(function () { /* keep whatever is already showing */ });
  }

  refresh();
  setInterval(refresh, 60000);
})();
