# Design Document — Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a self-contained, client-side web application delivered as exactly three files. It lets users record expenses (name, amount, category), view a running balance, explore a live pie chart of category spending, and set an overspending threshold — all with no server, no build step, and no JavaScript framework. Data is persisted entirely in `localStorage`. Chart.js v4.4.0 is the only external dependency, loaded from a CDN.

### Goals

- Zero-dependency runtime beyond Chart.js CDN.
- All state lives in a single in-memory JavaScript array that is the authoritative source of truth; the DOM and `localStorage` are derived from it.
- Every UI update (add, delete, sort, theme switch) completes within 100 ms.
- Mobile-first responsive layout from 320 px to 1920 px.

### Non-Goals

- Backend persistence or multi-device sync.
- User authentication.
- Custom categories beyond the three predefined ones (Food, Transport, Fun).

---

## Architecture

The app is a classic "render on state change" architecture without a virtual DOM. A single in-memory state object is mutated by event handlers, then a full render pass re-builds the relevant DOM regions.

```
┌──────────────────────────────────────────────┐
│                   Browser                    │
│                                              │
│  ┌──────────────┐      ┌──────────────────┐  │
│  │  index.html  │ ───► │  css/style.css   │  │
│  │  (structure) │      │  (presentation)  │  │
│  └──────┬───────┘      └──────────────────┘  │
│         │ loads                              │
│  ┌──────▼───────┐                           │
│  │ js/script.js │                           │
│  │  ┌─────────┐ │  read/write  ┌──────────┐ │
│  │  │  STATE  │◄├─────────────►│LocalStg. │ │
│  │  └────┬────┘ │              └──────────┘ │
│  │       │ drives                           │
│  │  ┌────▼─────────────────────────────┐   │
│  │  │  RENDER  (DOM mutations)          │   │
│  │  │  + CHART (Chart.js instance)      │   │
│  │  └──────────────────────────────────┘   │
│  └──────────────────────────────────────────┘
│                                              │
│  CDN: cdn.jsdelivr.net/npm/chart.js@4.4.0   │
└──────────────────────────────────────────────┘
```

### Data flow for a typical "add transaction" action

1. User fills the form and clicks **Add Transaction**.
2. `EVENTS` handler calls `VALIDATION.validateForm()`.
3. On success: a new `Transaction` object is created → pushed to `STATE.transactions` → `STORAGE.saveTransactions()` → `RENDER.renderAll()`.
4. `renderAll()` calls `renderBalance()`, `renderTransactionList()`, `renderWarning()`, and `CHART.update()`.

---

## Components and Interfaces

### HTML Regions and Their IDs

| Region | Key element IDs |
|---|---|
| Balance display | `#balanceDisplay` |
| Theme toggle | `#themeToggle` |
| Overspending banner | `#warningBanner` |
| Transaction form | `#transactionForm`, `#itemName`, `#amount`, `#category` |
| Form error labels | `#itemNameError`, `#amountError`, `#categoryError` |
| Spend-limit controls | `#spendLimit`, `#spendLimitError`, `#setLimitBtn`, `#clearLimitBtn` |
| Pie chart | `#spendingChart`, `#chartEmpty`, `#chartError` |
| Transaction list | `#transactionList`, `#listEmpty`, `#listError`, `#sortSelect` |

### js/script.js Internal Section Layout

The single JavaScript file is organized into clearly delimited sections using banner comments. Execution flows strictly top-to-bottom within the file; modules are not used (no `type="module"`) to keep the file runnable by direct `file://` open.

```
/****** CONSTANTS ******/
/****** STATE ******/
/****** STORAGE ******/
/****** VALIDATION ******/
/****** COMPUTE ******/
/****** RENDER ******/
/****** CHART ******/
/****** EVENTS ******/
/****** INIT ******/
```

**CONSTANTS** — Immutable values: `LS_KEY_TRANSACTIONS`, `LS_KEY_THEME`, `LS_KEY_SPEND_LIMIT`, `CATEGORIES`, `CATEGORY_COLORS`, `SORT_OPTIONS`.

