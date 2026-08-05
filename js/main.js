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
