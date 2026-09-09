// Navigation Component
// Reads configuration from nav-config.js

try {
    const storedTextSize = localStorage.getItem('textSize');
    const initialTextSize = ['sm', 'md', 'lg', 'xl'].includes(storedTextSize) ? storedTextSize : 'md';
    document.documentElement.setAttribute('data-text-size', initialTextSize);
} catch {
    document.documentElement.setAttribute('data-text-size', 'md');
}

function isStagingHost(host) {
    return (
        host === 'nrcga-website-staging.pages.dev' ||
        host.endsWith('.nrcga-website-staging.pages.dev') ||
        host === 'nrcga.ayowerks.com' ||
        host === 'ayowerks.com' ||
        host.endsWith('.ayowerks.com')
    );
}

function getStaffPortalUrl() {
    if (window.NRCGA_API && window.NRCGA_API.staffPortalUrl) {
        return window.NRCGA_API.staffPortalUrl;
    }
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:8787/admin';
    }
    if (isStagingHost(host)) {
        return 'https://nrcga-api-staging.nrcga-it.workers.dev/admin';
    }
    return 'https://api.nrcga.org/admin';
}

function renderStaffPortalLink() {
    const staffUrl = getStaffPortalUrl();
    return `
        <a href="${staffUrl}" class="staff-portal-link" aria-label="Staff portal" title="Staff portal">
            <svg class="staff-portal-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5"></circle>
                <path d="M5.5 20.5c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6"></path>
            </svg>
        </a>
    `;
}

function renderNavigation() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Use navConfig from nav-config.js (must be loaded before this file)
    if (typeof navConfig === 'undefined') {
        console.error('navConfig not found. Make sure nav-config.js is loaded before components.js');
        return '<nav class="navbar"><div class="nav-container"><p>Navigation configuration error</p></div></nav>';
    }
    
    // Build logo HTML
    const logo = navConfig.logo;
    const logoHTML = `
        <div class="logo">
            <a href="${logo.link}" class="logo-link">
                <img src="${logo.image}" alt="${logo.alt}" class="logo-img">
                <span class="logo-text">${logo.text}</span>
            </a>
        </div>
    `;
    
    // Build menu items HTML
    let menuItemsHTML = '';
    navConfig.menuItems.forEach(item => {
        if (item.type === 'dropdown') {
            // Build dropdown menu
            let dropdownItemsHTML = '';
            item.items.forEach(subItem => {
                const external = subItem.external ? ' target="_blank" rel="noopener noreferrer"' : '';
                dropdownItemsHTML += `<li><a href="${subItem.href}"${external}>${subItem.text}</a></li>`;
            });
            
            menuItemsHTML += `
                <li class="nav-dropdown">
                    <a href="${item.href}" class="dropdown-toggle">${item.text} <span class="dropdown-arrow">▼</span></a>
                    <ul class="dropdown-menu">
                        ${dropdownItemsHTML}
                    </ul>
                </li>
            `;
        } else if (item.type === 'link') {
            // Build simple link
            const activeClass = currentPage === item.href.split('/').pop() ? 'class="active"' : '';
            menuItemsHTML += `<li><a href="${item.href}" ${activeClass}>${item.text}</a></li>`;
        }
    });
    
    return `
        <nav class="navbar">
            <div class="nav-container">
                ${logoHTML}
                <ul class="nav-menu">
                    ${menuItemsHTML}
                </ul>
                <div class="nav-actions">
                    ${renderStaffPortalLink()}
                    <div class="display-settings">
                        <button type="button" class="display-settings-toggle" aria-label="Display settings" title="Display settings" aria-haspopup="true" aria-expanded="false" aria-controls="display-settings-menu">
                            <svg class="display-settings-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                        <div id="display-settings-menu" class="display-settings-menu" hidden>
                            <p class="display-settings-heading">Appearance</p>
                            <div class="display-settings-row" role="group" aria-label="Appearance">
                                <button type="button" class="display-settings-option" data-theme-value="light">Light</button>
                                <button type="button" class="display-settings-option" data-theme-value="dark">Dark</button>
                            </div>
                            <p class="display-settings-heading">Text size</p>
                            <div class="display-settings-row text-size-controls" role="group" aria-label="Text size">
                                <button type="button" class="text-size-btn text-size-decrease" aria-label="Decrease text size" title="Decrease text size">A−</button>
                                <span class="text-size-current" aria-live="polite">Medium</span>
                                <button type="button" class="text-size-btn text-size-increase" aria-label="Increase text size" title="Increase text size">A+</button>
                            </div>
                        </div>
                    </div>
                    <button class="nav-toggle" aria-label="Toggle navigation">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </div>
        </nav>
    `;
}

