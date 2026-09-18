# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application built with pure HTML, CSS, and Vanilla JavaScript. It allows users to track personal expenses by entering transactions with a name, amount, and category. The app persists data in the browser's LocalStorage, displays a live total balance, and visualizes spending distribution through a pie chart powered by Chart.js (loaded via CDN). Additional features include a dark/light mode toggle, sorting controls, and a configurable overspending warning. The entire application is delivered as a single HTML file, one CSS file, and one JavaScript file with no backend or build tooling.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense record consisting of a name, a numeric amount, and a category.
- **Category**: One of three predefined spending labels: Food, Transport, or Fun.
- **Balance**: The running total of all transaction amounts currently stored.
- **Chart**: The pie chart rendered by Chart.js representing spending per category.
- **LocalStorage**: The browser's built-in client-side key-value storage API used for data persistence.
- **Spend_Limit**: A user-configurable numeric threshold above which spending is considered over-budget.
- **Transaction_List**: The scrollable UI region that displays all stored transactions.
- **Input_Form**: The UI region containing fields and a submit button for adding a new transaction.
- **Theme_Toggle**: The UI control that switches the app between dark and light display modes.
- **Sort_Control**: The UI control that reorders the Transaction_List by a chosen criterion.
- **Validator**: The client-side logic that checks field values before a transaction is submitted.

---

## Requirements

### Requirement 1: Project Structure and Technology Constraints

**User Story:** As a developer, I want a strictly scoped file structure, so that the project remains maintainable and free from framework dependencies.

#### Acceptance Criteria

1. THE App SHALL be delivered as exactly three files: `index.html`, `css/style.css`, and `js/script.js`.
2. THE App SHALL load Chart.js exclusively from a public CDN `<script>` tag declared in `index.html` and SHALL NOT bundle or download it locally.
3. THE App SHALL use only HTML, CSS, and Vanilla JavaScript with no external frameworks (React, Vue, Angular, or equivalent).
4. THE App SHALL require no backend server, build step, or package manager to run.
5. WHEN opened in a modern browser (Chrome, Firefox, Safari, Edge — latest two major versions), THE App SHALL render and operate correctly without errors.

---

### Requirement 2: Responsive and Accessible Layout

**User Story:** As a user on any device, I want the app to display correctly on both mobile and desktop screens, so that I can track expenses anywhere.

#### Acceptance Criteria

1. THE App SHALL use a responsive layout that adapts to viewport widths from 320 px to 1920 px without horizontal scrolling.
2. THE App SHALL render all interactive controls at a minimum touch target size of 44 × 44 CSS pixels on mobile viewports (width ≤ 768 px).
3. THE App SHALL complete any UI update (add, delete, sort, theme switch) within 100 ms of the triggering user action as measured by the browser's rendering pipeline.
4. THE App SHALL present a clean, minimal visual design with consistent spacing, typography, and color contrast meeting WCAG AA contrast ratio (4.5:1 for normal text).

---

### Requirement 3: Transaction Input Form

**User Story:** As a user, I want to enter a transaction's name, amount, and category, so that I can record what I spent money on.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for the transaction name, a numeric field for the amount, and a dropdown selector for the category.
2. THE Input_Form's category dropdown SHALL offer exactly three options: Food, Transport, and Fun.
3. THE Input_Form SHALL contain a submit button labeled "Add Transaction" (or equivalent clear label).
4. WHEN the submit button is activated, THE Validator SHALL check that the name field is non-empty, the amount field contains a positive number greater than zero, and a category is selected.
5. IF any field fails validation, THEN THE Validator SHALL display an inline error message identifying the invalid field and SHALL NOT create a new Transaction.
6. WHEN all fields pass validation, THE Input_Form SHALL create a new Transaction, persist it to LocalStorage, update the Balance, refresh the Transaction_List, and update the Chart.
7. WHEN a Transaction is successfully added, THE Input_Form SHALL clear all fields and return focus to the name field.

---

### Requirement 4: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored Transaction showing its name, amount (formatted as currency with two decimal places), and category.
2. THE Transaction_List SHALL be scrollable when the number of Transactions exceeds the visible area, without affecting the layout of other UI regions.
3. WHEN the app loads, THE Transaction_List SHALL render all Transactions previously persisted in LocalStorage.
4. THE Transaction_List SHALL display each Transaction with a clearly visible delete button.
5. WHEN a delete button is activated for a Transaction, THE App SHALL remove that Transaction from LocalStorage, remove it from the Transaction_List, update the Balance, and update the Chart.
6. WHEN no Transactions exist, THE Transaction_List SHALL display an empty-state message (e.g., "No transactions yet.").

---

### Requirement 5: Total Balance Display

**User Story:** As a user, I want to see my current total spending at a glance, so that I know how much I have spent overall.

