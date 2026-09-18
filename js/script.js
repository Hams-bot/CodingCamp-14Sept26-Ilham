/****** CONSTANTS ******/

/** @type {string} LocalStorage key for the transactions array */
const LS_KEY_TRANSACTIONS = 'ebv_transactions';

/** @type {string} LocalStorage key for the active theme */
const LS_KEY_THEME = 'ebv_theme';

/** @type {string} LocalStorage key for the spend limit */
const LS_KEY_SPEND_LIMIT = 'ebv_spend_limit';

/**
 * The three allowed spending categories.
 * @type {string[]}
 */
const CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * A distinct, consistent color assigned to each category for the pie chart.
 * Colors remain the same across all chart updates (Requirement 6.6).
 * @type {{ Food: string, Transport: string, Fun: string }}
 */
const CATEGORY_COLORS = {
  Food: '#e07b54',
  Transport: '#5b9bd5',
  Fun: '#6abf69',
};

/**
 * Valid sort key values used by the Sort_Control and getSortedTransactions.
 * @type {{ DEFAULT: string, AMOUNT_ASC: string, CATEGORY_ASC: string }}
 */
const SORT_OPTIONS = {
  DEFAULT: 'default',
  AMOUNT_ASC: 'amount-asc',
  CATEGORY_ASC: 'category-asc',
};


/****** STATE ******/

/**
 * @typedef {Object} Transaction
 * @property {string} id        — UUID v4 generated at creation time (crypto.randomUUID())
 * @property {string} name      — Non-empty display name (user input, trimmed)
 * @property {number} amount    — Positive float, rounded to 2 decimal places at parse time
 * @property {'Food'|'Transport'|'Fun'} category
 * @property {number} createdAt — Unix timestamp (Date.now()) used for default sort & tie-breaking
 */

/**
 * The single authoritative in-memory state. All DOM and localStorage representations
 * are derived from this object (Requirement 7.1).
 *
 * @type {{
 *   transactions: Transaction[],
 *   spendLimit:   number | null,
 *   theme:        'dark' | 'light',
 *   sortKey:      'default' | 'amount-asc' | 'category-asc'
 * }}
 */
const state = {
  transactions: [],
  spendLimit: null,
  theme: 'dark',
  sortKey: 'default',
};


/****** STORAGE ******/

/**
 * Load transactions from localStorage.
 * Returns an empty array if the key is absent or the stored JSON is malformed.
 * Requirement 7.2, 7.3, 7.4
 *
 * @returns {Transaction[]}
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(LS_KEY_TRANSACTIONS);
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('[EBV] Failed to parse transactions from localStorage:', err);
    return [];
  }
}

/**
 * Persist the current transactions array to localStorage as JSON.
 * Logs a warning if the write fails (e.g. private browsing, storage quota exceeded).
 * Requirement 7.1
 *
 * @param {Transaction[]} transactions
 */
function saveTransactions(transactions) {
  try {
    localStorage.setItem(LS_KEY_TRANSACTIONS, JSON.stringify(transactions));
  } catch (err) {
    console.warn('[EBV] Could not save transactions to localStorage:', err);
  }
}

/**
 * Load the active theme from localStorage.
 * Returns 'dark' if the stored value is missing or not a recognised theme name.
 * Requirement 8.3
 *
 * @returns {'dark' | 'light'}
 */
