// ==UserScript==
// @name         SG Tents Solver
// @namespace    https://github.com/palharesf/
// @version      1.5.0
// @match        https://lexaire.github.io/ThermoGift/*
// @grant        none
// @run-at       document-idle
// @author       palharesf
// @description  High-performance pairing-based solver for large Tents puzzles.
// @license      MIT
// ==/UserScript==

(function () {
  const EMPTY = 0,
    TREE = 1,
    TENT = 2,
    GRASS = 3;

  function readGrid() {
    const cells = document.querySelectorAll('button[aria-label^="Row "]');
    if (!cells.length) throw new Error("Puzzle grid not found.");

    let maxRow = 0,
      maxCol = 0;
    const parsed = [];
    for (const el of cells) {
      const m = el
        .getAttribute("aria-label")
        .match(/^Row (\d+), column (\d+)$/);
      if (!m) continue; // skips clue cells if they happen to share the prefix
      const r = +m[1] - 1,
        c = +m[2] - 1;
      maxRow = Math.max(maxRow, r);
      maxCol = Math.max(maxCol, c);
      const cls = el.className;
      let kind = EMPTY;
      if (cls.includes("tree-cell")) kind = TREE;
      else if (cls.includes("tent-cell")) kind = TENT;
      else if (cls.includes("grass-marked") || cls.includes("lake-marked"))
        kind = GRASS;
      parsed.push({ r, c, kind, el });
    }

    const size = maxRow + 1;
    const grid = Array.from({ length: size }, () => new Int8Array(size));
    const elGrid = Array.from({ length: size }, () => Array(size).fill(null));
    for (const { r, c, kind, el } of parsed) {
      grid[r][c] = kind;
      elGrid[r][c] = el;
    }

    const { rowClues, colClues } = readClues(size, parsed[0]?.el);
    return { grid, elGrid, size, rowClues, colClues };
  }

  // Try several detection strategies. Logs which one worked so future
  // breakage is obvious from the console.
  function readClues(size, anyCell) {
    // Strategy A: explicit aria-labels.
    const tryAria = (pattern) => {
      const arr = [];
      for (let i = 1; i <= size; i++) {
        const el = document.querySelector(
          `[aria-label="${pattern.replace("{i}", i)}"]`,
        );
        if (!el) return null;
        const n = parseInt(el.textContent, 10);
        if (Number.isNaN(n)) return null;
        arr.push(n);
      }
      return arr;
    };
    const rowA =
      tryAria("Row {i} clue") ||
      tryAria("Row {i} count") ||
      tryAria("Row {i} hint");
    const colA =
      tryAria("Column {i} clue") ||
      tryAria("Column {i} count") ||
      tryAria("Column {i} hint");
    if (rowA && colA) {
      console.log("Clues: read via aria-labels.");
      return { rowClues: rowA, colClues: colA };
    }

    // Strategy B: walk up from a cell to find the grid container, then
    // pull every direct number-only descendant. Column clues are usually
    // the first `size` numbers; row clues are the next `size`. Order
    // depends on layout, so we figure it out from element positions.
    if (anyCell) {
      let container = anyCell.parentElement;
      while (container && container !== document.body) {
        const numEls = Array.from(container.querySelectorAll("*")).filter(
          (el) =>
            el.children.length === 0 &&
            /^\s*\d+\s*$/.test(el.textContent || ""),
        );
        if (numEls.length >= size * 2) {
          const cellRect = anyCell.getBoundingClientRect();
          const cols = numEls
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter((o) => o.r.bottom <= cellRect.top + 4)
            .sort((a, b) => a.r.left - b.r.left)
            .slice(0, size)
            .map((o) => parseInt(o.el.textContent, 10));
          const rows = numEls
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter((o) => o.r.right <= cellRect.left + 4)
            .sort((a, b) => a.r.top - b.r.top)
            .slice(0, size)
            .map((o) => parseInt(o.el.textContent, 10));
          if (
            rows.length === size &&
            cols.length === size &&
            rows.every(Number.isFinite) &&
            cols.every(Number.isFinite)
          ) {
            console.log("Clues: read via DOM geometry.");
            return { rowClues: rows, colClues: cols };
          }
        }
        container = container.parentElement;
      }
    }

    throw new Error(
      "Could not auto-detect row/column clues. Inspect a clue element in DevTools " +
        "and either give it a recognizable aria-label, or call window.solveTents.setClues(rows, cols) " +
        "before clicking Solve.",
    );
  }

  const getAdj = (r, c, size, diag = false) => {
    const res = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (!diag && Math.abs(dr) + Math.abs(dc) > 1) continue;
        const nr = r + dr,
          nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) res.push([nr, nc]);
      }
    }
    return res;
  };

  function solve(grid, size, rowClues, colClues) {
    // Separate trees from already-placed tents so fixed tents can be
    // pre-counted and pre-blocked rather than rediscovered by the search.
    const trees = [];
    const tentGrid = Array.from({ length: size }, () => new Int8Array(size));
    const rCounts = new Int8Array(size),
      cCounts = new Int8Array(size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === TREE) trees.push({ r, c });
        else if (grid[r][c] === TENT) {
          tentGrid[r][c] = 1;
          rCounts[r]++;
          cCounts[c]++;
        }
      }
    }

    // Sanity check: existing tents already exceed clues → unsolvable.
    for (let i = 0; i < size; i++) {
      if (rCounts[i] > rowClues[i] || cCounts[i] > colClues[i]) {
        console.warn(`Pre-placed tents exceed clue at index ${i}.`);
        return null;
      }
    }

    // Candidates per tree: orthogonal neighbours that are EMPTY (new tent
    // slot) or already TENT (the tree is paired with that fixed tent).
    const treeCands = trees.map((t) =>
      getAdj(t.r, t.c, size, false).filter(
        ([nr, nc]) => grid[nr][nc] === EMPTY || grid[nr][nc] === TENT,
      ),
    );

    const indexedTrees = trees
      .map((t, i) => ({ ...t, cands: treeCands[i] }))
      .sort((a, b) => a.cands.length - b.cands.length);

    const usedSpots = new Set();

    function backtrack(idx) {
      if (idx === indexedTrees.length) {
        for (let i = 0; i < size; i++) {
          if (rCounts[i] !== rowClues[i] || cCounts[i] !== colClues[i])
            return false;
        }
        // Every fixed tent must have been claimed by some tree.
        for (let r = 0; r < size; r++)
          for (let c = 0; c < size; c++)
            if (grid[r][c] === TENT && !usedSpots.has(r * size + c))
              return false;
        return true;
      }

      const tree = indexedTrees[idx];
      for (const [tr, tc] of tree.cands) {
        const key = tr * size + tc;
        if (usedSpots.has(key)) continue;

        const isExisting = grid[tr][tc] === TENT;
        if (!isExisting) {
          if (rCounts[tr] >= rowClues[tr] || cCounts[tc] >= colClues[tc])
            continue;
          let conflict = false;
          for (const [ar, ac] of getAdj(tr, tc, size, true)) {
            if (tentGrid[ar][ac]) {
              conflict = true;
              break;
            }
          }
          if (conflict) continue;

          tentGrid[tr][tc] = 1;
          rCounts[tr]++;
          cCounts[tc]++;
          usedSpots.add(key);
          if (backtrack(idx + 1)) return true;
          tentGrid[tr][tc] = 0;
          rCounts[tr]--;
          cCounts[tc]--;
          usedSpots.delete(key);
        } else {
          // Pair tree with an existing tent — no count or grid change.
          usedSpots.add(key);
          if (backtrack(idx + 1)) return true;
          usedSpots.delete(key);
        }
      }
      return false;
    }

    if (!backtrack(0)) return null;

    const result = grid.map((row) => Int8Array.from(row));
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) if (tentGrid[r][c]) result[r][c] = TENT;
    return result;
  }

  let manualClues = null;
  window.autoSolve = function () {
    try {
      const data = readGrid();
      if (manualClues) {
        data.rowClues = manualClues.rows;
        data.colClues = manualClues.cols;
      }
      console.log("Row clues:", data.rowClues);
      console.log("Col clues:", data.colClues);

      const result = solve(data.grid, data.size, data.rowClues, data.colClues);
      if (!result) {
        alert(
          "No valid solution found. Check clues + existing markers (open console for diagnostics).",
        );
        return;
      }

      document.querySelectorAll('[data-tent-solution="1"]').forEach((el) => {
        el.style.boxShadow = "";
        delete el.dataset.tentSolution;
        const m = el.querySelector(".tent-marker");
        if (m) m.remove();
      });

      for (let r = 0; r < data.size; r++) {
        for (let c = 0; c < data.size; c++) {
          if (result[r][c] === TENT) {
            const el = data.elGrid[r][c];
            if (!el) continue;
            el.dataset.tentSolution = "1";
            el.style.boxShadow = "inset 0 0 0 4px #22c55e";
            if (!el.querySelector(".tent-marker")) {
              const span = document.createElement("span");
              span.className = "tent-marker";
              span.textContent = "⛺";
              Object.assign(span.style, {
                position: "absolute",
                inset: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                pointerEvents: "none",
                zIndex: "50",
              });
              if (getComputedStyle(el).position === "static")
                el.style.position = "relative";
              el.appendChild(span);
            }
          }
        }
      }
    } catch (e) {
      console.error("Solver Error:", e);
      alert(e.message);
    }
  };

  // Escape hatch if auto-detection ever breaks: paste arrays in the console.
  window.autoSolve.setClues = (rows, cols) => {
    manualClues = { rows, cols };
  };
  window.autoSolve.clearClues = () => {
    manualClues = null;
  };

  function injectUI() {
    if (document.getElementById("tents-solver-btn")) return;
    const btn = document.createElement("button");
    btn.id = "tents-solver-btn";
    btn.textContent = "⚡ Solve Tents";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "10000",
      padding: "12px 24px",
      background: "#22c55e",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "bold",
      boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
    });
    btn.onclick = window.autoSolve;
    document.body.appendChild(btn);
  }

  setTimeout(injectUI, 2000);
})();