// Footer Component
function renderFooter() {
    const logoSrc =
        (window.navConfig && window.navConfig.logo && window.navConfig.logo.image) ||
        'assets/images/NRCGA-Logo_Badge-Color-300x272.png';
    const orgName =
        (window.nrcgaContactSettings && window.nrcgaContactSettings.organization_name) ||
        'Nevada Regional Common Ground Alliance';
    return `
        <footer class="footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-brand" style="text-align: center; width: 100%;">
                        <div class="logo" style="justify-content: center;">
                            <img src="${logoSrc}" alt="NRCGA Logo" class="logo-img footer-logo">
                            <span class="logo-text">${orgName}</span>
                        </div>
                        <p style="text-align: center;">${(window.nrcgaFooterSettings && window.nrcgaFooterSettings.tagline) || 'Promoting public safety and damage prevention across Nevada.'}</p>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>${(window.nrcgaFooterSettings && window.nrcgaFooterSettings.copyright) || '&copy; 2026 NRCGA. All rights reserved.'}</p>
                </div>
            </div>
        </footer>
    `;
}


// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await applyRemoteSiteConfig();

    // Inject navigation if placeholder exists
    const navPlaceholder = document.getElementById('nav-placeholder');
    if (navPlaceholder) {
        navPlaceholder.outerHTML = renderNavigation();
    }
    
    // Inject footer if placeholder exists
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        footerPlaceholder.outerHTML = renderFooter();
    }
    
    // Initialize navigation functionality after injection
    initializeNavigation();
    initializeDisplaySettings();
});

async function applyRemoteSiteConfig() {
    if (!window.NRCGA_API) return;
    try {
        const [navData, settings] = await Promise.all([
            window.NRCGA_API.get('/navigation'),
            window.NRCGA_API.get('/settings'),
        ]);
        if (navData && typeof navData === 'object' && navData.logo) {
            window.navConfig = navData;
        }
        if (settings && settings.footer) {
            window.nrcgaFooterSettings = settings.footer;
        }
        if (settings && settings.contact) {
            window.nrcgaContactSettings = settings.contact;
        }
        if (settings && settings.theme) {
            window.nrcgaThemeSettings = settings.theme;
            const root = document.documentElement;
            if (settings.theme.primary) root.style.setProperty('--primary', settings.theme.primary);
            if (settings.theme.primary_dark) root.style.setProperty('--primary-dark', settings.theme.primary_dark);
            if (settings.theme.secondary) root.style.setProperty('--secondary', settings.theme.secondary);
            if (settings.theme.accent) root.style.setProperty('--accent', settings.theme.accent);
        }
    } catch (err) {
        console.warn('Site config API unavailable, using local nav-config.js', err);
    }
}

// Initialize navigation functionality
function initializeNavigation() {
    // Mobile Navigation Toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Mobile Dropdown Toggle
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            if (window.innerWidth <= 968) {
                e.preventDefault();
                const dropdown = toggle.parentElement;
                dropdown.classList.toggle('active');
            }
        });
    });

    // Close mobile menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-menu a:not(.dropdown-toggle)');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
}