function loadTheme() {
  try {
    const stored = localStorage.getItem(LS_KEY_THEME);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch (err) {
    console.warn('[EBV] Could not read theme from localStorage:', err);
  }
  return 'dark';
}

/**
 * Persist the active theme to localStorage.
 * Requirement 8.3
 *
 * @param {'dark' | 'light'} theme
 */
function saveTheme(theme) {
  try {
    localStorage.setItem(LS_KEY_THEME, theme);
  } catch (err) {
    console.warn('[EBV] Could not save theme to localStorage:', err);
  }
}

/**
 * Load the spend limit from localStorage.
 * Returns null if the key is absent, the value is NaN, or the value is ≤ 0.
 * Requirement 10.2
 *
 * @returns {number | null}
 */
function loadSpendLimit() {
  try {
    const parsed = parseFloat(localStorage.getItem(LS_KEY_SPEND_LIMIT));
    if (isNaN(parsed) || parsed <= 0) return null;
    return parsed;
  } catch (err) {
    console.warn('[EBV] Could not read spend limit from localStorage:', err);
    return null;
  }
}

/**
 * Persist the spend limit to localStorage.
 * Passing null removes the key entirely (no active limit).
 * Requirement 10.2
 *
 * @param {number | null} limit
 */
function saveSpendLimit(limit) {
  try {
    if (limit === null) {
      localStorage.removeItem(LS_KEY_SPEND_LIMIT);
    } else {
      localStorage.setItem(LS_KEY_SPEND_LIMIT, String(limit));
    }
  } catch (err) {
    console.warn('[EBV] Could not save spend limit to localStorage:', err);
  }
}


/****** VALIDATION ******/

/**
 * Validates the transaction form fields.
 * Returns an errors object whose keys are the invalid field names.
 * An empty object means all fields are valid.
 * Pure function — reads no global state and mutates nothing.
 * Requirements: 3.4, 3.5
 *
 * @param {string} name
 * @param {string|number} amount
 * @param {string} category
 * @returns {{ name?: string, amount?: string, category?: string }}
 */
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

/**
 * Validates a spend limit input value.
 * Returns null when the value is valid (empty/null clears the limit; positive finite number sets it).
 * Returns an error string for any other value (zero, negative, non-numeric, Infinity, NaN).
 * Pure function — reads no global state and mutates nothing.
 * Requirement: 10.6
 *
 * @param {string|null} value
 * @returns {string|null} null = valid; non-null string = error message
 */
function validateSpendLimit(value) {
  if (value === '' || value === null) return null; // clearing the limit is valid
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed <= 0 || !isFinite(parsed)) {
    return 'Spend limit must be a positive number.';
  }
  return null; // null = valid
}

/** Namespace export for testability without type="module" */
const VALIDATION = { validateForm, validateSpendLimit };


/****** COMPUTE ******/

/**
 * Return the sum of all transaction amounts.
 * Returns 0 for an empty array.
 * Requirement 5.2
 *
 * @param {Transaction[]} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Return an object mapping each category to the total amount spent in that category.
 * Categories with no transactions are omitted from the result.
 * Returns {} for an empty array.
 * Requirement 6.1
 *
 * @param {Transaction[]} transactions
 * @returns {{ [category: string]: number }}
 */
function computeCategoryTotals(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}

/**
 * Return a sorted copy of the transactions array for the given sort key.
 * Never mutates the original array (Requirement 9.3).
 * Tie-breaking always uses createdAt ascending.
 * Requirement 9.2
 *
 * @param {Transaction[]} transactions
 * @param {'default' | 'amount-asc' | 'category-asc'} sortKey
 * @returns {Transaction[]}
 */
function getSortedTransactions(transactions, sortKey) {
  const copy = [...transactions];
  if (sortKey === SORT_OPTIONS.AMOUNT_ASC) {
    copy.sort((a, b) => a.amount - b.amount || a.createdAt - b.createdAt);
  } else if (sortKey === SORT_OPTIONS.CATEGORY_ASC) {
    copy.sort((a, b) => a.category.localeCompare(b.category) || a.createdAt - b.createdAt);
  }
  // 'default': insertion order (createdAt ascending) — no sort needed
  return copy;
}

/** Namespace object exposing the three pure compute functions. */
const COMPUTE = { computeBalance, computeCategoryTotals, getSortedTransactions };


/****** RENDER ******/

/**
 * Compute the current balance and display it in the #balanceDisplay element,
 * formatted as USD currency with two decimal places.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
function renderBalance() {
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(computeBalance(state.transactions));
  document.getElementById('balanceDisplay').textContent = formatted;
}

/**
 * Render the transaction list into #transactionList based on the current state.
 * Shows #listEmpty when there are no transactions; always hides #listError in normal flow.
 * Uses the active sortKey so the list reflects the chosen sort order.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
 */
