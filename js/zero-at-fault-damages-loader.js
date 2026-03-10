// Zero At-Fault Damages list loader
// Loads company list from assets/zeroatfaultlists/zerodamages{YEAR}.csv using shared csv-parser

const ZERO_DAMAGES_LIST_CONTAINER_ID = 'zero-damages-list';
const ZERO_DAMAGES_YEAR_HEADING_ID = 'zero-damages-year-heading';
const ZERO_DAMAGES_YEAR_SELECT_ID = 'zero-damages-year-select';
const CSV_BASE_PATH = 'assets/zeroatfaultlists/zerodamages';

// Years that have a zerodamages{YEAR}.csv file. Add new years when new CSVs are added.
const AVAILABLE_YEARS = [2024];

const CARD_STYLE = 'padding: 1rem; background: var(--bg-light); border-radius: 8px; text-align: center;';

/**
 * Escape text for safe use in HTML text content.
 */
function escapeHtml(text) {
    if (text == null) return '';
    const s = String(text);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Render company cards into the list container.
 * @param {Array<{year?: string, company?: string}>} rows - Parsed CSV rows
 * @param {number} year - Year label for heading
 */
function renderCompanies(rows, year) {
    const container = document.getElementById(ZERO_DAMAGES_LIST_CONTAINER_ID);
    const headingEl = document.getElementById(ZERO_DAMAGES_YEAR_HEADING_ID);
    if (!container) return;

    if (headingEl) {
        headingEl.textContent = 'Zero At-Fault Damages – ' + year;
    }

    const companies = rows.filter(r => {
        const company = r.company ?? r['company\r'] ?? '';
        return company && String(company).trim();
    });
    if (companies.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-light);">No companies listed for this year.</p>';
        return;
    }

    container.innerHTML = companies
        .map(row => {
            const raw = row.company ?? row['company\r'] ?? '';
            const name = escapeHtml(String(raw).trim());
            return '<div style="' + CARD_STYLE + '">' + name + '</div>';
        })
        .join('');
}

/**
 * Load CSV for the given year and render the list.
 * @param {number} year - Year (e.g. 2024)
 */
async function loadYear(year) {
    const container = document.getElementById(ZERO_DAMAGES_LIST_CONTAINER_ID);
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; color: var(--text-light);">Loading…</p>';

    const csvPath = CSV_BASE_PATH + year + '.csv';
    try {
        const rows = await loadCSV(csvPath);
        const forYear = rows.filter(r => String(r.year || '').trim() === String(year));
        const toShow = forYear.length > 0 ? forYear : rows;
        renderCompanies(toShow, year);
    } catch (err) {
        console.error('Error loading zero damages list:', err);
        container.innerHTML = '<p style="text-align:center; color: var(--text-light);">Unable to load the list for ' + year + '. Please try again later.</p>';
    }
}

/**
 * Initialize year selector dropdown and load default year.
 */
function initYearSelector() {
    const selectEl = document.getElementById(ZERO_DAMAGES_YEAR_SELECT_ID);
    if (!selectEl || AVAILABLE_YEARS.length === 0) return;

    selectEl.innerHTML = AVAILABLE_YEARS
        .map(y => '<option value="' + y + '"' + (y === AVAILABLE_YEARS[0] ? ' selected' : '') + '>' + y + '</option>')
        .join('');

    selectEl.addEventListener('change', () => {
        loadYear(parseInt(selectEl.value, 10));
    });
}

/**
 * Initialize the Zero At-Fault Damages list (call on DOMContentLoaded or when script runs).
 */
async function initZeroAtFaultDamagesList() {
    const container = document.getElementById(ZERO_DAMAGES_LIST_CONTAINER_ID);
    if (!container) return;

    initYearSelector();
    const defaultYear = AVAILABLE_YEARS.length ? AVAILABLE_YEARS[0] : 2024;
    await loadYear(defaultYear);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZeroAtFaultDamagesList);
} else {
    initZeroAtFaultDamagesList();
}
