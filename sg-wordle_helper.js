// ==UserScript==
// @name        Helper for SG-Wordle
// @namespace   https://github.com/palharesf/
// @version     3.0
// @description  Adds a Solver panel to the SG Wordle page (previously accessible via Alt-Tabbing)
// @match       *://sg-wordle.netlify.app/*
// @run-at      document-idle
// @grant       none
// @author       palharesf
// @license      MIT
// ==/UserScript==

console.log("[SG-Solver] Starting v3.0");

(async function () {

  const WORD_LENGTH = 5;
  const WORD_LIST_URL = "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";
  let WORDS = [];

  /* -------------------------
     WORD LIST
  ------------------------- */

  async function loadWords() {
    const txt = await fetch(WORD_LIST_URL).then(r => r.text());
    WORDS = txt.split("\n").map(w => w.trim().toLowerCase()).filter(w => w.length === WORD_LENGTH);
    console.log("[SG-Solver] Words loaded:", WORDS.length);
  }

  /* -------------------------
     UI
  ------------------------- */

  function initUI() {
    const panel = document.createElement("div");
    panel.id = "sg-solver";
    panel.style.cssText = `
      position: fixed;
      right: 20px;
      top: 80px;
      background: #1a1a1a;
      color: #e5e5e5;
      padding: 14px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      z-index: 999999;
      width: 210px;
      max-height: 420px;
      overflow: auto;
      border: 1px solid #333;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:8px;color:#6ee7b7;letter-spacing:1px;">SOLVER</div>
      <div id="solverDebug" style="font-size:10px;color:#666;margin-bottom:6px;"></div>
      <div id="solverList" style="line-height:1.6;"></div>
    `;
    document.body.appendChild(panel);
    console.log("[SG-Solver] UI injected");
  }

  function render(words, debug = "") {
    const el = document.getElementById("solverList");
    const dbg = document.getElementById("solverDebug");
    if (!el) return;
    if (dbg) dbg.textContent = debug;
    el.innerHTML = words
      .map(w => `<div>${w.word} <span style="color:#555">${w.score}</span></div>`)
      .join("");
  }

  /* -------------------------
     REACT FIBER BOARD READER
  ------------------------- */

  /**
   * Walk a React fiber tree and call visitor(fiber) on each node.
   */
  function walkFiber(fiber, visitor, maxDepth = 80, depth = 0) {
    if (!fiber || depth > maxDepth) return;
    visitor(fiber);
    walkFiber(fiber.child, visitor, maxDepth, depth + 1);
    walkFiber(fiber.sibling, visitor, maxDepth, depth + 1);
  }

  /**
   * Get the root React fiber from the #root DOM node.
   */
  function getRootFiber() {
    const root = document.getElementById("root");
    if (!root) return null;
    // React 18 uses _reactFiber, React 17 uses __reactFiber$..., React 16 uses _reactInternalFiber
    const key = Object.keys(root).find(k =>
      k.startsWith("__reactFiber") || k === "_reactFiber" || k === "_reactInternalFiber"
    );
    return key ? root[key] : null;
  }

  /**
   * Attempt to extract board state from React component state/props.
   * Returns { guesses: [{word, result}] } where result is array of "correct"|"present"|"absent".
   */
  function readBoardFromFiber() {
    const rootFiber = getRootFiber();
    if (!rootFiber) {
      console.log("[SG-Solver] No React fiber found");
      return null;
    }

    // Collect all fiber nodes that have memoizedState or memoizedProps
    const candidates = [];
    walkFiber(rootFiber, fiber => {
      if (fiber.memoizedState || (fiber.memoizedProps && typeof fiber.memoizedProps === "object")) {
        candidates.push(fiber);
      }
    });

    // Strategy 1: look for state that contains a "guesses" array or "board" array
    for (const fiber of candidates) {
      let state = fiber.memoizedState;
      while (state) {
        const val = state.memoizedState ?? state.queue?.lastRenderedState;
        if (val && typeof val === "object") {
          // Look for a guesses array like [{word, result}] or string[] of 5-letter words
          const parsed = tryExtractGuesses(val);
          if (parsed) return parsed;
        }
        state = state.next;
      }
    }

    // Strategy 2: look in memoizedProps for board data
    for (const fiber of candidates) {
      const props = fiber.memoizedProps;
      if (props && typeof props === "object") {
        const parsed = tryExtractGuesses(props);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  /**
   * Given an arbitrary object, try to find board state in it.
   * Returns { guesses } or null.
   */
  function tryExtractGuesses(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Look for array of 5-letter strings (raw guess words)
    for (const key of Object.keys(obj)) {
      const val = obj[key];

      // Pattern: array of strings that look like 5-letter words (guesses list)
      if (Array.isArray(val) && val.length > 0 && val.every(v => typeof v === "string" && v.length === WORD_LENGTH)) {
        // These are guess words; we still need colors though
        // Store for later combination
        obj.__guessWords = val;
      }

      // Pattern: 2D array of objects with letter + status
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0];
        if (Array.isArray(first) && first.length === WORD_LENGTH) {
          // Could be a 2D board: val[row][col]
          const guesses = extractFrom2DBoard(val);
          if (guesses && guesses.length > 0) return { guesses };
        }
        // 1D array of row objects
        if (typeof first === "object" && first !== null && !Array.isArray(first)) {
          const guesses = extractFromRowObjects(val);
          if (guesses && guesses.length > 0) return { guesses };
        }
      }
    }

    return null;
  }

  /**
   * Extract from a 2D board where each cell is { letter, status } or similar.
   */
  function extractFrom2DBoard(board) {
    const guesses = [];
    for (const row of board) {
      if (!Array.isArray(row) || row.length !== WORD_LENGTH) continue;
      // Each cell should have a letter and a status
      const hasLetters = row.every(cell => cell && typeof cell === "object" && (cell.letter || cell.key || cell.char || cell.value));
      if (!hasLetters) continue;
      const word = row.map(cell => (cell.letter || cell.key || cell.char || cell.value || "").toLowerCase()).join("");
      if (word.length !== WORD_LENGTH || !/^[a-z]+$/.test(word)) continue;
      const result = row.map(cell => normalizeStatus(cell.status || cell.state || cell.color || cell.type || ""));
      if (result.some(r => r === null)) continue; // row not yet evaluated
      guesses.push({ word, result });
    }
    return guesses;
  }

  /**
   * Extract from array of row objects that contain letters/statuses.
   */
  function extractFromRowObjects(rows) {
    const guesses = [];
    for (const row of rows) {
      // row might be { word, result } or { letters: [...] } etc.
      if (row.word && row.result) {
        const word = row.word.toLowerCase();
        if (word.length !== WORD_LENGTH) continue;
        const result = Array.isArray(row.result) ? row.result.map(r => normalizeStatus(r)) : null;
        if (!result || result.some(r => r === null)) continue;
        guesses.push({ word, result });
      }
    }
    return guesses;
  }

  function normalizeStatus(raw) {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (s === "correct" || s === "green" || s === "hit" || s === "2") return "correct";
    if (s === "present" || s === "yellow" || s === "close" || s === "1") return "present";
    if (s === "absent" || s === "gray" || s === "grey" || s === "miss" || s === "0") return "absent";
    return null;
  }

  /* -------------------------
     DOM COLOR FALLBACK
  ------------------------- */

  /**
   * Fallback: find tiles by geometry + single uppercase letter,
   * then read bg color via getComputedStyle.
   */
  function readBoardFromDOM() {
    const allEls = [...document.querySelectorAll("#root *")];

    const tiles = allEls.filter(el => {
      const text = el.textContent.trim();
      if (!/^[A-Za-z]$/.test(text)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 30 || rect.width > 90) return false;
      if (Math.abs(rect.width - rect.height) > 10) return false;
      return true;
    });

    if (tiles.length < WORD_LENGTH) return null;

    // Sort by top then left to get reading order
    tiles.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const rowDiff = Math.round((ra.top - rb.top) / 10);
      if (rowDiff !== 0) return rowDiff;
      return ra.left - rb.left;
    });

    console.log("[SG-Solver] DOM tiles found:", tiles.length);

    const guesses = [];
    for (let i = 0; i + WORD_LENGTH <= tiles.length; i += WORD_LENGTH) {
      const row = tiles.slice(i, i + WORD_LENGTH);
      const word = row.map(t => t.textContent.trim().toLowerCase()).join("");
      const result = row.map(tile => {
        const classified = classifyColor(null, tile);
        return classified;
      });
      console.log("[SG-Solver] Row", Math.floor(i/5), word, "->", result.join(","));
      if (result.some(r => r === null)) continue;
      guesses.push({ word, result });
    }
    return guesses.length > 0 ? { guesses } : null;
  }

  function classifyColor(bg, el) {
    // Check the tile element itself, its children (color may be on inner div),
    // and up to 2 parents — but stop before going too far up the tree
    const nodesToCheck = [
      el,
      ...Array.from(el.children),
      ...Array.from(el.querySelectorAll("*")).slice(0, 5),
      el.parentElement,
      el.parentElement?.parentElement,
    ].filter(Boolean);

    for (const node of nodesToCheck) {
      // Skip nodes that are likely keyboard or unrelated UI (too far from tile)
      if (!el.contains(node) && node !== el.parentElement && node !== el.parentElement?.parentElement) continue;
      const nodeBg = getComputedStyle(node).backgroundColor;
      const result = classifyRGB(nodeBg);
      if (result) {
        console.log("[SG-Solver] tile color found:", nodeBg, "->", result, "tag:", node.tagName, node.className?.slice(0,40));
        return result;
      }
    }
    const elBg = getComputedStyle(el).backgroundColor;
    console.log("[SG-Solver] tile UNCLASSIFIED:", elBg, el.className?.slice(0,60));
    return null;
  }

  function classifyRGB(bg) {
    const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    // Skip transparent
    if (bg.includes("rgba") && bg.includes(", 0)")) return null;
    // Skip very dark backgrounds (unplayed tiles, page bg) — all channels < 50
    if (r < 50 && g < 50 && b < 50) return null;
    // Tailwind green-600: rgb(22,163,74) — very low R, high G
    if (g > 100 && r < 60 && g > b * 1.5) return "correct";
    // Actual yellow: rgb(162,110,3) — R > G > B, low B, R significantly > B
    if (r > 100 && g > 60 && b < 40 && r > g && r > b * 4) return "present";
    // Gray revealed tile: rgb(44,52,65) or similar — roughly equal channels, any brightness
    // Dark unplayed tiles are rgb(~20,~25,~35) — very dark, handled by the < 50 check above
    if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 35) return "absent";
    return null;
  }

  function tryClassByClassName(el) {
    const cls = (el.className || "") + " " + (el.parentElement?.className || "");
    if (/green|correct|hit/i.test(cls)) return "correct";
    if (/yellow|present|close/i.test(cls)) return "present";
    if (/gray|grey|absent|miss/i.test(cls)) return "absent";
    return null;
  }

  /* -------------------------
     BOARD READER (combined)
  ------------------------- */

  function readBoard() {
    // Try fiber first
    const fiberResult = readBoardFromFiber();
    if (fiberResult && fiberResult.guesses.length > 0) {
      console.log("[SG-Solver] Fiber parse succeeded:", fiberResult.guesses.length, "guesses");
      return fiberResult;
    }
    // Fall back to DOM
    const domResult = readBoardFromDOM();
    if (domResult && domResult.guesses.length > 0) {
      console.log("[SG-Solver] DOM parse succeeded:", domResult.guesses.length, "guesses");
      return domResult;
    }
    console.log("[SG-Solver] No board state detected");
    return { guesses: [] };
  }

  /* -------------------------
     CONSTRAINT ENGINE
  ------------------------- */

  function buildConstraints(game) {
    const greens = Array(WORD_LENGTH).fill(null);
    const bannedPositions = {};  // letter -> Set of positions it cannot be at
    const minCounts = {};        // letter -> minimum occurrences required
    const maxCounts = {};        // letter -> maximum occurrences allowed (exact cap)

    game.guesses.forEach(g => {
      const letters = g.word.split("");
      const results = g.result;

      // First pass: count confirmed (correct + present) per letter in this guess
      const confirmedInGuess = {};
      for (let i = 0; i < WORD_LENGTH; i++) {
        const l = letters[i];
        const r = results[i];
        if (r === "correct" || r === "present") {
          confirmedInGuess[l] = (confirmedInGuess[l] || 0) + 1;
        }
      }

      // Second pass: apply constraints per position
      for (let i = 0; i < WORD_LENGTH; i++) {
        const l = letters[i];
        const r = results[i];

        if (r === "correct") {
          greens[i] = l;
        } else if (r === "present") {
          // Letter is in the word but NOT at this position
          bannedPositions[l] ??= new Set();
          bannedPositions[l].add(i);
        } else if (r === "absent") {
          // Letter is absent at this position — but might still be in word
          // if it appeared confirmed elsewhere in the same guess
          bannedPositions[l] ??= new Set();
          bannedPositions[l].add(i);

          // If confirmedInGuess[l] === 0, letter is completely absent → max 0
          // If confirmedInGuess[l] > 0, we know the exact count → cap at confirmed count
          const confirmed = confirmedInGuess[l] || 0;
          if (confirmed === 0) {
            maxCounts[l] = 0;
          } else {
            // Don't raise the cap above what's already been set from a previous guess
            if (maxCounts[l] === undefined) {
              maxCounts[l] = confirmed;
            } else {
              maxCounts[l] = Math.min(maxCounts[l], confirmed);
            }
          }
        }
      }

      // Update minimum counts from this guess
      for (const l in confirmedInGuess) {
        minCounts[l] = Math.max(minCounts[l] || 0, confirmedInGuess[l]);
      }
    });

    return { greens, bannedPositions, minCounts, maxCounts };
  }

  /* -------------------------
     FILTER
  ------------------------- */

  function validWord(word, c) {
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (c.greens[i] && word[i] !== c.greens[i]) return false;
    }
    for (const [l, posSet] of Object.entries(c.bannedPositions)) {
      for (const p of posSet) {
        if (word[p] === l) return false;
      }
    }
    const counts = {};
    for (const ch of word) counts[ch] = (counts[ch] || 0) + 1;
    for (const [l, min] of Object.entries(c.minCounts)) {
      if ((counts[l] || 0) < min) return false;
    }
    for (const [l, max] of Object.entries(c.maxCounts)) {
      if ((counts[l] || 0) > max) return false;
    }
    return true;
  }

  /* -------------------------
     RANKING
  ------------------------- */

  function rankWords(words) {
    const freq = {};
    words.forEach(w => [...new Set(w)].forEach(l => { freq[l] = (freq[l] || 0) + 1; }));
    return words
      .map(w => ({ word: w, score: [...new Set(w)].reduce((s, l) => s + (freq[l] || 0), 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  /* -------------------------
     SOLVER
  ------------------------- */

  function updateSolver() {
    const game = readBoard();
    if (game.guesses.length > 0) console.log("[SG-Solver] Guesses:", game.guesses.map(g => g.word+":"+g.result.map(r=>r[0]).join("")).join(" | "));
    const constraints = buildConstraints(game);
    const guessedWords = new Set(game.guesses.map(g => g.word));
    let candidates = WORDS.filter(w => validWord(w, constraints) && !guessedWords.has(w));
    const debug = `${game.guesses.length} guess(es) · ${candidates.length} left`;
    if (candidates.length === 0) candidates = WORDS;
    render(rankWords(candidates), debug);
  }

  /* -------------------------
     OBSERVER
  ------------------------- */

  function observeBoard() {
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      // Delay to allow tile flip animations to complete before reading colors
      setTimeout(() => {
        updateSolver();
        scheduled = false;
      }, 2000);
    });
    const root = document.getElementById("root");
    if (root) {
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
  }

  /* -------------------------
     INIT
  ------------------------- */

  await loadWords();
  initUI();
  observeBoard();
  updateSolver();

})();