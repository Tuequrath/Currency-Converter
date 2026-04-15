// ==UserScript==
// @name         Currency Converter (Selection Tooltip)
// @namespace    https://github.com/Tuequrath/Currency-Converter
// @version      1.3.0
// @description  Converts selected monetary amounts to a user-selected target currency.
// @author       YOUR_NAME
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      open.er-api.com
// @updateURL    https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js
// @downloadURL  https://raw.githubusercontent.com/Tuequrath/Currency-Converter/main/currency-converter.user.js
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULT_TARGET_CURRENCY = 'USD';
    const TARGET_CURRENCY_STORAGE_KEY = 'target_currency';
    const MAX_SELECTION_LENGTH = 120;

    const SUPPORTED_TARGET_CURRENCIES = Object.freeze([
        'USD', 'EUR', 'UAH', 'PLN', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'
    ]);

    // Tokens include both code-like values and common symbols.
    const CURRENCY_ALIASES = Object.freeze({
        USD: ['usd', '$', 'us$'],
        EUR: ['eur', 'в‚¬'],
        UAH: ['uah', 'в‚ґ', 'РіСЂРЅ'],
        PLN: ['pln', 'zЕ‚', 'zl'],
        GBP: ['gbp', 'ВЈ'],
        JPY: ['jpy', 'ВҐ'],
        CAD: ['cad', 'c$'],
        AUD: ['aud', 'a$'],
        CHF: ['chf']
    });

    const TOKEN_TO_CODE = Object.freeze(buildTokenToCodeMap(CURRENCY_ALIASES));
    const CURRENCY_REGEX = buildCurrencyRegex(Object.keys(TOKEN_TO_CODE));

    let targetCurrency = loadTargetCurrency();
    let tooltipElement = null;
    let ratesCache = null;

    registerMenuCommands();

    window.addEventListener('mouseup', () => {
        void handleSelection();
    });
    document.addEventListener('mousedown', (event) => {
        if (tooltipElement && event.target !== tooltipElement) {
            hideTooltip();
        }
    });
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            hideTooltip();
        }
    });
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('blur', hideTooltip);

    function buildTokenToCodeMap(aliases) {
        const map = {};
        Object.entries(aliases).forEach(([code, tokens]) => {
            tokens.forEach((token) => {
                map[token.toLowerCase()] = code;
            });
        });
        return map;
    }

    function buildCurrencyRegex(tokens) {
        const sortedTokens = tokens
            .map(escapeRegex)
            .sort((a, b) => b.length - a.length);
        const tokenPattern = sortedTokens.join('|');
        const numberPattern = '[+-]?\\d[\\d\\s.,\\u00A0\\u202F]*';
        return new RegExp(
            `(?:(${tokenPattern})\\s*(${numberPattern}))|(?:(${numberPattern})\\s*(${tokenPattern}))`,
            'i'
        );
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function loadTargetCurrency() {
        const saved = String(GM_getValue(TARGET_CURRENCY_STORAGE_KEY, DEFAULT_TARGET_CURRENCY)).toUpperCase();
        return SUPPORTED_TARGET_CURRENCIES.includes(saved) ? saved : DEFAULT_TARGET_CURRENCY;
    }

    function registerMenuCommands() {
        GM_registerMenuCommand('Set target currency', () => {
            const current = targetCurrency;
            const supportedList = SUPPORTED_TARGET_CURRENCIES.join(', ');
            const newValue = prompt(
                `Enter target currency code.\nSupported: ${supportedList}\nCurrent: ${current}`,
                current
            );
            if (newValue === null) {
                return;
            }

            const normalized = newValue.trim().toUpperCase();
            if (!SUPPORTED_TARGET_CURRENCIES.includes(normalized)) {
                alert(`Unsupported currency code: ${normalized}\nSupported: ${supportedList}`);
                return;
            }

            GM_setValue(TARGET_CURRENCY_STORAGE_KEY, normalized);
            targetCurrency = normalized;
            alert(`Target currency saved: ${normalized}`);
        });

        GM_registerMenuCommand('Show current target currency', () => {
            alert(`Current target currency: ${targetCurrency}`);
        });
    }

    async function handleSelection() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            hideTooltip();
            return;
        }

        const text = selection.toString().trim();
        if (!text || text.length > MAX_SELECTION_LENGTH) {
            hideTooltip();
            return;
        }

        const detected = detectCurrency(text);
        if (!detected) {
            hideTooltip();
            return;
        }

        const rates = await getRates();
        if (!rates || !rates[detected.currency] || !rates[targetCurrency]) {
            hideTooltip();
            return;
        }

        const converted = convertAmount(detected.value, detected.currency, targetCurrency, rates);
        if (converted === null) {
            hideTooltip();
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            hideTooltip();
            return;
        }

        const originalText = formatAmount(detected.value, detected.currency);
        const convertedText = formatAmount(converted, targetCurrency);
        showTooltip(`${originalText} в‰€ ${convertedText}`, rect);
    }

    function detectCurrency(text) {
        const match = text.match(CURRENCY_REGEX);
        if (!match) {
            return null;
        }

        const rawToken = (match[1] || match[4] || '').toLowerCase();
        const rawAmount = (match[2] || match[3] || '').trim();

        const currency = TOKEN_TO_CODE[rawToken];
        const amount = parseLocalizedNumber(rawAmount);
        if (!currency || amount === null) {
            return null;
        }

        return { value: amount, currency };
    }

    function parseLocalizedNumber(input) {
        let value = input.replace(/[\s\u00A0\u202F]/g, '');
        if (!value) {
            return null;
        }

        const hasComma = value.includes(',');
        const hasDot = value.includes('.');

        if (hasComma && hasDot) {
            if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
                value = value.replace(/\./g, '').replace(',', '.');
            } else {
                value = value.replace(/,/g, '');
            }
        } else if (hasComma) {
            const parts = value.split(',');
            if (parts.length === 2 && parts[1].length <= 2) {
                value = `${parts[0].replace(/,/g, '')}.${parts[1]}`;
            } else {
                value = value.replace(/,/g, '');
            }
        } else if (hasDot) {
            const parts = value.split('.');
            if (!(parts.length === 2 && parts[1].length <= 2)) {
                value = value.replace(/\./g, '');
            }
        }

        if (!/^[+-]?\d+(\.\d+)?$/.test(value)) {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function convertAmount(value, fromCurrency, toCurrency, rates) {
        if (!Number.isFinite(value)) {
            return null;
        }
        if (fromCurrency === toCurrency) {
            return value;
        }

        const fromRate = rates[fromCurrency];
        const toRate = rates[toCurrency];
        if (!fromRate || !toRate) {
            return null;
        }

        const valueInUsd = fromCurrency === 'USD' ? value : value / fromRate;
        return toCurrency === 'USD' ? valueInUsd : valueInUsd * toRate;
    }

    function formatAmount(value, currency) {
        const formatter = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${formatter.format(value)} ${currency}`;
    }

    function getRates() {
        return new Promise((resolve) => {
            if (ratesCache) {
                resolve(ratesCache);
                return;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://open.er-api.com/v6/latest/USD',
                onload: (response) => {
                    if (response.status < 200 || response.status >= 300) {
                        resolve(null);
                        return;
                    }

                    try {
                        const payload = JSON.parse(response.responseText);
                        if (!payload || !payload.rates) {
                            resolve(null);
                            return;
                        }
                        ratesCache = payload.rates;
                        resolve(ratesCache);
                    } catch (error) {
                        console.error('[Currency Converter] Failed to parse exchange rates', error);
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    function showTooltip(text, rect) {
        if (!tooltipElement) {
            tooltipElement = createTooltip();
            document.body.appendChild(tooltipElement);
        }

        tooltipElement.textContent = text;
        tooltipElement.style.display = 'block';
        tooltipElement.style.opacity = '1';

        const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        const viewportPadding = 8;

        const rawX = rect.left + scrollX + rect.width / 2 - tooltipElement.offsetWidth / 2;
        const minX = scrollX + viewportPadding;
        const maxX = scrollX + document.documentElement.clientWidth - tooltipElement.offsetWidth - viewportPadding;
        const clampedX = Math.max(minX, Math.min(rawX, maxX));

        let y = rect.top + scrollY - tooltipElement.offsetHeight - 10;
        if (y < scrollY + viewportPadding) {
            y = rect.bottom + scrollY + 10;
        }

        tooltipElement.style.left = `${clampedX}px`;
        tooltipElement.style.top = `${y}px`;
    }

    function createTooltip() {
        const element = document.createElement('div');
        Object.assign(element.style, {
            position: 'absolute',
            background: 'rgba(30, 30, 30, 0.92)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            zIndex: '2147483647',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(4px)',
            transition: 'opacity 0.12s ease',
            opacity: '0',
            display: 'none'
        });
        return element;
    }

    function hideTooltip() {
        if (!tooltipElement) {
            return;
        }
        tooltipElement.style.opacity = '0';
        setTimeout(() => {
            if (tooltipElement && tooltipElement.style.opacity === '0') {
                tooltipElement.style.display = 'none';
            }
        }, 120);
    }
})();