function renderTransactionList() {
  const listEl    = document.getElementById('transactionList');
  const emptyEl   = document.getElementById('listEmpty');
  const errorEl   = document.getElementById('listError');
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  // Always hide the error element in normal flow
  if (errorEl) errorEl.hidden = true;

  const sorted = getSortedTransactions(state.transactions, state.sortKey);

  if (sorted.length === 0) {
    // Show empty state, clear any previous list items
    if (emptyEl) emptyEl.hidden = false;
    listEl.innerHTML = '';
    return;
  }

  // Hide empty state when there are transactions
  if (emptyEl) emptyEl.hidden = true;

  // Build all list items as an HTML string for efficient batch DOM update
  const html = sorted.map((t) => `
    <li class="transaction-item" data-id="${t.id}">
      <span class="tx-name">${t.name}</span>
      <span class="tx-category category--${t.category}">${t.category}</span>
      <span class="tx-amount">${formatter.format(t.amount)}</span>
      <button class="btn-delete" data-id="${t.id}" aria-label="Delete ${t.name}">×</button>
    </li>`).join('');

  listEl.innerHTML = html;
}

/**
 * Show or hide the overspending warning banner and highlight the balance.
 * The warning is active when spendLimit is a positive number AND the current
 * balance exceeds it. A null or non-positive spendLimit means no active limit.
 * Requirements: 10.3, 10.4, 10.5
 */
function renderWarning() {
  const over = state.spendLimit !== null
    && state.spendLimit > 0
    && computeBalance(state.transactions) > state.spendLimit;
  document.getElementById('warningBanner').hidden = !over;
  document.getElementById('balanceDisplay')
    .classList.toggle('balance--over', over);
}

/**
 * Apply the current theme to the <html> element and update the toggle button label.
 * Sets data-theme attribute so CSS custom properties pick up the correct palette.
 * Requirement: 8.2
 */
function renderTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeToggle').textContent =
    state.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
}

/**
 * Perform a full render pass: updates the balance, transaction list, warning banner,
 * and pie chart in sequence. Called after any state mutation.
 * Requirements: 3.6, 4.5, 5.3, 5.4
 */
function renderAll() {
  renderBalance();
  renderTransactionList();
  renderWarning();
  updateChart(computeCategoryTotals(state.transactions));
}


/****** CHART ******/

/**
 * The Chart.js instance. Created once in initChart() and reused for all updates.
 * Null until initChart() runs, or if Chart.js failed to load from CDN.
 * @type {Chart | null}
 */
let chartInstance = null;

/**
 * Base configuration object passed to the Chart constructor.
 * Labels, data, and colors are populated dynamically by updateChart().
 * Requirement 6.1, 6.2, 6.6
 */
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

/**
 * Initialize the Chart.js pie chart on the #spendingChart canvas.
 * Guards against Chart.js CDN load failure.
 * Shows the empty state immediately if there are no transactions.
 * Called once during INIT.
 * Requirements: 6.1, 6.5
 */
function initChart() {
  if (typeof Chart === 'undefined') {
    showChartError();
    return;
  }

  const canvas = document.getElementById('spendingChart');
  chartInstance = new Chart(canvas, CHART_CONFIG);

  if (state.transactions.length === 0) {
    showChartEmpty();
  }
}

/**
 * Update the pie chart with the latest category totals.
 * Mutates the existing Chart instance in place to avoid canvas flickering.
 * Calls showChartEmpty() when there are no categories to display.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * @param {{ [category: string]: number }} categoryTotals
 */
function updateChart(categoryTotals) {
  if (chartInstance === null) return;

  const labels = Object.keys(categoryTotals);

  if (labels.length === 0) {
    showChartEmpty();
    return;
  }

  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data = labels.map((label) => categoryTotals[label]);
  chartInstance.data.datasets[0].backgroundColor = labels.map(
    (label) => CATEGORY_COLORS[label] || '#cccccc'
  );
  chartInstance.update('active');

  // Show canvas, hide empty/error states
  document.getElementById('spendingChart').hidden = false;
  document.getElementById('chartEmpty').hidden = true;
  document.getElementById('chartError').hidden = true;
}

/**
 * Show the empty-state placeholder and hide the canvas and error element.
 * Called when there are no transactions to visualize.
 * Requirement 6.5
 */
function showChartEmpty() {
  document.getElementById('spendingChart').hidden = true;
  document.getElementById('chartEmpty').hidden = false;
  document.getElementById('chartError').hidden = true;
}

/**
 * Show the error fallback element and hide the canvas and empty-state element.
 * Called when Chart.js fails to load from CDN.
 * Requirement 6.1
 */
function showChartError() {
  document.getElementById('spendingChart').hidden = true;
  document.getElementById('chartEmpty').hidden = true;
  document.getElementById('chartError').hidden = false;
}


/****** EVENTS ******/

