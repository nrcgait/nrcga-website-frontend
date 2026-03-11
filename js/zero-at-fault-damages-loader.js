// Zero At-Fault Damages list loader
// Loads company list from a single CSV: assets/zeroatfaultlists/zerodamages.csv

const ZERO_DAMAGES_LIST_CONTAINER_ID = 'zero-damages-list';
const CSV_PATH = 'assets/zerodamages.csv';

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
 * @param {Array<{company?: string}>} rows - Parsed CSV rows
 */
function renderCompanies(rows) {
    const container = document.getElementById(ZERO_DAMAGES_LIST_CONTAINER_ID);
    if (!container) return;

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
 * Load the single CSV and render the company list.
 */
async function loadZeroDamagesList() {
    const container = document.getElementById(ZERO_DAMAGES_LIST_CONTAINER_ID);
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; color: var(--text-light);">Loading…</p>';

    try {
        const rows = await loadCSV(CSV_PATH);
        renderCompanies(rows);
    } catch (err) {
        console.error('Error loading zero damages list:', err);
        container.innerHTML = '<p style="text-align:center; color: var(--text-light);">Unable to load the list. Please try again later.</p>';
    }
}

/**
 * Initialize the Zero At-Fault Damages list (call on DOMContentLoaded or when script runs).
 */
async function initZeroAtFaultDamagesList() {
    const container = document.getElementById(ZERO_DAMAGES_LIST_CONTAINER_ID);
    if (!container) return;

    await loadZeroDamagesList();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZeroAtFaultDamagesList);
} else {
    initZeroAtFaultDamagesList();
}

