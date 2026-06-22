// ==UserScript==
// @name         Rosiminc Nonogram QoL Tools
// @namespace    https://github.com/palharesf/
// @version      1.1.2
// @description  Add a timer and automatic hint-shading toggle to RosimInc's Nonogram Cafe
// @author       palharesf
// @license      MIT
// @match        https://rosiminc.github.io/sg-nonograms/*
// @run-at       document-start
// @grant        none
//
// Changelog:
// v1.0 - Initial release - timer
// v1.1 - Added integrated QoL Auto Hint-Shading with UI toggle and localStorage state persistence
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // 1. SETTINGS & PERSISTENCE (LOCAL STORAGE)
    // ==========================================
    const SETTINGS_KEY = 'nono_qol_settings';
    const settings = { autoShading: true };

    try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            if (parsedSettings && typeof parsedSettings === 'object') {
                Object.assign(settings, parsedSettings);
            }
        }
    } catch (e) {
        console.error('Failed to parse nonogram QoL settings', e);
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    // ==========================================
    // 2. ORIGINAL TIMER MODULE
    // ==========================================
    function runTimerModule() {
        if (document.getElementById('nonogram-timer')) return;

        let timerInterval = null;
        let startTime = null;
        let elapsedTime = 0;
        let timerStarted = false;
        let gameFinished = false;

        const timerDiv = document.createElement('div');
        timerDiv.id = 'nonogram-timer';
        timerDiv.textContent = '00:00';

        const bgColor = window.getComputedStyle(document.body).backgroundColor;
        timerDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${bgColor};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: sans-serif;
            font-size: 24px;
            font-weight: 700;
            z-index: 10000;
            user-select: none;
        `;

        function applyButtonStyles() {
            const undoButton = document.querySelector('button');
            if (!undoButton) return;

            const buttonStyles = window.getComputedStyle(undoButton);
            timerDiv.style.fontFamily = buttonStyles.fontFamily;
            timerDiv.style.fontWeight = buttonStyles.fontWeight;
        }

        applyButtonStyles();
        setTimeout(applyButtonStyles, 500);
        document.body.appendChild(timerDiv);

        function formatTime(ms) {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        function updateTimer() {
            elapsedTime = Date.now() - startTime;
            timerDiv.textContent = formatTime(elapsedTime);
        }

        function startTimer() {
            if (timerStarted || gameFinished) return;

            timerStarted = true;
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 100);
        }

        function stopTimer() {
            if (timerInterval === null) return;

            clearInterval(timerInterval);
            timerInterval = null;
        }

        function isVisible(element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden';
        }

        function hasCompletionMessage(msgDiv) {
            return Boolean(msgDiv && isVisible(msgDiv) && msgDiv.textContent.trim());
        }

        function stopTimerIfComplete(msgDiv = document.getElementById('msgDiv')) {
            if (!hasCompletionMessage(msgDiv)) return;

            gameFinished = true;
            stopTimer();
        }

        function findMsgDiv(node) {
            if (!node) return null;

            const element = node.nodeType === 1 ? node : node.parentElement;
            if (!element) return null;

            if (element.id === 'msgDiv') return element;
            return element.closest?.('#msgDiv') || element.querySelector?.('#msgDiv') || null;
        }

        document.addEventListener('click', function(e) {
            if (e.target && e.target.tagName === 'CANVAS' && !timerStarted) {
                startTimer();
            }
        }, true);

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                stopTimerIfComplete(findMsgDiv(mutation.target));

                mutation.addedNodes.forEach(function(node) {
                    stopTimerIfComplete(findMsgDiv(node));
                });

                if (mutation.type === 'attributes' && mutation.target.id === 'msgDiv') {
                    stopTimerIfComplete(mutation.target);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeFilter: ['style', 'class']
        });

        setTimeout(() => stopTimerIfComplete(), 500);
    }

    // ==========================================
    // 3. AUTO-SHADING HINT SUITE UTILITIES
    // ==========================================
    function getBlocks(arr) {
        const blocks = [];
        let currentCount = 0;

        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === 1) {
                currentCount++;
            } else if (currentCount > 0) {
                blocks.push(currentCount);
                currentCount = 0;
            }
        }

        if (currentCount > 0) {
            blocks.push(currentCount);
        }

        return blocks;
    }

    function linesMatch(blocks, hints) {
        if (blocks.length === 0 && hints.length === 1 && hints[0] === 0) return true;
        if (blocks.length !== hints.length) return false;
        return blocks.every((b, i) => b === hints[i]);
    }

    function fillLooksLikeFilledCell(fillArgs) {
        if (!fillArgs || fillArgs.length === 0) return false;

        const [firstArg] = fillArgs;
        let r = 0;
        let g = 0;
        let b = 0;

        if (firstArg && typeof firstArg === 'object' && firstArg.levels) {
            [r, g, b] = firstArg.levels;
        } else if (typeof firstArg === 'number') {
            r = firstArg;
            g = fillArgs[1] !== undefined ? fillArgs[1] : firstArg;
            b = fillArgs[2] !== undefined ? fillArgs[2] : firstArg;
        }

        return (r < 40 && g < 40 && b < 40) || (b > 100 && r < 40);
    }

    function restoreFill(p, originalFill, fillArgs) {
        if (fillArgs && fillArgs.length > 0) {
            originalFill.apply(p, fillArgs);
        }
    }

    // ==========================================
    // 4. CANVAS INTERCEPTION ENGINE (p5.js Hooks)
    // ==========================================
    function hookP5(OriginalP5) {
        if (!OriginalP5 || OriginalP5.isNonoQolHooked) return OriginalP5;

        const WrappedP5 = function(sketchFn, ...constructorArgs) {
            if (typeof sketchFn !== 'function') {
                return new OriginalP5(sketchFn, ...constructorArgs);
            }

            return new OriginalP5(function(p) {
                sketchFn(p);

                if (p._nonoQolHooked) return;
                p._nonoQolHooked = true;

                const originalDraw = typeof p.draw === 'function' ? p.draw : function() {};
                let lastFillColor = null;

                const originalFill = p.fill;
                p.fill = function(...args) {
                    lastFillColor = args;
                    return originalFill.apply(this, args);
                };

                const originalRect = p.rect;
                p.rect = function(x, y, w, h) {
                    if (Math.abs(w - 30) < 0.01 && Math.abs(h - 30) < 0.01 && x >= 0 && y >= 0) {
                        const col = Math.round(x / 30);
                        const row = Math.round(y / 30);
                        if (!p._mirrorGrid) p._mirrorGrid = [];
                        if (!p._mirrorGrid[row]) p._mirrorGrid[row] = [];
                        p._mirrorGrid[row][col] = fillLooksLikeFilledCell(lastFillColor) ? 1 : 0;
                    }

                    return originalRect.apply(this, arguments);
                };

                const originalText = p.text;
                p.text = function(hint, x, y) {
                    const numericHint = Number(hint);
                    let shouldShade = false;

                    if (Number.isFinite(numericHint)) {
                        if (x < 0 && y >= 0) {
                            const row = Math.floor(y / 30);
                            if (!p._rowHintsCollected) p._rowHintsCollected = {};
                            if (!p._rowHintsCollected[row]) p._rowHintsCollected[row] = [];
                            p._rowHintsCollected[row].push({ hint: numericHint, x: x });

                            shouldShade = Boolean(
                                settings.autoShading &&
                                p._mirrorGrid &&
                                p._rowHintsFinal &&
                                p._rowHintsFinal[row] &&
                                linesMatch(getBlocks(p._mirrorGrid[row]), p._rowHintsFinal[row])
                            );
                        } else if (x >= 0 && y < 0) {
                            const col = Math.floor(x / 30);
                            if (!p._colHintsCollected) p._colHintsCollected = {};
                            if (!p._colHintsCollected[col]) p._colHintsCollected[col] = [];
                            p._colHintsCollected[col].push({ hint: numericHint, y: y });

                            if (settings.autoShading && p._mirrorGrid && p._colHintsFinal && p._colHintsFinal[col]) {
                                const colCells = p._mirrorGrid.map(row => row && row[col] ? row[col] : 0);
                                shouldShade = linesMatch(getBlocks(colCells), p._colHintsFinal[col]);
                            }
                        }
                    }

                    if (!shouldShade) {
                        return originalText.apply(this, arguments);
                    }

                    originalFill.call(p, 150);
                    const result = originalText.apply(this, arguments);
                    restoreFill(p, originalFill, lastFillColor);
                    return result;
                };

                p.draw = function() {
                    p._rowHintsCollected = {};
                    p._colHintsCollected = {};
                    originalDraw.apply(this, arguments);

                    p._rowHintsFinal = {};
                    Object.keys(p._rowHintsCollected).forEach(row => {
                        p._rowHintsCollected[row].sort((a, b) => a.x - b.x);
                        p._rowHintsFinal[row] = p._rowHintsCollected[row].map(item => item.hint);
                    });

                    p._colHintsFinal = {};
                    Object.keys(p._colHintsCollected).forEach(col => {
                        p._colHintsCollected[col].sort((a, b) => a.y - b.y);
                        p._colHintsFinal[col] = p._colHintsCollected[col].map(item => item.hint);
                    });
                };
            }, ...constructorArgs);
        };

        try {
            Object.setPrototypeOf(WrappedP5, OriginalP5);
        } catch (e) {}

        WrappedP5.prototype = OriginalP5.prototype;
        Object.getOwnPropertyNames(OriginalP5).forEach(prop => {
            if (prop in WrappedP5) return;

            try {
                WrappedP5[prop] = OriginalP5[prop];
            } catch (e) {}
        });

        Object.defineProperty(WrappedP5, 'isNonoQolHooked', { value: true });
        Object.defineProperty(WrappedP5, 'isHooked', { value: true });
        return WrappedP5;
    }

    // ==========================================
    // 5. TOGGLE SWITCH DOM INJECTION
    // ==========================================
    function injectSettingsUI() {
        if (document.getElementById('qol-settings-panel')) return;

        const targetDiv = document.getElementById('nonoDiv') || document.body;
        const container = document.createElement('div');
        container.id = 'qol-settings-panel';
        container.style.cssText = 'margin: 10px 0; font-family: sans-serif; font-size: 14px;';

        const label = document.createElement('label');
        label.style.cssText = 'cursor: pointer; display: inline-flex; align-items: center; gap: 6px; color: inherit;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = settings.autoShading;

        checkbox.addEventListener('change', e => {
            settings.autoShading = e.target.checked;
            saveSettings();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('Enable Auto Hint-Shading'));
        container.appendChild(label);

        if (targetDiv.parentNode) {
            targetDiv.parentNode.insertBefore(container, targetDiv);
        } else {
            document.body.appendChild(container);
        }
    }

    // ==========================================
    // 6. INITIALIZATION DISPATCHER
    // ==========================================
    let currentP5 = window.p5;
    if (currentP5) {
        window.p5 = hookP5(currentP5);
    } else {
        Object.defineProperty(window, 'p5', {
            get: () => currentP5,
            set: val => {
                currentP5 = hookP5(val);
            },
            configurable: true
        });
    }

    function runDomModules() {
        if (!document.body) {
            setTimeout(runDomModules, 50);
            return;
        }

        runTimerModule();
        injectSettingsUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runDomModules);
    } else {
        runDomModules();
    }
})();
