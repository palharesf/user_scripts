// ==UserScript==
// @name         Parquet Puzzle Solver (Forced Refresh)
// @namespace    https://github.com/palharesf/
// @version      3.3
// @description  Injects solution and forces React to re-render the SVG. Source code and development: https://github.com/palharesf/user_scripts
// @author       palharesf
// @license      MIT
// @match        https://abdniszan.github.io/Parquet-/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
//
// Changelog:
// v1.1 - Added polling to wait for dynamic content
// v1.0 - Initial release
// ==/UserScript==

(function () {
  "use strict";

  const inject = () => {
    if (window.PARQUET_RUN) return;
    window.PARQUET_RUN = true;

    const script = document.createElement("script");
    script.textContent = `
            (function() {
                class Solver {
                    constructor(grid) {
                        this.grid = grid;
                        this.rows = grid.length;
                        this.cols = grid[0].length;
                        this.regions = {};
                        for (let r = 0; r < this.rows; r++) {
                            for (let c = 0; c < this.cols; c++) {
                                const cell = this.grid[r][c];
                                if (!cell.group) continue;
                                const match = String(cell.group).match(/^(\\d+)(.*)$/);
                                if (match) {
                                    const id = match[1];
                                    const sub = match[2] || 'a';
                                    if (!this.regions[id]) this.regions[id] = {};
                                    if (!this.regions[id][sub]) this.regions[id][sub] = [];
                                    this.regions[id][sub].push({ r, c });
                                }
                            }
                        }
                        this.ids = Object.keys(this.regions);
                    }
                    solve() {
                        const sol = {};
                        return this.backtrack(0, sol) ? sol : null;
                    }
                    backtrack(idx, sol) {
                        if (idx === this.ids.length) return this.check(sol);
                        const id = this.ids[idx];
                        for (const sub of Object.keys(this.regions[id])) {
                            sol[id] = sub;
                            if (this.partial(sol) && this.backtrack(idx + 1, sol)) return true;
                            delete sol[id];
                        }
                        return false;
                    }
                    partial(sol) {
                        const mask = this.getMask(sol);
                        for (let r = 0; r < this.rows - 1; r++) {
                            for (let c = 0; c < this.cols - 1; c++) {
                                if (mask[r][c] && mask[r+1][c] && mask[r][c+1] && mask[r+1][c+1]) return false;
                            }
                        }
                        return true;
                    }
                    check(sol) {
                        const mask = this.getMask(sol);
                        let count = 0, start = null;
                        for (let r = 0; r < this.rows; r++) {
                            for (let c = 0; c < this.cols; c++) {
                                if (mask[r][c]) {
                                    count++;
                                    if (!start) start = [r, c];
                                }
                            }
                        }
                        if (count === 0) return false;
                        const visited = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
                        const q = [start];
                        visited[start[0]][start[1]] = 1;
                        let found = 0;
                        while(q.length) {
                            const [r, c] = q.shift();
                            found++;
                            [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([nr,nc]) => {
                                if (nr>=0 && nr<this.rows && nc>=0 && nc<this.cols && mask[nr][nc] && !visited[nr][nc]) {
                                    visited[nr][nc] = 1;
                                    q.push([nr, nc]);
                                }
                            });
                        }
                        return found === count;
                    }
                    getMask(sol) {
                        const m = Array.from({length: this.rows}, () => Array(this.cols).fill(0));
                        for (const id in sol) {
                            this.regions[id][sol[id]].forEach(p => m[p.r][p.c] = 1);
                        }
                        return m;
                    }
                }

                function run() {
                    const el = document.getElementById('grid-svg');
                    if (!el) return;
                    const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
                    const fiber = el[key];
                    const props = fiber.return.memoizedProps;

                    const sol = new Solver(JSON.parse(JSON.stringify(props.grid))).solve();
                    if (!sol) return alert('No solution found');

                    const newGrid = props.grid.map(row => row.map(cell => ({
                        ...cell,
                        active: (cell.group && sol[String(cell.group).match(/^(\\d+)/)[1]] === (String(cell.group).match(/\\d+(.*)$/)[1] || 'a')) ? 1 : 0
                    })));

                    props.setGrid(newGrid);

                    // Force React to realize the state has changed
                    setTimeout(() => {
                        const event = new MouseEvent('click', { bubbles: true });
                        el.dispatchEvent(event);
                    }, 100);
                }

                const obs = new MutationObserver(() => {
                    if (document.getElementById('grid-svg') && !document.getElementById('sol-btn')) {
                        const btn = document.createElement('button');
                        btn.id = 'sol-btn';
                        btn.innerText = '🧩 Solve Parquet';
                        btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:15px;background:#059669;color:white;border-radius:20px;cursor:pointer;font-weight:bold;';
                        btn.onclick = run;
                        document.body.appendChild(btn);
                    }
                });
                obs.observe(document.body, {childList: true, subtree: true});
            })();
        `;
    document.documentElement.appendChild(script);
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
