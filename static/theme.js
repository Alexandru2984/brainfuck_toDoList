(function () {
  "use strict";
  var root = document.documentElement;
  var key = "bf-theme";
  var system = window.matchMedia("(prefers-color-scheme: dark)");
  function stored() {
    try {
      var value = localStorage.getItem(key);
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  }
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    button.textContent = theme === "dark" ? "☀︎" : "☾";
    var label =
      theme === "dark"
        ? "Comută pe tema deschisă"
        : "Comută pe tema întunecată";
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  function sync() {
    apply(stored() || (system.matches ? "dark" : "light"));
  }
  sync();
  document.addEventListener("DOMContentLoaded", function () {
    sync();
    var button = document.getElementById("theme-toggle");
    if (button)
      button.addEventListener("click", function () {
        var next =
          root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(key, next);
        } catch (error) {
          /* theme still works */
        }
        apply(next);
      });
  });
  system.addEventListener("change", sync);
})();
