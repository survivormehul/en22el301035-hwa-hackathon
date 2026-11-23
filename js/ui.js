(function () {
  "use strict";
  document.documentElement.classList.add("has-js");

  function ready(fn) {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn); }
    else { fn(); }
  }

  ready(function () {
    var header = document.querySelector(".site-header");
    var navToggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");

    function closeNav() {
      if (!header || !navToggle) { return; }
      header.classList.remove("nav-open");
      navToggle.setAttribute("aria-expanded", "false");
    }

    if (navToggle && header && nav) {
      navToggle.addEventListener("click", function () {
        var open = !header.classList.contains("nav-open");
        header.classList.toggle("nav-open", open);
        navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) { closeNav(); }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closeNav(); }
      });
      document.addEventListener("click", function (e) {
        if (!header.contains(e.target)) { closeNav(); }
      });
    }

    var onScroll = function () {
      if (!header) { return; }
      header.classList.toggle("is-scrolled", window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!revealItems.length) { return; }
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealItems.forEach(function (el) { observer.observe(el); });
  });
})();