const TEXT_SIZE_STEPS = ['sm', 'md', 'lg', 'xl'];
const TEXT_SIZE_DEFAULT = 'md';
const TEXT_SIZE_LABELS = {
    sm: 'Small',
    md: 'Medium',
    lg: 'Large',
    xl: 'Extra large',
};

function getStoredTextSize() {
    try {
        const value = localStorage.getItem('textSize');
        return TEXT_SIZE_STEPS.includes(value) ? value : TEXT_SIZE_DEFAULT;
    } catch {
        return TEXT_SIZE_DEFAULT;
    }
}

function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    if (persist) {
        try {
            localStorage.setItem('theme', next);
        } catch {
            /* ignore quota */
        }
    }
    updateThemeButtons();
}

function updateThemeButtons() {
    const current = getCurrentTheme();
    document.querySelectorAll('[data-theme-value]').forEach((btn) => {
        const selected = btn.dataset.themeValue === current;
        btn.classList.toggle('active', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
}

function updateTextSizeButtons() {
    const current = document.documentElement.getAttribute('data-text-size') || TEXT_SIZE_DEFAULT;
    const index = TEXT_SIZE_STEPS.indexOf(current);
    const decrease = document.querySelector('.text-size-decrease');
    const increase = document.querySelector('.text-size-increase');
    const label = document.querySelector('.text-size-current');
    if (decrease) decrease.disabled = index <= 0;
    if (increase) increase.disabled = index < 0 || index >= TEXT_SIZE_STEPS.length - 1;
    if (label) label.textContent = TEXT_SIZE_LABELS[current] || TEXT_SIZE_LABELS[TEXT_SIZE_DEFAULT];
}

function applyTextSize(size, persist) {
    const next = TEXT_SIZE_STEPS.includes(size) ? size : TEXT_SIZE_DEFAULT;
    document.documentElement.setAttribute('data-text-size', next);
    if (persist) {
        try {
            localStorage.setItem('textSize', next);
        } catch {
            /* ignore quota */
        }
    }
    updateTextSizeButtons();
}

function setDisplaySettingsOpen(open) {
    const root = document.querySelector('.display-settings');
    const toggle = document.querySelector('.display-settings-toggle');
    const menu = document.getElementById('display-settings-menu');
    if (!root || !toggle || !menu) return;
    root.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
}

function initializeDisplaySettings() {
    let storedTheme = 'light';
    try {
        storedTheme = localStorage.getItem('theme') || 'light';
    } catch {
        storedTheme = 'light';
    }
    applyTheme(storedTheme, false);
    applyTextSize(getStoredTextSize(), false);

    const root = document.querySelector('.display-settings');
    const toggle = document.querySelector('.display-settings-toggle');
    const menu = document.getElementById('display-settings-menu');
    if (!root || !toggle || !menu) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setDisplaySettingsOpen(menu.hidden);
    });

    document.querySelectorAll('[data-theme-value]').forEach((btn) => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.themeValue, true);
        });
    });

    const decrease = document.querySelector('.text-size-decrease');
    const increase = document.querySelector('.text-size-increase');
    if (decrease) {
        decrease.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-text-size') || TEXT_SIZE_DEFAULT;
            const index = TEXT_SIZE_STEPS.indexOf(current);
            if (index > 0) applyTextSize(TEXT_SIZE_STEPS[index - 1], true);
        });
    }
    if (increase) {
        increase.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-text-size') || TEXT_SIZE_DEFAULT;
            const index = Math.max(0, TEXT_SIZE_STEPS.indexOf(current));
            if (index < TEXT_SIZE_STEPS.length - 1) applyTextSize(TEXT_SIZE_STEPS[index + 1], true);
        });
    }

    document.addEventListener('click', (e) => {
        if (!root.contains(e.target)) setDisplaySettingsOpen(false);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setDisplaySettingsOpen(false);
    });
}


