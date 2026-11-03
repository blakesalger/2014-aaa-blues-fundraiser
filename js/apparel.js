// Team parent apparel order form (team-parents.html).
// Builds the order rows, keeps a running total, and writes a readable
// "Order Summary" + "Order Total" into hidden fields so the Netlify email is
// easy to read. Prices live in ITEMS below - change them here.
(function () {
  var form = document.getElementById("apparel-form");
  var rowsEl = document.getElementById("apparel-rows");
  var addBtn = document.getElementById("apparel-add-btn");
  if (!form || !rowsEl || !addBtn) return;

  var ADULT_SIZES = ["Small", "Medium", "Large", "XL", "2XL"];
  var YOUTH_SIZES = ["Small", "Medium", "Large", "XL"];

  var ITEMS = [
    { name: "Cream Crew Neck Sweatshirt – Adult", price: 38, sizes: ADULT_SIZES },
    { name: "Cream Crew Neck Sweatshirt – Youth", price: 34, sizes: YOUTH_SIZES },
    { name: "Cream Hoodie – Adult",               price: 48, sizes: ADULT_SIZES },
    { name: "Cream Hoodie – Youth",               price: 44, sizes: YOUTH_SIZES },
    { name: "Custom Name & Number Hoodie – Adult", price: 85, sizes: ADULT_SIZES, custom: true },
    { name: "Custom Name & Number Hoodie – Youth", price: 85, sizes: YOUTH_SIZES, custom: true },
    { name: "Navy Blue Hoodie – Adult",           price: 48, sizes: ADULT_SIZES },
    { name: "Navy Blue Hoodie – Youth",           price: 44, sizes: YOUTH_SIZES },
    { name: "Blue Beanie (Navy)",                      price: 22, sizes: null, number: true },
    { name: "White Beanie (Cream)",                    price: 31, sizes: null, number: true }
  ];

  var summaryField = document.getElementById("apparel-summary");
  var totalField = document.getElementById("apparel-total");
  var totalEl = document.getElementById("apparel-total-display");
  var venmoLink = document.getElementById("apparel-venmo-link");
  var emptyMsg = document.getElementById("apparel-empty");

  function money(n) { return "$" + n.toFixed(2).replace(/\.00$/, ""); }

  function findItem(name) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].name === name) return ITEMS[i];
    return null;
  }

  function field(row, f) { return row.querySelector('[data-f="' + f + '"]'); }

  var rowCounter = 0;

  function addRow(presetName) {
    rowCounter += 1;
    var row = document.createElement("div");
    row.className = "attendee-row apparel-row";

    var itemOpts = '<option value="">Select an item&hellip;</option>';
    ITEMS.forEach(function (it) {
      itemOpts += '<option value="' + it.name + '">' + it.name + " (" + money(it.price) + ")</option>";
    });

    row.innerHTML =
      '<div class="attendee-row-header">' +
        '<p class="attendee-row-label">Item</p>' +
        '<button type="button" class="attendee-remove-btn" data-remove-row>&times; Remove</button>' +
      '</div>' +
      '<div class="form-grid">' +
        '<div class="form-field full-width"><label>Item *</label>' +
          '<select data-f="item" required>' + itemOpts + '</select></div>' +
        '<div class="form-field" data-wrap="size" hidden><label>Size *</label>' +
          '<select data-f="size"></select></div>' +
        '<div class="form-field"><label>Quantity *</label>' +
          '<input type="number" data-f="qty" min="1" max="10" value="1" required></div>' +
      '</div>' +
      '<div class="apparel-number" data-wrap="number" hidden>' +
        '<div class="form-field"><label>Player number to embroider *</label>' +
          '<input type="text" data-f="number" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" placeholder="e.g. 17">' +
          '<label class="apparel-check"><input type="checkbox" data-f="nonumber"> No number, please</label>' +
          '<span class="hint">Each beanie row gets one number. Need different numbers? Add a separate item for each.</span>' +
        '</div>' +
      '</div>' +
      '<div class="apparel-number" data-wrap="custom" hidden>' +
        '<div class="form-grid">' +
          '<div class="form-field"><label>Last name for the back *</label>' +
            '<input type="text" data-f="cname" maxlength="20" placeholder="e.g. Smith"></div>' +
          '<div class="form-field"><label>Player number *</label>' +
            '<input type="text" data-f="cnumber" inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" placeholder="e.g. 17"></div>' +
        '</div>' +
        '<span class="hint">Printed on the back like the sample (NAME / 99). Each hoodie gets one name and number. Need different ones? Add a separate item for each.</span>' +
      '</div>' +
      '<p class="apparel-line" data-f="line"></p>' +
      '<input type="hidden" data-n="Product"><input type="hidden" data-n="Size">' +
      '<input type="hidden" data-n="Quantity"><input type="hidden" data-n="Player Number">' +
      '<input type="hidden" data-n="Last Name">' +
      '<input type="hidden" data-n="Line Total">';

    rowsEl.appendChild(row);
    if (presetName) field(row, "item").value = presetName;
    renumber();
    return row;
  }

  // Update size list / number box / line total for one row
  function refreshRow(row) {
    var item = findItem(field(row, "item").value);
    var sizeWrap = row.querySelector('[data-wrap="size"]');
    var numWrap = row.querySelector('[data-wrap="number"]');
    var sizeSel = field(row, "size");
    var numInput = field(row, "number");
    var noNum = field(row, "nonumber");
    var customWrap = row.querySelector('[data-wrap="custom"]');
    var cName = field(row, "cname");
    var cNumber = field(row, "cnumber");

    if (item && item.sizes) {
      if (sizeSel.getAttribute("data-for") !== item.name) {
        var previous = sizeSel.value;
        var html = '<option value="">Select a size&hellip;</option>';
        item.sizes.forEach(function (s) { html += "<option>" + s + "</option>"; });
        sizeSel.innerHTML = html;
        sizeSel.setAttribute("data-for", item.name);
        if (item.sizes.indexOf(previous) > -1) sizeSel.value = previous;
      }
      sizeWrap.hidden = false;
      sizeSel.required = true;
    } else {
      sizeWrap.hidden = true;
      sizeSel.required = false;
      sizeSel.innerHTML = "";
      sizeSel.removeAttribute("data-for");
    }

    var isBeanie = !!(item && item.number);
    numWrap.hidden = !isBeanie;
    if (isBeanie) {
      if (noNum.checked) numInput.value = "";
      numInput.readOnly = noNum.checked;
      numInput.required = !noNum.checked;
    } else {
      numInput.required = false;
      numInput.value = "";
      noNum.checked = false;
    }

    var isCustom = !!(item && item.custom);
    customWrap.hidden = !isCustom;
    cName.required = isCustom;
    cNumber.required = isCustom;
    if (!isCustom) { cName.value = ""; cNumber.value = ""; }

    var qty = Math.max(parseInt(field(row, "qty").value, 10) || 0, 0);
    var line = item ? item.price * qty : 0;
    field(row, "line").textContent = item ? (qty + " × " + money(item.price) + " = " + money(line)) : "";

    var vals = {
      "Product": item ? item.name : "",
      "Size": item && item.sizes ? sizeSel.value : "",
      "Quantity": String(qty),
      "Player Number": isBeanie ? (noNum.checked ? "No number" : numInput.value) : (isCustom ? cNumber.value : ""),
      "Last Name": isCustom ? cName.value.trim() : "",
      "Line Total": item ? money(line) : ""
    };
    Object.keys(vals).forEach(function (key) {
      row.querySelector('[data-n="' + key + '"]').value = vals[key];
    });
    return { item: item, qty: qty, line: line, vals: vals };
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

  function recalc() {
    var total = 0;
    var lines = [];
    rowsEl.querySelectorAll(".apparel-row").forEach(function (row, i) {
      var r = refreshRow(row);
      if (!r.item) return;
      total += r.line;
      var text = (i + 1) + ". " + r.item.name;
      if (r.vals["Size"]) text += ", " + r.vals["Size"];
      text += " x" + r.qty + " = " + money(r.line);
      if (r.vals["Last Name"]) text += " (last name: " + r.vals["Last Name"] + ", number: " + r.vals["Player Number"] + ")";
      else if (r.vals["Player Number"]) text += " (number: " + r.vals["Player Number"] + ")";
      lines.push(text);
    });
    summaryField.value = lines.join("\n");
    totalField.value = money(total);
    totalEl.textContent = money(total);
    if (venmoLink) {
      venmoLink.href = "https://venmo.com/u/aaablues2014?txn=pay&amount=" + total.toFixed(2) +
        "&note=" + encodeURIComponent("Parent Apparel");
      venmoLink.textContent = total > 0
        ? "Pay " + money(total) + " via Venmo (@AAABLUES2014)"
        : "Pay via Venmo (@AAABLUES2014)";
    }
  }

  rowsEl.addEventListener("input", recalc);
  rowsEl.addEventListener("change", recalc);
  rowsEl.addEventListener("click", function (e) {
    if (e.target.matches("[data-remove-row]")) {
      var row = e.target.closest(".apparel-row");
      if (row) { row.remove(); renumber(); }
    }
  });

  addBtn.addEventListener("click", function () { addRow(); });

  // "Order this" buttons on the product cards
  document.querySelectorAll("[data-apparel-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-apparel-add");
      var target = null;
      rowsEl.querySelectorAll(".apparel-row").forEach(function (row) {
        if (!target && !field(row, "item").value) target = row;
      });
      if (target) { field(target, "item").value = name; recalc(); }
      else target = addRow(name);
      var top = document.getElementById("apparel-order");
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
    try { sessionStorage.setItem("apparelTotal", totalField.value.replace("$", "")); } catch (err) {}
  });

  addRow();
})();

// Product photo galleries: clicking a thumbnail swaps the main photo on that card.
(function () {
  document.querySelectorAll(".apparel-thumb").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var gallery = btn.closest(".apparel-gallery");
      var main = gallery && gallery.querySelector("[data-apparel-main]");
      if (!main) return;
      main.src = btn.getAttribute("data-src");
      main.alt = btn.getAttribute("data-alt") || "";
      gallery.querySelectorAll(".apparel-thumb").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
    });
  });
})();
