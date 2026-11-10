// 3v3 tournament apparel pre-order form (3v3-tournament.html).
// Builds the order rows, keeps a running total, and writes a readable
// "Order Summary" + "Order Total" into hidden fields so the Netlify email is
// easy to read. Prices and sizes live in ITEMS below - change them here.
// A price of null shows as "TBD" and leaves the amount off the Venmo link.
(function () {
  var form = document.getElementById("tapparel-form");
  var rowsEl = document.getElementById("tapparel-rows");
  var addBtn = document.getElementById("tapparel-add-btn");
  if (!form || !rowsEl || !addBtn) return;

  var YOUTH_SIZES = ["Small", "Medium", "Large", "XL"];

  var ITEMS = [
    { name: "Youth Hooded Sweatshirt", price: null, sizes: YOUTH_SIZES },
    { name: "Youth T-Shirt",           price: null, sizes: YOUTH_SIZES }
  ];

  var summaryField = document.getElementById("tapparel-summary");
  var totalField = document.getElementById("tapparel-total");
  var totalEl = document.getElementById("tapparel-total-display");
  var venmoLink = document.getElementById("tapparel-venmo-link");
  var emptyMsg = document.getElementById("tapparel-empty");
  var lastNameEl = document.getElementById("tapparel-last-name");

  function money(n) { return "$" + n.toFixed(2).replace(/\.00$/, ""); }
  function priceText(it) { return it.price === null ? "price TBD" : money(it.price); }

  function findItem(name) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].name === name) return ITEMS[i];
    return null;
  }

  function field(row, f) { return row.querySelector('[data-f="' + f + '"]'); }

  function addRow(presetName) {
    var row = document.createElement("div");
    row.className = "attendee-row apparel-row";

    var itemOpts = '<option value="">Select an item&hellip;</option>';
    ITEMS.forEach(function (it) {
      itemOpts += '<option value="' + it.name + '">' + it.name + " (" + priceText(it) + ")</option>";
    });

    row.innerHTML =
      '<div class="attendee-row-header">' +
        '<p class="attendee-row-label">Item</p>' +
        '<button type="button" class="attendee-remove-btn" data-remove-row>&times; Remove</button>' +
      '</div>' +
      '<div class="form-grid">' +
        '<div class="form-field full-width"><label>Item *</label>' +
          '<select data-f="item" required>' + itemOpts + '</select></div>' +
        '<div class="form-field"><label>Size *</label>' +
          '<select data-f="size" required><option value="">Select a size&hellip;</option></select></div>' +
        '<div class="form-field"><label>Quantity *</label>' +
          '<input type="number" data-f="qty" min="1" max="10" value="1" required></div>' +
        '<div class="form-field full-width"><label>Name to print on the back *</label>' +
          '<input type="text" data-f="backname" maxlength="20" placeholder="e.g. Smith" required>' +
          '<span class="hint">Each item gets one name. Ordering for more than one child? Add a separate item for each.</span></div>' +
      '</div>' +
      '<p class="apparel-line" data-f="line"></p>' +
      '<input type="hidden" data-n="Product"><input type="hidden" data-n="Size">' +
      '<input type="hidden" data-n="Quantity"><input type="hidden" data-n="Name on Back">' +
      '<input type="hidden" data-n="Line Total">';

    rowsEl.appendChild(row);
    if (presetName) field(row, "item").value = presetName;
    renumber();
    return row;
  }

  // Update the size list and line total for one row
  function refreshRow(row) {
    var item = findItem(field(row, "item").value);
    var sizeSel = field(row, "size");

    if (item) {
      if (sizeSel.getAttribute("data-for") !== item.name) {
        var previous = sizeSel.value;
        var html = '<option value="">Select a size&hellip;</option>';
        item.sizes.forEach(function (s) { html += "<option>" + s + "</option>"; });
        sizeSel.innerHTML = html;
        sizeSel.setAttribute("data-for", item.name);
        if (item.sizes.indexOf(previous) > -1) sizeSel.value = previous;
      }
    } else {
      sizeSel.innerHTML = '<option value="">Select a size&hellip;</option>';
      sizeSel.removeAttribute("data-for");
    }

    var qty = Math.max(parseInt(field(row, "qty").value, 10) || 0, 0);
    var priced = !!(item && item.price !== null);
    var line = priced ? item.price * qty : 0;
    var lineText = !item ? "" : (priced ? money(line) : "TBD");
    field(row, "line").textContent = !item ? "" :
      (priced ? qty + " × " + money(item.price) + " = " + money(line) : qty + " × price TBD");

    var vals = {
      "Product": item ? item.name : "",
      "Size": item ? sizeSel.value : "",
      "Quantity": String(qty),
      "Name on Back": field(row, "backname").value.trim(),
      "Line Total": lineText
    };
    Object.keys(vals).forEach(function (key) {
      row.querySelector('[data-n="' + key + '"]').value = vals[key];
    });
    return { item: item, qty: qty, line: line, priced: priced, vals: vals };
  }

  function renumber() {
    var rows = rowsEl.querySelectorAll(".apparel-row");
    rows.forEach(function (row, i) {
      var n = i + 1;
      row.querySelector(".attendee-row-label").textContent = "Item " + n;
      row.querySelectorAll("[data-n]").forEach(function (inp) {
        inp.setAttribute("name", "Item " + n + " " + inp.getAttribute("data-n"));
      });
    });
    emptyMsg.hidden = rows.length > 0;
    recalc();
  }

  function venmoNote() {
    var last = lastNameEl ? lastNameEl.value.trim() : "";
    return last ? "3v3 Apparel - " + last : "3v3 Apparel";
  }

  function recalc() {
    var total = 0;
    var anyTbd = false;
    var lines = [];
    rowsEl.querySelectorAll(".apparel-row").forEach(function (row, i) {
      var r = refreshRow(row);
      if (!r.item) return;
      if (r.priced) total += r.line; else anyTbd = true;
      var text = (i + 1) + ". " + r.item.name + ", " + (r.vals["Size"] || "no size") +
        " x" + r.qty + " = " + r.vals["Line Total"] +
        " (name on back: " + (r.vals["Name on Back"] || "none entered") + ")";
      lines.push(text);
    });
    summaryField.value = lines.join("\n");
    var totalText = anyTbd ? "TBD" : money(total);
    totalField.value = totalText;
    totalEl.textContent = totalText;
    if (venmoLink) {
      var href = "https://venmo.com/u/aaablues2014?txn=pay";
      if (!anyTbd && total > 0) href += "&amount=" + total.toFixed(2);
      href += "&note=" + encodeURIComponent(venmoNote());
      venmoLink.href = href;
      venmoLink.textContent = (!anyTbd && total > 0)
        ? "Pay " + money(total) + " via Venmo (@AAABLUES2014)"
        : "Pay via Venmo (@AAABLUES2014)";
    }
  }

  rowsEl.addEventListener("input", recalc);
  rowsEl.addEventListener("change", recalc);
  if (lastNameEl) lastNameEl.addEventListener("input", recalc);
  rowsEl.addEventListener("click", function (e) {
    if (e.target.matches("[data-remove-row]")) {
      var row = e.target.closest(".apparel-row");
      if (row) { row.remove(); renumber(); }
    }
  });

  addBtn.addEventListener("click", function () { addRow(); });

  // "Pre-order this" buttons on the product cards
  document.querySelectorAll("[data-tapparel-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-tapparel-add");
      var target = null;
      rowsEl.querySelectorAll(".apparel-row").forEach(function (row) {
        if (!target && !field(row, "item").value) target = row;
      });
      if (target) { field(target, "item").value = name; recalc(); }
      else addRow(name);
      var top = document.getElementById("tapparel-order");
      if (top && top.scrollIntoView) top.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  form.addEventListener("submit", function (e) {
    recalc();
    var count = 0;
    rowsEl.querySelectorAll(".apparel-row").forEach(function (row) {
      if (findItem(field(row, "item").value)) count += 1;
    });
    if (!count) {
      e.preventDefault();
      emptyMsg.hidden = false;
      return;
    }
    try {
      sessionStorage.setItem("tapparelTotal", totalField.value.replace("$", ""));
      sessionStorage.setItem("tapparelLastName", lastNameEl ? lastNameEl.value.trim() : "");
    } catch (err) {}
  });

  addRow();
})();
