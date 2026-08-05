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

  var specsLink = document.getElementById("specs-link");
  var specsModal = document.getElementById("specs-modal");
  var specsClose = document.getElementById("specs-modal-close");

  if (specsLink && specsModal) {
    specsLink.addEventListener("click", function () {
      specsModal.hidden = false;
    });

    function closeSpecsModal() {
      specsModal.hidden = true;
    }

    if (specsClose) {
      specsClose.addEventListener("click", closeSpecsModal);
    }

    specsModal.addEventListener("click", function (e) {
      if (e.target === specsModal) {
        closeSpecsModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !specsModal.hidden) {
        closeSpecsModal();
      }
    });
  }
});
