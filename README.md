# Currency Converter Userscript

Tampermonkey/Violentmonkey userscript that converts selected prices into your preferred target currency.

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/Tuequrath/Currency-Converter.git
   ```
2. Open `currency-converter.user.js` and (optionally) update:
   - `@author`
3. Push to GitHub.
4. Install from the raw URL in your userscript manager:
   [https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js](https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js)

## User Setting

Use Tampermonkey menu commands:
- `Set target currency`
- `Toggle input/textarea selection support`

Supported target currencies: `USD`, `EUR`, `UAH`, `PLN`, `GBP`, `JPY`, `CAD`, `AUD`, `CHF`.

## Selection Behavior

- Searching window is set to `40` characters.
- Input/textarea selection support is enabled by default and can be switched ON/OFF from the Tampermonkey menu.
- This setting is persisted in userscript storage.

## Details

See `PROJECT.md` for technical architecture and implementation details.
