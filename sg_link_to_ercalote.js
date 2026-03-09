// ==UserScript==
// @name         SteamGifts Link to Ercalote
// @namespace    https://github.com/palharesf/
// @version      1.0
// @description  Adds "Won By" and "Gifted To" buttons to user pages on Steamgifts
// @match        https://www.steamgifts.com/user/*
// @grant        none
// @author       palharesf
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const match = location.pathname.match(/\/user\/([^\/]+)/);
  if (!match) return;

  const username = match[1];

  const sidebar = document.querySelector(".sidebar__navigation");
  if (!sidebar) return;

  function createItem(name, url) {
    const li = document.createElement("li");
    li.className = "sidebar__navigation__item";
    li.style.display = "flex";
    li.style.alignItems = "center";

    const a = document.createElement("a");
    a.className = "sidebar__navigation__item__link";
    a.style.flex = "1";
    a.href = url;

    const nameDiv = document.createElement("div");
    nameDiv.className = "sidebar__navigation__item__name";
    nameDiv.textContent = name;

    const underline = document.createElement("div");
    underline.className = "sidebar__navigation__item__underline";

    const count = document.createElement("div");
    count.className = "sidebar__navigation__item__count";
    count.textContent = "";

    a.appendChild(nameDiv);
    a.appendChild(underline);
    a.appendChild(count);

    li.appendChild(a);

    return li;
  }

  const wonItem = createItem(
    "Won By",
    `https://ercalote.azurewebsites.net/?username=${username}&type=won&sortBy=number`,
  );

  const sentItem = createItem(
    "Gifted To",
    `https://ercalote.azurewebsites.net/?username=${username}&type=sent&sortBy=number`,
  );

  sidebar.appendChild(wonItem);
  sidebar.appendChild(sentItem);
})();
