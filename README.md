# User Scripts Collection

A collection of useful userscripts for various websites.

## Scripts

### PAGYWOSG Event Auto-Clicker
- **File**: [pagywosg_button_clicker.user.js](pagywosg_button_clicker.user.js)
- **Source Code**: [GitHub](https://github.com/palharesf/user_scripts)
- **Install**: [Greasy Fork](https://greasyfork.org/en/scripts/550163-auto-click-event-details-buttons)
- **Description**: Automatically clicks "Collapse Description" and "Me" buttons on PAGYWOSG event pages

### Rosiminc Nono Cafe Timer
- **File**: [rosiminc_nono_cafe_timer.user.js](rosiminc_nono_cafe_timer.user.js)
- **Source Code**: [GitHub](https://github.com/palharesf/user_scripts)
- **Install**: [Greasy Fork](https://greasyfork.org/en/scripts/557948-rosiminc-nonogram-cafe-timer)
- **Description**: Displays a timer for Rosiminc Nono Cafe

### Steam Header Review Button
- **File**: [steam_header_review_button.js](steam_header_review_button.js)
- **Source Code**: [GitHub](https://github.com/palharesf/user_scripts)
- **Install**: [Greasy Fork](https://greasyfork.org/en/scripts/564137-steam-header-reviews-button)
- **Description**: A clean, minimal Violentmonkey userscript that:
    - Waits for the Steam global header to exist
    - Injects a new top-level menu item
    - Matches Steam’s DOM hierarchy, classes, and styling
    - Links directly to your Reviews page
    - Does not interfere with Steam’s JS tooltips or menus

### SG-Wordle Helper
- **File**: [sg-wordle_helper.js](sg-wordle_helper.js)
- **Source Code**: [GitHub](https://github.com/palharesf/user_scripts)
- **Install**: [Greasy Fork](https://greasyfork.org/en/scripts/568617-helper-for-sg-wordle)
- **Description**: Adds a floating Solver panel to the [SG-Wordle](https://sg-wordle.netlify.app/) page that suggests the best remaining words based on your guesses. It reads the board state via React fiber inspection (with a DOM color fallback), applies Wordle constraints (green/yellow/gray), and ranks candidates by letter frequency.

### SteamGifts Link to Ercalote
- **File**: [sg_link_to_ercalote.js](sg_link_to_ercalote.js)
- **Source Code**: [GitHub](https://github.com/palharesf/user_scripts)
- **Install**: [Greasy Fork](https://greasyfork.org/en/scripts/569050-steamgifts-link-to-ercalote)
- **Description**: Adds "Won By" and "Gifted To" buttons to user pages on SteamGifts, linking directly to [Ercalote](https://ercalote.azurewebsites.net/) filtered by that user's won/sent giveaways

### SG Tents Solver
- **File**: [sg_tents_solver.js](sg_tents_solver.js)
- **Source Code**: [GitHub](https://github.com/palharesf/user_scripts)
- **Install**: [Greasy Fork](https://greasyfork.org/en/scripts/576765-sg-tents-solver)
- **Description**: Adds a floating "⚡ Solve Tents" button to the [ThermoGift Tents](https://lexaire.github.io/ThermoGift/) puzzle page. Reads the board state (trees, tents, grass) and row/column clues from the DOM, then applies a backtracking pairing algorithm to find the unique valid tent placement. Solved cells are highlighted with a green outline and tent emoji overlay. Clue detection is automatic (tries aria-labels first, then falls back to DOM geometry); if auto-detection fails, clues can be supplied manually via `window.autoSolve.setClues(rows, cols)` in the console.

### Future Scripts
More userscripts will be added here...