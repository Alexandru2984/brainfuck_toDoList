(function () {
    "use strict";
    var root = document.documentElement;
    var KEY = "bf-theme";

    function stored() {
        try {
            return localStorage.getItem(KEY);
        } catch (e) {
            return null;
        }
    }

    function apply(theme) {
        if (theme === "dark" || theme === "light") {
            root.setAttribute("data-theme", theme);
        } else {
            root.removeAttribute("data-theme");
        }
    }

    // Apply the persisted choice as early as possible to avoid a flash.
    apply(stored());

    function current() {
        var explicit = root.getAttribute("data-theme");
        if (explicit) {
            return explicit;
        }
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function label(btn, theme) {
        var dark = theme === "dark";
        // Show the icon for the theme you would switch TO.
        btn.textContent = dark ? "☀︎" : "☾";
        var text = dark ? "Comuta pe tema deschisa" : "Comuta pe tema intunecata";
        btn.setAttribute("aria-label", text);
        btn.setAttribute("title", text);
    }

    document.addEventListener("DOMContentLoaded", function () {
        var btn = document.getElementById("theme-toggle");
        if (!btn) {
            return;
        }
        label(btn, current());
        btn.addEventListener("click", function () {
            var next = current() === "dark" ? "light" : "dark";
            apply(next);
            try {
                localStorage.setItem(KEY, next);
            } catch (e) {
                /* ignore storage errors */
            }
            label(btn, next);
        });
    });
})();