**STATE** — The single mutable object:
```js
const state = {
  transactions: [],   // Transaction[]
  spendLimit: null,   // number | null
  theme: 'dark',      // 'dark' | 'light'
  sortKey: 'default', // 'default' | 'amount-asc' | 'category-asc'
};
```

**STORAGE** — `loadTransactions()`, `saveTransactions()`, `loadTheme()`, `saveTheme()`, `loadSpendLimit()`, `saveSpendLimit()`.

**VALIDATION** — `validateForm(name, amount, category)`, `validateSpendLimit(value)`. Both return an errors object; they never read or write DOM.

**COMPUTE** — `computeBalance(transactions)`, `computeCategoryTotals(transactions)`, `getSortedTransactions(transactions, sortKey)`.

**RENDER** — `renderAll()`, `renderBalance()`, `renderTransactionList()`, `renderWarning()`, `renderTheme()`.

**CHART** — Chart.js instance management: `initChart()`, `updateChart(categoryTotals)`, `showChartEmpty()`, `showChartError()`.

**EVENTS** — All `addEventListener` calls. No business logic here; handlers delegate immediately to the appropriate VALIDATION / STATE / RENDER functions.

**INIT** — `init()` called once at `DOMContentLoaded`. Loads state from `localStorage`, calls `renderAll()`, and sets up the Chart instance.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id          — UUID v4 generated at creation time (crypto.randomUUID())
 * @property {string} name        — Non-empty display name (user input, trimmed)
 * @property {number} amount      — Positive float, rounded to 2 decimal places at parse time
 * @property {'Food'|'Transport'|'Fun'} category
 * @property {number} createdAt   — Unix timestamp (Date.now()) used for default sort & tie-breaking
 */
```

### LocalStorage Keys

All keys are prefixed with `ebv_` to avoid collisions with other apps on the same origin.

| Key | Type stored | Description |
|---|---|---|
| `ebv_transactions` | `JSON` array of `Transaction` | Full list of persisted transactions |
| `ebv_theme` | `"dark"` \| `"light"` | Active theme name |
| `ebv_spend_limit` | numeric string or absent | Active spend limit; absent means no limit |

### Spend_Limit Storage

- Stored as a plain numeric string (`"150.00"`) under `ebv_spend_limit`.
- On load: `parseFloat(localStorage.getItem('ebv_spend_limit'))` — if the result is `NaN` or ≤ 0, `state.spendLimit` is set to `null`.
- Cleared explicitly via `localStorage.removeItem('ebv_spend_limit')`.

---

## CSS Architecture

### Theme System

Themes are implemented with CSS custom properties scoped to `[data-theme]` attribute on the `<html>` element. JavaScript writes `document.documentElement.setAttribute('data-theme', theme)` synchronously — this must happen in a `<script>` block in `<head>` (before the body parses) to prevent a flash of unstyled content.

```css
:root,
[data-theme="dark"] {
  --color-bg: #1a1a2e;
  --color-surface: #16213e;
  --color-text: #e0e0e0;
  --color-accent: #0f3460;
  /* … */
}

