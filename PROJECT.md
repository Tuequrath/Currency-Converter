# Currency Converter Userscript - Technical Documentation

## 1. Overview

This project implements a browser userscript for Tampermonkey-compatible extensions.
When a user selects text containing a monetary value with currency marker (for example, `$120`, `120 EUR`, `3 500 UAH`), the script:

1. Detects currency and numeric value from the selection.
2. Loads exchange rates from `https://open.er-api.com/v6/latest/USD`.
3. Converts to a user-configured target currency.
4. Shows the result in a tooltip near the selected text.

The target currency is configurable and persisted in userscript storage.

## 2. Code Review Summary (Revision Notes)

The original prototype version was a solid base but had practical issues:

1. Encoding artifacts in comments and symbol literals.
2. Limited parser behavior for localized number formats.
3. No persistent user setting for preferred target currency.
4. No cache expiration policy for exchange rates.
5. Incomplete safety checks around text selection/range handling.
6. Tooltip positioning could move outside visible viewport.

The revised implementation addresses each of these points.

## 3. Main Components

### 3.1 Script Metadata

`currency-converter.user.js` includes Tampermonkey metadata:

- Grants:
  - `GM_xmlhttpRequest`
  - `GM_getValue`
  - `GM_setValue`
  - `GM_registerMenuCommand`
- Network permission:
  - `@connect open.er-api.com`
- GitHub auto-update template:
  - `@updateURL https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js`
  - `@downloadURL https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js`

This provides a reusable installation/update template through a GitHub repository.

### 3.2 Persistent User Configuration

The script stores target currency with:

- Key: `target_currency`
- API:
  - `GM_getValue(...)` for load
  - `GM_setValue(...)` for save
- Default value: `USD`

Tampermonkey menu commands:

1. `Set target currency` - prompt-based setting update.
2. `Show current target currency` - quick check of current value.

Supported values are validated against a fixed allow-list:
`USD`, `EUR`, `UAH`, `PLN`, `GBP`, `JPY`, `CAD`, `AUD`, `CHF`.

### 3.3 Currency Detection and Parsing

Detection logic uses:

1. Currency alias map (ISO codes and common symbols, for example USD, EUR, UAH, PLN, and `$`).
2. Generated regular expression for patterns:
   - `<currency> <number>`
   - `<number> <currency>`
3. Normalization function for localized numbers:
   - removes spaces (including non-breaking spaces),
   - resolves comma/dot decimal separator heuristically,
   - rejects invalid numeric strings safely.

This improves reliability across common regional number formats.

### 3.4 Exchange Rate Layer

Rates are fetched from:
`https://open.er-api.com/v6/latest/USD`

Implementation characteristics:

1. In-memory session cache (`ratesCache`).
2. Rate request is executed once per page context, then reused until page reload.
3. Basic HTTP status validation and JSON parse safety.
4. Graceful failure behavior (no hard UI crash if request fails).

### 3.5 Conversion Logic

Rates are USD-based, so conversion follows:

1. Convert source amount to USD.
2. Convert USD to selected target currency.

If source and target are the same, value is returned unchanged.

### 3.6 Tooltip UI

UI behavior:

1. Lazy-created tooltip element appended to `document.body`.
2. Absolute positioning near the selected text range.
3. Horizontal clamping to viewport boundaries.
4. Automatic fallback below selection if no space above.
5. Hide triggers:
   - mouse click outside tooltip context,
   - selection collapse,
   - page scroll,
   - window blur.

## 4. Git/GitHub Installation Template

### 4.1 Repository Setup

```bash
git init
git add .
git commit -m "Initial userscript commit"
git branch -M main
git remote add origin https://github.com/Tuequrath/Currency-Converter.git
git push -u origin main
```

### 4.2 Metadata Setup

Current metadata is configured for:

- GitHub user: `Tuequrath`
- Repository: `Currency-Converter`
- Author: set `@author` to your name or alias.

### 4.3 Installation URL

Install script in Tampermonkey from:

`https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js`

With `@updateURL`/`@downloadURL` configured, updates can be delivered from GitHub automatically.

## 5. Files

1. `currency-converter.user.js` - production userscript.
2. `README.md` - quick usage/installation notes.
3. `PROJECT.md` - detailed technical documentation.

## 6. Notes for Further Extension

Potential next technical improvements:

1. Add debounce for selection handling on dynamic pages.
2. Expand currency alias dictionary.
3. Add optional fixed decimal precision setting in menu.
4. Add optional API fallback provider for higher availability.