/**
 * 8.1 — Transaction form submit handler.
 * Validates all fields, builds a Transaction object on success, persists it,
 * re-renders, resets the form, and returns focus to the name field.
 * Requirements: 3.4, 3.5, 3.6, 3.7
 */
document.getElementById('transactionForm').addEventListener('submit', function (event) {
  event.preventDefault();

  const nameInput     = document.getElementById('itemName');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');

  const nameValue     = nameInput.value;
  const amountValue   = amountInput.value;
  const categoryValue = categoryInput.value;

  // Clear previous inline errors before re-validating
  document.getElementById('itemNameError').textContent = '';
  document.getElementById('amountError').textContent   = '';
  document.getElementById('categoryError').textContent = '';

  const errors = validateForm(nameValue, amountValue, categoryValue);

  if (Object.keys(errors).length > 0) {
    if (errors.name)     document.getElementById('itemNameError').textContent = errors.name;
    if (errors.amount)   document.getElementById('amountError').textContent   = errors.amount;
    if (errors.category) document.getElementById('categoryError').textContent = errors.category;
    return;
  }

  // Build the new Transaction
  const id = (typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

  /** @type {Transaction} */
  const transaction = {
    id,
    name:      nameValue.trim(),
    amount:    parseFloat(parseFloat(amountValue).toFixed(2)),
    category:  categoryValue,
    createdAt: Date.now(),
  };

  state.transactions.push(transaction);
  saveTransactions(state.transactions);
  renderAll();

  // Reset form fields and return focus to name input
  nameInput.value     = '';
  amountInput.value   = '';
  categoryInput.value = '';
  nameInput.focus();
});

/**
 * 8.2 — Transaction delete handler (event delegation).
 * A single listener on the list container catches clicks from any delete button.
 * Requirements: 4.4, 4.5
 */
document.getElementById('transactionList').addEventListener('click', function (event) {
  const btn = event.target.closest('.btn-delete');
  if (!btn) return;

  const id = btn.dataset.id;
  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveTransactions(state.transactions);
  renderAll();
});

/**
 * 8.3 — Theme toggle handler.
 * Flips state.theme between 'dark' and 'light', persists, and re-renders.
 * Requirements: 8.2, 8.3
 */
document.getElementById('themeToggle').addEventListener('click', function () {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveTheme(state.theme);
  renderTheme();
});

/**
 * 8.4 — Sort control handler.
 * Updates state.sortKey to the selected value and re-renders the list.
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */
document.getElementById('sortSelect').addEventListener('change', function (event) {
  state.sortKey = event.target.value;
  renderTransactionList();
});

/**
 * 8.5 — Spend limit set handler.
 * Validates the input; on success updates state, persists, and re-renders the warning.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
document.getElementById('setLimitBtn').addEventListener('click', function () {
  const spendLimitInput = document.getElementById('spendLimit');
  const errorEl         = document.getElementById('spendLimitError');
  const value           = spendLimitInput.value;

  const errorMsg = validateSpendLimit(value);

  if (errorMsg !== null) {
    errorEl.textContent = errorMsg;
    return;
  }

  // Empty / null clears the limit; any positive number sets it
  state.spendLimit = (value === '' || value === null) ? null : parseFloat(value);
  errorEl.textContent = '';
  saveSpendLimit(state.spendLimit);
  renderWarning();
});

/**
 * 8.5 — Spend limit clear handler.
 * Resets the active limit, clears the input and any error, and re-renders the warning.
 * Requirements: 10.4, 10.5
 */
document.getElementById('clearLimitBtn').addEventListener('click', function () {
  state.spendLimit = null;
  saveSpendLimit(null);
  document.getElementById('spendLimit').value      = '';
  document.getElementById('spendLimitError').textContent = '';
  renderWarning();
});


/****** INIT ******/

/**
 * Bootstrap the application.
 * Restores persisted state from localStorage, applies the saved theme before
 * any rendering occurs to prevent a flash of unstyled content, initialises the
 * Chart.js instance, then performs a full render pass.
 * Requirements: 4.3, 7.2, 7.3, 7.4, 8.4
 */
function init() {
  state.transactions = loadTransactions();
  state.theme        = loadTheme();
  state.spendLimit   = loadSpendLimit();

  // Restore the spend limit input field to the persisted value
  if (state.spendLimit !== null) {
    document.getElementById('spendLimit').value = state.spendLimit;
  }

  renderTheme();
  initChart();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
