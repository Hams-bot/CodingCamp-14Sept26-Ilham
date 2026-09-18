# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement the three-file client-side app (`index.html` already exists, `css/style.css` and `js/script.js` need to be created). The JavaScript file is structured as nine sequential sections (CONSTANTS → STATE → STORAGE → VALIDATION → COMPUTE → RENDER → CHART → EVENTS → INIT). Each task below builds on the previous one; all code is wired together by the final integration task.

---

## Tasks

- [x] 1. Build `css/style.css` — theme tokens and base layout
  - [x] 1.1 Define CSS custom properties for dark and light themes
    - Create `css/style.css`
    - Declare `:root, [data-theme="dark"]` block with `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, `--color-warning`, `--color-danger`, `--color-border` tokens
    - Declare `[data-theme="light"]` block overriding all tokens
    - Verify contrast ratios ≥ 4.5 : 1 for text tokens in both themes
    - _Requirements: 8.5, 8.6, 2.4_

  - [x] 1.2 Implement mobile-first responsive grid
    - Add base single-column layout using CSS Grid for the main page regions: balance + banner, form, chart, transaction list
    - Add `@media (min-width: 768px)` breakpoint that creates a two-column grid placing form and chart side-by-side, with transaction list spanning full width below
    - Set `min-height: 44px; min-width: 44px` on all interactive controls (`button`, `select`, `input[type="submit"]`, `input[type="number"]`)
    - Ensure `overflow-x: hidden` on `body` and `overflow-y: auto` on `#transactionList`
    - _Requirements: 2.1, 2.2_

  - [x] 1.3 Style components: form, transaction list, balance, warning banner, chart container
    - Style `#transactionForm` field group with consistent spacing and border-radius using token variables
    - Style `.transaction-item` rows with name, category badge (`.category--Food`, `.category--Transport`, `.category--Fun`) and amount columns
    - Style `#balanceDisplay` as a prominent heading; add `.balance--over` class that changes color to `--color-warning`
    - Style `#warningBanner` as a dismissible-looking banner (hidden by default via `hidden` attribute)
    - Style inline error labels (`#itemNameError`, `#amountError`, `#categoryError`, `#spendLimitError`) in a danger color
    - _Requirements: 5.1, 10.3, 3.5, 10.6_

- [x] 2. Scaffold `js/script.js` — CONSTANTS and STATE sections
  - [x] 2.1 Write the CONSTANTS section
    - Create `js/script.js` with the section banner structure (all eight sections as empty banners)
    - Declare `LS_KEY_TRANSACTIONS = 'ebv_transactions'`, `LS_KEY_THEME = 'ebv_theme'`, `LS_KEY_SPEND_LIMIT = 'ebv_spend_limit'`
    - Declare `CATEGORIES = ['Food', 'Transport', 'Fun']`
    - Declare `CATEGORY_COLORS = { Food: '#e07b54', Transport: '#5b9bd5', Fun: '#6abf69' }` (distinct, consistent palette)
    - Declare `SORT_OPTIONS = { DEFAULT: 'default', AMOUNT_ASC: 'amount-asc', CATEGORY_ASC: 'category-asc' }`
    - _Requirements: 3.2, 6.6_

  - [x] 2.2 Write the STATE section
    - Declare the single mutable `state` object: `{ transactions: [], spendLimit: null, theme: 'dark', sortKey: 'default' }`
    - Add JSDoc `@typedef` for the `Transaction` shape (`id`, `name`, `amount`, `category`, `createdAt`)
    - _Requirements: 7.1 (authoritative in-memory source of truth)_

