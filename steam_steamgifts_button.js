// ==UserScript==
// @name         Steam to Steamgifts Button
// @namespace    https://github.com/palharesf/
// @version      1.0
// @description  Adds a Steamgifts button besides the Community Hub button
// @match        https://store.steampowered.com/*
// @match        https://steamcommunity.com/*
// @run-at       document-end
// @grant        none
// @author       palharesf
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  function addButton() {
    if (document.getElementById("vm-steamgifts-btn")) {
      return;
    }

    const appId = location.pathname.match(/\/app\/(\d+)/)?.[1];
    if (!appId) {
      return;
    }

    const communityHub = [...document.querySelectorAll("a")].find(
      (a) => a.textContent.trim() === "Community Hub",
    );

    if (!communityHub) {
      return;
    }

    const btn = document.createElement("a");
    btn.id = "vm-steamgifts-btn";
    btn.href = `https://www.steamgifts.com/app/${appId}`;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";

    btn.className = communityHub.className;
    btn.innerHTML = "<span>SteamGifts</span>";

    btn.style.marginLeft = "8px";

    communityHub.insertAdjacentElement("afterend", btn);
  }

  addButton();

  new MutationObserver(addButton).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
