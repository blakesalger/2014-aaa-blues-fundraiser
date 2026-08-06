document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      var expanded = links.classList.contains("open");
      toggle.setAttribute("aria-expanded", expanded);
    });
  }

  function openModal(modal) {
    modal.hidden = false;
  }

  function closeModal(modal) {
    modal.hidden = true;
  }

  // Generic behavior for every modal on the page: click outside the box,
  // or its own [data-modal-close] button, closes it.
  document.querySelectorAll(".modal-overlay").forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeModal(modal);
      }
    });

    modal.querySelectorAll("[data-modal-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeModal(modal);
      });
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay").forEach(function (modal) {
        if (!modal.hidden) {
          closeModal(modal);
        }
      });
    }
  });

  var specsLink = document.getElementById("specs-link");
  var specsModal = document.getElementById("specs-modal");
  if (specsLink && specsModal) {
    specsLink.addEventListener("click", function () {
      openModal(specsModal);
    });
  }

  var tierModal = document.getElementById("tier-modal");
  var tierModalName = document.getElementById("tier-modal-name");
  var tierModalImage = document.getElementById("tier-modal-image");
  var tierModalCta = document.getElementById("tier-modal-cta");

  if (tierModal && tierModalName && tierModalImage && tierModalCta) {
    document.querySelectorAll("[data-tier-modal]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-tier-name") || "";
        tierModalName.textContent = name;
        tierModalImage.src = btn.getAttribute("data-tier-image") || "";
        tierModalImage.alt = name + " sponsorship details";
        tierModalCta.href = btn.getAttribute("data-tier-mailto") || "#";
        openModal(tierModal);
      });
    });
  }

  var PARENT_PASSCODE = "Quebec2027";
  var passcodeForm = document.getElementById("passcode-form");
  var passcodeInput = document.getElementById("passcode-input");
  var passcodeError = document.getElementById("passcode-error");
  var passcodeGate = document.getElementById("passcode-gate");
  var parentResources = document.getElementById("parent-resources");

  if (passcodeForm && passcodeInput && passcodeGate && parentResources) {
    if (sessionStorage.getItem("teamParentsUnlocked") === "true") {
      passcodeGate.hidden = true;
      parentResources.hidden = false;
    }

    passcodeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (passcodeInput.value === PARENT_PASSCODE) {
        sessionStorage.setItem("teamParentsUnlocked", "true");
        passcodeGate.hidden = true;
        parentResources.hidden = false;
      } else {
        passcodeError.hidden = false;
        passcodeInput.value = "";
        passcodeInput.focus();
      }
    });
  }

  document.querySelectorAll("[data-copy-target]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy-target"));
      if (!target) {
        return;
      }
      var text = target.textContent;
      var originalLabel = btn.textContent;

      function showCopied() {
        btn.textContent = "Copied!";
        btn.classList.add("copy-btn-copied");
        setTimeout(function () {
          btn.textContent = originalLabel;
          btn.classList.remove("copy-btn-copied");
        }, 2000);
      }

      function fallbackCopy() {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          showCopied();
        } catch (err) {
          btn.textContent = "Press Ctrl+C to copy";
          setTimeout(function () {
            btn.textContent = originalLabel;
          }, 2500);
        }
        document.body.removeChild(textarea);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showCopied).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  });

  var attendeeRows = document.getElementById("attendee-rows");
  var addAttendeeBtn = document.getElementById("add-attendee-btn");

  function renumberAttendeeRows() {
    var rows = attendeeRows.querySelectorAll(".attendee-row");
    rows.forEach(function (row, i) {
      var index = i + 1;
      row.setAttribute("data-attendee-index", index);
      var label = row.querySelector(".attendee-row-label");
      if (label) {
        label.textContent = "Person " + index;
      }
      row.querySelectorAll("input").forEach(function (input) {
        var name = input.getAttribute("name");
        if (name) {
          input.setAttribute("name", name.replace(/Attendee \d+/, "Attendee " + index));
        }
      });
    });
  }

  if (attendeeRows && addAttendeeBtn) {
    addAttendeeBtn.addEventListener("click", function () {
      var nextIndex = attendeeRows.querySelectorAll(".attendee-row").length + 1;
      var row = document.createElement("div");
      row.className = "attendee-row";
      row.setAttribute("data-attendee-index", nextIndex);
      row.innerHTML =
        '<div class="attendee-row-header">' +
          '<p class="attendee-row-label">Person ' + nextIndex + '</p>' +
          '<button type="button" class="attendee-remove-btn" data-remove-attendee>&times; Remove</button>' +
        '</div>' +
        '<div class="form-grid">' +
          '<div class="form-field">' +
            '<label>Name *</label>' +
            '<input type="text" name="Attendee ' + nextIndex + ' Name" required>' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Arrival Date *</label>' +
            '<input type="date" name="Attendee ' + nextIndex + ' Arrival Date" required>' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Departure Date *</label>' +
            '<input type="date" name="Attendee ' + nextIndex + ' Departure Date" required>' +
          '</div>' +
        '</div>';
      attendeeRows.appendChild(row);
    });

    attendeeRows.addEventListener("click", function (e) {
      if (e.target.matches("[data-remove-attendee]")) {
        var row = e.target.closest(".attendee-row");
        if (row) {
          row.remove();
          renumberAttendeeRows();
        }
      }
    });
  }

  var extendedFamilySelect = document.getElementById("extended-family");
  var fairmontWrap = document.getElementById("fairmont-question-wrap");

  if (extendedFamilySelect && fairmontWrap) {
    extendedFamilySelect.addEventListener("change", function () {
      fairmontWrap.hidden = extendedFamilySelect.value !== "Yes";
    });
  }

  var alumniModal = document.getElementById("alumni-modal");
  var alumniModalName = document.getElementById("alumni-modal-name");
  var alumniModalBio = document.getElementById("alumni-modal-bio");
  var alumniModalAvatar = document.getElementById("alumni-modal-avatar");

  if (alumniModal && alumniModalName && alumniModalBio && alumniModalAvatar) {
    document.querySelectorAll(".alumni-card").forEach(function (card) {
      card.addEventListener("click", function () {
        var bioEl = card.querySelector(".alumni-bio-text");
        var name = card.childNodes[0].textContent.trim();
        var bio = bioEl ? bioEl.textContent.trim() : "";
        var initials = name
          .split(" ")
          .map(function (part) {
            return part.charAt(0);
          })
          .join("")
          .slice(0, 2)
          .toUpperCase();

        alumniModalName.textContent = name;
        alumniModalBio.textContent = bio;
        alumniModalAvatar.textContent = initials;
        openModal(alumniModal);
      });
    });
  }
});