- [x] 3. Write the STORAGE section
  - [x] 3.1 Implement LocalStorage helpers with error handling
    - Write `loadTransactions()`: parse `ebv_transactions` from localStorage; on JSON parse error call `console.error(...)` and return `[]`; on missing key return `[]`
    - Write `saveTransactions(transactions)`: `JSON.stringify` and `localStorage.setItem`; wrap in `try/catch` with `console.warn` on failure
    - Write `loadTheme()`: read `ebv_theme`; return stored value if it is `'dark'` or `'light'`, otherwise return `'dark'`
    - Write `saveTheme(theme)`: `localStorage.setItem`; wrap in `try/catch`
    - Write `loadSpendLimit()`: `parseFloat(localStorage.getItem('ebv_spend_limit'))`; return `null` if `NaN` or ≤ 0
    - Write `saveSpendLimit(limit)`: if `limit` is `null` call `localStorage.removeItem`; else `setItem` the numeric string; wrap in `try/catch`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.3, 10.2_

- [x] 4. Write the VALIDATION section
  - [x] 4.1 Implement `validateForm` and `validateSpendLimit`
    - Write `validateForm(name, amount, category)` as a pure function returning an errors object; check: name non-empty after trim; amount is a finite number > 0; category is in `CATEGORIES`
    - Write `validateSpendLimit(value)`: return `null` for empty-string/null; return `null` for strictly positive finite number; return an error string for everything else
    - Export both functions by attaching them to a `VALIDATION` namespace object (for testability without `type="module"`)
    - _Requirements: 3.4, 3.5, 10.6_

- [x] 5. Write the COMPUTE section
  - [x] 5.1 Implement `computeBalance`, `computeCategoryTotals`, and `getSortedTransactions`
    - Write `computeBalance(transactions)`: reduce over amounts, return 0 for empty array
    - Write `computeCategoryTotals(transactions)`: reduce to `{ [category]: total }`, skip categories with no transactions
    - Write `getSortedTransactions(transactions, sortKey)`: spread-copy the array, sort by `amount` ascending or `category` A–Z (with `createdAt` tie-breaker), return copy unchanged for `'default'`
    - Attach all three to a `COMPUTE` namespace object
    - _Requirements: 5.2, 6.1, 9.2, 9.3_

- [x] 6. Write the RENDER section
  - [x] 6.1 Implement `renderBalance()`
    - Format `computeBalance(state.transactions)` with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` and set `#balanceDisplay.textContent`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 Implement `renderTransactionList()`
    - Call `getSortedTransactions(state.transactions, state.sortKey)`
    - If empty: show `#listEmpty`, hide `#listError`, clear list content
    - Otherwise: map sorted array to `<li class="transaction-item" data-id="{id}">` elements containing `.tx-name`, `.tx-category.category--{category}`, `.tx-amount`, and a `<button class="btn-delete" data-id="{id}" aria-label="Delete {name}">×</button>`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [x] 6.3 Implement `renderWarning()` and `renderTheme()`
    - `renderWarning()`: toggle `#warningBanner.hidden` and `.balance--over` on `#balanceDisplay` based on `state.spendLimit > 0 && computeBalance(state.transactions) > state.spendLimit`
    - `renderTheme()`: call `document.documentElement.setAttribute('data-theme', state.theme)` and update `#themeToggle.textContent`
    - _Requirements: 10.3, 10.4, 10.5, 8.2_

  - [x] 6.4 Implement `renderAll()`
    - Call `renderBalance()`, `renderTransactionList()`, `renderWarning()`, and `updateChart(computeCategoryTotals(state.transactions))` in sequence
    - _Requirements: 3.6, 4.5, 5.3, 5.4_