[data-theme="light"] {
  --color-bg: #f5f5f5;
  --color-surface: #ffffff;
  --color-text: #1a1a1a;
  --color-accent: #e8e8e8;
  /* … */
}
```

### Responsive Grid

Mobile-first single-column layout. At ≥ 768 px a two-column grid places the chart and form side-by-side, with the transaction list spanning the full width below.

```
Mobile (< 768px)              Desktop (≥ 768px)
┌───────────────────┐         ┌────────────┬────────────┐
│  Balance + Banner │         │  Balance + Banner (span)│
├───────────────────┤         ├────────────┼────────────┤
│  Input Form       │         │ Input Form │  Chart     │
├───────────────────┤         ├────────────┴────────────┤
│  Chart            │         │  Transaction List        │
├───────────────────┤         └─────────────────────────┘
│  Transaction List │
└───────────────────┘
```

All interactive controls (`button`, `select`, `input[type="submit"]`) are styled with `min-height: 44px; min-width: 44px` for WCAG 2.5.5 compliance at mobile viewports.

---

## Chart.js Integration

### Initialization

`initChart()` runs once during `INIT`. It constructs a `new Chart(ctx, config)` instance using the `<canvas id="spendingChart">` element. The chart instance is stored in a module-level variable `chartInstance` so `updateChart()` can mutate its datasets without destroying and recreating the canvas.

```js
const CHART_CONFIG = {
  type: 'pie',
  data: {
    labels: [],
    datasets: [{ data: [], backgroundColor: [] }],
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(2)}`,
        },
      },
    },
  },
};
```

### Update Strategy

`updateChart(categoryTotals)` mutates `chartInstance.data.labels`, `.data.datasets[0].data`, and `.data.datasets[0].backgroundColor` in place, then calls `chartInstance.update('active')` (Chart.js animated update). This avoids flickering from re-instantiation.

### CDN Failure Detection

A `<script>` error handler wraps the Chart.js CDN tag:
```html
<script
  src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
  onerror="document.getElementById('chartError').hidden = false;"
></script>
```
In `INIT`, `showChartError()` is called if `typeof Chart === 'undefined'` after the CDN tag loads (covers async-load failures). The `#chartError` element contains a user-friendly fallback message; `#spendingChart` canvas is hidden.

### Empty State

`showChartEmpty()` hides the `<canvas>` and shows `#chartEmpty`. `updateChart()` calls this automatically when `categoryTotals` is empty.

---

## Validation Logic

### Form Validation (`validateForm`)

`validateForm(name, amount, category)` is a pure function:

```js
function validateForm(name, amount, category) {
  const errors = {};
  if (!name || name.trim() === '') {
    errors.name = 'Transaction name is required.';
  }
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    errors.amount = 'Amount must be a positive number.';
  }
  if (!category || !CATEGORIES.includes(category)) {
    errors.category = 'Please select a category.';
  }
  return errors; // {} means valid
}
```

Inline errors are displayed by writing to `#itemNameError`, `#amountError`, `#categoryError` text content. `aria-live="polite"` on these elements announces errors to screen readers. The form submit handler returns early (no transaction created) if `Object.keys(errors).length > 0`.

### Spend Limit Validation (`validateSpendLimit`)

```js
function validateSpendLimit(value) {
  const parsed = parseFloat(value);
  if (value === '' || value === null) return null; // clearing the limit is valid
  if (isNaN(parsed) || parsed <= 0) return 'Spend limit must be a positive number.';
  return null; // null = valid
}
```

Errors are shown in `#spendLimitError`.

---

## Compute Functions

### `computeBalance(transactions)`

```js
// Pure function: Transaction[] → number
function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}
```

### `computeCategoryTotals(transactions)`

```js
// Pure function: Transaction[] → { [category: string]: number }
function computeCategoryTotals(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}
```

### `getSortedTransactions(transactions, sortKey)`

Returns a **new array** (never mutates the input). Tie-breaking always uses `createdAt` ascending.

```js
// Pure function: (Transaction[], string) → Transaction[]
function getSortedTransactions(transactions, sortKey) {
  const copy = [...transactions];
  if (sortKey === 'amount-asc') {
    copy.sort((a, b) => a.amount - b.amount || a.createdAt - b.createdAt);
  } else if (sortKey === 'category-asc') {
    copy.sort((a, b) => a.category.localeCompare(b.category) || a.createdAt - b.createdAt);
  }
  // 'default': insertion order (createdAt ascending)
  return copy;
}
```

---

## Render Functions

### `renderAll()`

```js
function renderAll() {
  renderBalance();
  renderTransactionList();
  renderWarning();
  updateChart(computeCategoryTotals(state.transactions));
}
```

### `renderBalance()`

Formats `computeBalance(state.transactions)` as `$X,XXX.XX` using `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` and sets `#balanceDisplay.textContent`.

### `renderTransactionList()`

1. Calls `getSortedTransactions(state.transactions, state.sortKey)`.
2. If empty: shows `#listEmpty`, hides list items.
3. Otherwise: maps sorted array to `<li>` elements with name, formatted amount, category badge, and a delete `<button data-id="...">`.

Each transaction item uses this structure:
```html
<li class="transaction-item" data-id="{id}">
  <span class="tx-name">{name}</span>
  <span class="tx-category category--{category}">{category}</span>
  <span class="tx-amount">{formatted}</span>
  <button class="btn-delete" data-id="{id}" aria-label="Delete {name}">×</button>
</li>
```

### `renderWarning()`

```js
function renderWarning() {
  const over = state.spendLimit !== null
    && state.spendLimit > 0
    && computeBalance(state.transactions) > state.spendLimit;
  document.getElementById('warningBanner').hidden = !over;
  document.getElementById('balanceDisplay')
    .classList.toggle('balance--over', over);
}
```

### `renderTheme()`

```js
function renderTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeToggle').textContent =
    state.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` unavailable (private browsing, quota exceeded) | All `localStorage` calls are wrapped in `try/catch`; on failure the app continues with in-memory state only, and a non-blocking console warning is emitted. |
| Malformed JSON in `ebv_transactions` | `loadTransactions()` catches the `JSON.parse` exception, calls `console.error(...)`, and returns `[]`. |
| Malformed JSON in `ebv_spend_limit` | `loadSpendLimit()` returns `null` on any parse failure. |
| Chart.js CDN fails to load | `#chartError` is shown; chart-dependent code is guarded by `if (chartInstance)` checks. |
| `crypto.randomUUID()` unavailable (very old browsers) | Fallback: `Date.now().toString(36) + Math.random().toString(36).slice(2)`. |

---

## Testing Strategy

### Dual Testing Approach

Unit tests verify specific examples, edge cases, and error conditions. Property-based tests verify universal properties across generated inputs. Both are complementary.

### Unit / Example Tests

Focused on:
- DOM structure assertions (correct element IDs, form fields, dropdown options)
- Validation rejection of specific invalid inputs (empty string, `-1`, `"abc"`)
- Empty-state rendering (no transactions → empty message shown, balance = "$0.00")
- Chart config object shape (correct labels and colors for a known input)
- Theme attribute applied synchronously on load

### Property-Based Testing

Use **fast-check** (JavaScript) or **Hypothesis** (Python for Node-executed tests) with a minimum of **100 iterations** per property.

Each test must be tagged with a comment:
```
// Feature: expense-budget-visualizer, Property N: <property text>
```

PBT is appropriate here because:
- `validateForm`, `computeBalance`, `computeCategoryTotals`, `getSortedTransactions`, and `validateSpendLimit` are all **pure functions** whose correctness generalizes across a wide input space.
- `localStorage` serialization is a classic **round-trip** scenario.
- The theme toggle is an **idempotence** scenario.
- Input variation in all these functions surfaces edge cases (zero amounts, Unicode names, identical amounts requiring tie-breaking, empty arrays) that example tests would miss.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Consolidation Notes

Before listing final properties, redundant or overlapping candidates are resolved:

- **3.4 + 3.5** (validation correctness + no mutation on failure): Combined into a single "validation correctness" property that covers both the error-detection side and the no-state-change side.
- **5.2 + 5.5** (balance invariant + zero-balance edge case): The empty-array edge case is a natural input for the balance invariant generator; no separate property needed.
- **6.1 + 6.5** (category totals + empty state): Empty array is a generator input for the category totals property.
- **7.1 + 7.2 + 7.5** (serialization, deserialization, round-trip): All consolidated into the single round-trip persistence property (7.5).
- **8.2 + 8.3** (theme toggle + theme persistence): Combined into the theme round-trip property.
- **10.3 + 10.4 + 10.5** (warning on/off + zero-limit edge case): Consolidated into the single warning invariant property; zero-limit is a generator edge case.
- **6.6** (consistent category color): Retained as a standalone idempotence property since it tests a specific lookup function.

After reflection: **10 final properties**.

---

### Property 1: Validation Correctness

*For any* combination of name string, amount string, and category string, `validateForm(name, amount, category)` SHALL return an errors object that contains an entry for exactly those fields that are invalid (empty name, non-positive or non-numeric amount, unrecognized category), and SHALL return an empty object when all fields are valid. A form submission with a non-empty errors object SHALL leave `state.transactions` unchanged.

**Validates: Requirements 3.4, 3.5**

---

### Property 2: Balance Invariant

*For any* array of `Transaction` objects with numeric amounts, `computeBalance(transactions)` SHALL equal the arithmetic sum of all `amount` fields. This holds for empty arrays (result = 0) and for arrays of any length.

**Validates: Requirements 5.2, 5.5**

---

### Property 3: Render Completeness

*For any* non-empty array of `Transaction` objects, after calling `renderTransactionList()`, every transaction's `name`, formatted `amount`, and `category` SHALL be present in the DOM content of `#transactionList`.

**Validates: Requirements 4.1**

---

### Property 4: LocalStorage Round-Trip Persistence

*For any* array of `Transaction` objects, calling `saveTransactions(transactions)` followed immediately by `loadTransactions()` SHALL return an array that is deeply equal to the original (same ids, names, amounts, categories, and createdAt values), regardless of array length or content.

**Validates: Requirements 7.1, 7.2, 7.5**

---

### Property 5: Sort Correctness

*For any* non-empty array of `Transaction` objects and any valid sort key in `{'default', 'amount-asc', 'category-asc'}`, `getSortedTransactions(transactions, sortKey)` SHALL return an array of the same length where adjacent elements satisfy the ordering relation for that sort key, with `createdAt` ascending as a tie-breaker.

**Validates: Requirements 9.2**

---

### Property 6: Sort Non-Mutation

*For any* array of `Transaction` objects and any sort key, calling `getSortedTransactions(transactions, sortKey)` SHALL NOT mutate the original `transactions` array (element order and contents unchanged after the call).

**Validates: Requirements 9.3**

---

### Property 7: Category Totals Correctness

*For any* array of `Transaction` objects, `computeCategoryTotals(transactions)` SHALL return an object where: (a) every key is a category that appears at least once in the input; (b) every value equals the sum of amounts for that category; and (c) no key exists for a category with zero transactions. For an empty input the result SHALL be an empty object.

**Validates: Requirements 6.1, 6.5**

---

### Property 8: Theme Round-Trip

*For any* initial theme value in `{'dark', 'light'}`, setting `state.theme = t`, calling `saveTheme(t)`, and then calling `loadTheme()` SHALL return the same value `t`. Additionally, toggling the theme twice (toggle → toggle) SHALL return the `data-theme` attribute on `<html>` to its original value.

**Validates: Requirements 8.2, 8.3**

---

### Property 9: Warning Invariant

*For any* numeric balance and numeric spend limit, the warning indicator (`#warningBanner`) SHALL be visible if and only if `spendLimit > 0` AND `balance > spendLimit`. When `spendLimit` is `null`, `0`, or negative, the warning SHALL NOT be shown regardless of the balance.

**Validates: Requirements 10.3, 10.4, 10.5**

---

### Property 10: Spend Limit Validation

*For any* input value that is not a positive finite number (including empty string, zero, negative numbers, non-numeric strings, `Infinity`, and `NaN`), `validateSpendLimit(value)` SHALL return a non-null error string. For any strictly positive finite number, it SHALL return `null` (no error). The empty-string / null input case (clearing the limit) SHALL also return `null`.

**Validates: Requirements 10.6**