#### Acceptance Criteria

1. THE App SHALL display the Balance prominently at the top of the page.
2. THE Balance SHALL equal the sum of all stored Transaction amounts, formatted as currency with two decimal places.
3. WHEN a Transaction is added, THE Balance SHALL update to reflect the new total within 100 ms.
4. WHEN a Transaction is deleted, THE Balance SHALL update to reflect the new total within 100 ms.
5. WHEN no Transactions exist, THE Balance SHALL display as zero (e.g., "0.00").

---

### Requirement 6: Pie Chart Visualization

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money goes.

#### Acceptance Criteria

1. THE Chart SHALL be rendered using Chart.js loaded from CDN and SHALL display spending as a pie chart with one slice per Category that has at least one Transaction.
2. THE Chart SHALL label each slice with the Category name and its total amount or percentage.
3. WHEN a Transaction is added, THE Chart SHALL update to reflect the new category totals within 100 ms.
4. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the revised category totals within 100 ms.
5. WHEN no Transactions exist, THE Chart SHALL display an empty or placeholder state (e.g., a single neutral-colored full circle or a "No data" label).
6. THE Chart SHALL assign a distinct, consistent color to each Category (Food, Transport, Fun) that remains the same across updates.

---

### Requirement 7: LocalStorage Persistence

**User Story:** As a user, I want my transactions to survive page reloads, so that I do not lose my data when I close or refresh the browser.

#### Acceptance Criteria

1. THE App SHALL serialize all Transactions as JSON and store them in LocalStorage under a defined key on every add or delete operation.
2. WHEN the App loads, THE App SHALL deserialize Transactions from LocalStorage and restore the Transaction_List, Balance, and Chart to the state matching the stored data.
3. IF LocalStorage contains no data for the App's key, THEN THE App SHALL initialize with an empty Transaction_List, a zero Balance, and an empty Chart without throwing an error.
4. IF LocalStorage data is malformed or cannot be parsed, THEN THE App SHALL fall back to an empty initial state and SHALL log a descriptive error message to the browser console.
5. FOR ALL sequences of add and delete operations followed by a page reload, THE App SHALL restore the Transaction_List to the same set of Transactions that existed before the reload (round-trip persistence property).

---

### Requirement 8: Dark / Light Mode Toggle

**User Story:** As a user, I want to switch between a dark and a light theme, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL display a Theme_Toggle control (button or switch) accessible on all viewport sizes.
2. WHEN the Theme_Toggle is activated, THE App SHALL switch the active theme between dark and light mode.
3. THE App SHALL persist the user's last selected theme in LocalStorage so that the same theme is applied on the next page load.
4. WHEN the page loads, THE App SHALL apply the persisted theme before the first paint to prevent a flash of the wrong theme.
5. WHILE dark mode is active, THE App SHALL apply a dark background with light text meeting WCAG AA contrast ratio (4.5:1).
6. WHILE light mode is active, THE App SHALL apply a light background with dark text meeting WCAG AA contrast ratio (4.5:1).

---

### Requirement 9: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can quickly find or compare entries.

#### Acceptance Criteria

1. THE Sort_Control SHALL offer at minimum three sort options: "Default (Date Added)", "Amount: Low to High", and "Category (A–Z)".
2. WHEN a sort option is selected, THE Transaction_List SHALL re-render in the chosen order within 100 ms.
3. THE Sort_Control SHALL NOT modify the underlying stored order of Transactions in LocalStorage; sorting SHALL be a display-only operation.
4. WHEN a new Transaction is added while a non-default sort is active, THE Transaction_List SHALL re-sort to include the new Transaction in the correct position for the active sort option.
5. WHEN a Transaction is deleted while a non-default sort is active, THE Transaction_List SHALL re-sort the remaining Transactions maintaining the active sort option.

---

### Requirement 10: Overspending Warning

**User Story:** As a user, I want to set a spending limit and receive a visual warning when I exceed it, so that I stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide an input field or control where the user can set a numeric Spend_Limit greater than zero.
2. THE App SHALL persist the Spend_Limit in LocalStorage so it is restored on page load.
3. WHILE the Balance exceeds the Spend_Limit, THE App SHALL display a visible warning indicator (e.g., highlighted balance, warning banner, or color change) that is distinct from the normal display state.
4. WHEN the Balance drops to or below the Spend_Limit (due to a deletion), THE App SHALL remove the warning indicator.
5. WHEN the Spend_Limit field is empty or set to zero, THE App SHALL treat no limit as active and SHALL NOT display the warning indicator regardless of the Balance.
6. IF a non-numeric or negative value is entered as the Spend_Limit, THEN THE App SHALL display an inline validation error and SHALL NOT update the active Spend_Limit.