- [x] 7. Write the CHART section
  - [x] 7.1 Implement `initChart()`, `updateChart()`, `showChartEmpty()`, and `showChartError()`
    - Store the Chart.js instance in a module-level `let chartInstance = null`
    - `initChart()`: guard with `if (typeof Chart === 'undefined') { showChartError(); return; }`; construct `new Chart(ctx, CHART_CONFIG)` on `#spendingChart` canvas; show `#chartEmpty` if no transactions
    - `updateChart(categoryTotals)`: if `chartInstance` is null, return early; if `categoryTotals` is empty call `showChartEmpty()`; otherwise populate `chartInstance.data.labels`, `.data.datasets[0].data`, `.data.datasets[0].backgroundColor` from `CATEGORY_COLORS` and call `chartInstance.update('active')`; show canvas, hide `#chartEmpty`
    - `showChartEmpty()`: hide `#spendingChart`, show `#chartEmpty`, hide `#chartError`
    - `showChartError()`: hide `#spendingChart`, hide `#chartEmpty`, show `#chartError`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 8. Write the EVENTS section
  - [x] 8.1 Wire up the transaction form submit handler
    - Add `submit` listener on `#transactionForm`; call `validateForm(name, amount, category)`; on error write messages to `#itemNameError`, `#amountError`, `#categoryError` and return; on success: create a `Transaction` object (using `crypto.randomUUID()` with the fallback from the design), push to `state.transactions`, call `saveTransactions`, call `renderAll()`, clear form fields, return focus to `#itemName`
    - _Requirements: 3.4, 3.5, 3.6, 3.7_

  - [x] 8.2 Wire up the transaction delete handler (event delegation)
    - Add `click` listener on `#transactionList`; if `event.target.closest('.btn-delete')` matches, read `data-id`, filter it from `state.transactions`, call `saveTransactions`, call `renderAll()`
    - _Requirements: 4.4, 4.5_

  - [x] 8.3 Wire up the theme toggle handler
    - Add `click` listener on `#themeToggle`; toggle `state.theme` between `'dark'` and `'light'`; call `saveTheme(state.theme)`; call `renderTheme()`
    - _Requirements: 8.2, 8.3_

  - [x] 8.4 Wire up the sort control handler
    - Add `change` listener on `#sortSelect`; set `state.sortKey = event.target.value`; call `renderTransactionList()`
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x] 8.5 Wire up the spend limit set and clear handlers
    - `#setLimitBtn` click: call `validateSpendLimit(#spendLimit.value)`; on error write to `#spendLimitError` and return; on success: set `state.spendLimit = parsed`, call `saveSpendLimit`, call `renderWarning()`
    - `#clearLimitBtn` click: set `state.spendLimit = null`, call `saveSpendLimit(null)`, clear `#spendLimit.value`, call `renderWarning()`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 9. Write the INIT section and inline theme-flash prevention
  - [x] 9.1 Implement `init()` and hook it to `DOMContentLoaded`
    - Write `init()`: call `loadTransactions()` → `state.transactions`; call `loadTheme()` → `state.theme`; call `loadSpendLimit()` → `state.spendLimit`; call `renderTheme()`; call `initChart()`; call `renderAll()`
    - Register `document.addEventListener('DOMContentLoaded', init)`
    - _Requirements: 4.3, 7.2, 7.3, 7.4, 8.4_

  - [x] 9.2 Add inline theme script to `index.html` `<head>`
    - In `index.html`, add a `<script>` block immediately after `<head>` opens (before any stylesheets) that reads `localStorage.getItem('ebv_theme')` and calls `document.documentElement.setAttribute('data-theme', ...)` synchronously to prevent flash of wrong theme
    - _Requirements: 8.4_

- [x] 10. Checkpoint — end-to-end wiring
  - Manually open `index.html` in a browser and verify: adding a transaction updates balance, chart, and list; deleting a transaction updates all three; sort control reorders the list; theme toggle switches themes; page reload restores all state. Ask the user before proceeding if anything looks off.

---

## Notes

- `crypto.randomUUID()` fallback: `Date.now().toString(36) + Math.random().toString(36).slice(2)` — see design §Error Handling.
- All `localStorage` calls in STORAGE are wrapped in `try/catch`; the app degrades gracefully to in-memory-only state if storage is unavailable.
- Each task references specific requirements for traceability.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["1.3", "3.1"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "7.1"] },
    { "id": 5, "tasks": ["6.4"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 7, "tasks": ["9.1", "9.2"] }
  ]
}
```
