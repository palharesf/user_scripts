// ==UserScript==
// @name         Steam Search - Mass Ignore Games
// @namespace    https://github.com/palharesf/
// @version      1.0
// @description  Uses smart visibility checks to prevent the button from being injected into hidden Steam layout containers
// @match        https://store.steampowered.com/search/*
// @run-at       document-end
// @grant        none
// @author       palharesf
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  function injectButton() {
    let btnContainer = document.getElementById("mass-ignore-btn-ctn");

    // If the button exists in the DOM but is completely hidden (e.g. Steam hid its parent container), remove it to force a respawn
    if (btnContainer && btnContainer.offsetWidth === 0) {
      btnContainer.remove();
      btnContainer = null;
    }

    // If it's already rendered and visible, do nothing
    if (btnContainer) return;

    btnContainer = document.createElement("div");
    btnContainer.id = "mass-ignore-btn-ctn";
    btnContainer.style.display = "inline-block";
    btnContainer.style.margin = "5px 10px";

    btnContainer.innerHTML = `
            <button id="btn_mass_ignore" class="btnv6_blue_hoverfade btn_small" type="button" style="padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer; background: #a33333; color: #fff; font-weight: bold; font-size: 11px;">
                <span>🚫 Ignore Visible Games</span>
            </button>
        `;

    // Ordered list of potential anchor points.
    // termcontainer is the specific box holding your "Developer: Tero Lunkka" chip.
    const targets = [
      { el: document.querySelector(".termcontainer"), method: "append" },
      {
        el: document.querySelector(".search_breadcrumb_container"),
        method: "append",
      },
      {
        el: document.querySelector(".search_results_filtered_warning"),
        method: "append",
      },
      { el: document.querySelector(".search_results_count"), method: "append" },
      { el: document.getElementById("search_resultsRows"), method: "before" },
    ];

    // Loop through targets and attach to the first one that is actually visible on screen
    for (const target of targets) {
      if (target.el && target.el.offsetWidth > 0) {
        if (target.method === "append") {
          target.el.appendChild(btnContainer);
        } else if (target.method === "before") {
          target.el.parentNode.insertBefore(btnContainer, target.el);
        }

        const btn = document.getElementById("btn_mass_ignore");
        if (btn) btn.addEventListener("click", startMassIgnore);
        break;
      }
    }
  }

  async function startMassIgnore(e) {
    e.preventDefault();
    e.stopPropagation();

    const button = document.getElementById("btn_mass_ignore");
    const allRows = document.querySelectorAll(
      "#search_resultsRows a[data-ds-appid]",
    );

    const globalContext =
      typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const sessionId =
      globalContext.g_sessionID ||
      (document.cookie.match(/sessionid=([^;]+)/) || [])[1];

    if (!sessionId) {
      alert("Session ID missing. Please refresh or log in.");
      return;
    }

    // Filter out games that Steam or Augmented Steam already faded out, hid, or marked red
    const visibleRows = Array.from(allRows).filter((row) => {
      const isHidden =
        window.getComputedStyle(row).display === "none" ||
        row.offsetWidth === 0;
      const isIgnored =
        row.classList.contains("ds_ignored") ||
        row.style.opacity === "0.3" ||
        row.style.backgroundColor === "rgb(163, 51, 51)";
      return !isHidden && !isIgnored;
    });

    if (visibleRows.length === 0) {
      button.innerHTML = "<span>No unignored games showing</span>";
      return;
    }

    button.disabled = true;
    button.style.background = "#555";

    let completed = 0;

    for (const row of visibleRows) {
      const appId = row.getAttribute("data-ds-appid");
      completed++;
      button.innerHTML = `<span>Ignoring: ${completed} / ${visibleRows.length}</span>`;

      // Fire BOTH known Steam internal endpoints simultaneously to guarantee it sticks
      try {
        if (globalContext.$J) {
          globalContext.$J.post("/recommended/ignorerecommendation/", {
            sessionid: sessionId,
            appid: appId,
            remove: 0,
          });
          globalContext.$J.post("/recommended/api/ignore_game/", {
            sessionid: sessionId,
            appid: appId,
            ignore_reason: 0,
          });
        } else {
          const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
          };
          fetch("/recommended/ignorerecommendation/", {
            method: "POST",
            headers,
            body: new URLSearchParams({
              sessionid: sessionId,
              appid: appId,
              remove: "0",
            }),
          });
          fetch("/recommended/api/ignore_game/", {
            method: "POST",
            headers,
            body: new URLSearchParams({
              sessionid: sessionId,
              appid: appId,
              ignore_reason: "0",
            }),
          });
        }
      } catch (err) {
        console.error(`Error sending request for ${appId}`, err);
      }

      if (
        globalContext.GDynamicStore &&
        globalContext.GDynamicStore.m_rgIgnoredApps
      ) {
        globalContext.GDynamicStore.m_rgIgnoredApps[appId] = true;
      }

      // Aggressively dim and disable the row visually to confirm processing
      row.style.opacity = "0.2";
      row.style.pointerEvents = "none";
      row.style.filter = "grayscale(100%)";
      row.classList.add("ds_ignored");

      await delay(150);
    }

    button.innerHTML = "<span>Done!</span>";
    button.style.background = "#2c6332";
  }

  // Interval checks every second. If you load a new page via AJAX and the button breaks, it will automatically heal.
  setInterval(injectButton, 1000);
})();
