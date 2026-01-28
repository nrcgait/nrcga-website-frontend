// Navigation Component
// Reads configuration from nav-config.js
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
                <button class="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">
                    <span class="theme-toggle-icon">🌙</span>
                </button>
                <button class="nav-toggle" aria-label="Toggle navigation">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </nav>
    `;
}

// Footer Component
function renderFooter() {
    return `
        <footer class="footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-brand" style="text-align: center; width: 100%;">
                        <div class="logo" style="justify-content: center;">
                            <img src="assets/images/NRCGA-Logo_Badge-Color-300x272.png" alt="NRCGA Logo" class="logo-img footer-logo">
                            <span class="logo-text">Nevada Regional Common Ground Alliance</span>
                        </div>
                        <p style="text-align: center;">Promoting public safety and damage prevention across Nevada.</p>
                    </div>
                    <!-- Footer links commented out - all links are available in the top navigation bar
                    <div class="footer-links">
                        <div class="footer-column">
                            <h4>Quick Links</h4>
                            <ul>
                                <li><a href="about.html">About NRCGA</a></li>
                                <li><a href="about-811.html">About 811</a></li>
                                <li><a href="training.html">Safety Training</a></li>
                                <li><a href="programs.html">Programs</a></li>
                            </ul>
                        </div>
                        <div class="footer-column">
                            <h4>Resources</h4>
                            <ul>
                                <li><a href="calendar.html">Calendar</a></li>
                                <li><a href="programs.html">Programs and Committees</a></li>
                                <li><a href="about-811.html">811 Tools</a></li>
                                <li><a href="contact.html">Contact Us</a></li>
                            </ul>
                        </div>
                        <div class="footer-column">
                            <h4>Connect</h4>
                            <ul>
                                <li><a href="https://www.linkedin.com/company/nrcga/posts/?feedView=all" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
                                <li><a href="contact.html">Newsletter</a></li>
                            </ul>
                        </div>
                    </div>
                    -->
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2024 NRCGA. All rights reserved.</p>
                </div>
            </div>
        </footer>
    `;
}


// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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
    initializeThemeToggle();
});

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

// Initialize theme toggle
function initializeThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    const themeIcon = document.querySelector('.theme-toggle-icon');

    // Check for saved theme preference or default to light mode
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);

    if (currentTheme === 'dark' && themeIcon) {
        themeIcon.textContent = '☀️';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme');
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            if (themeIcon) {
                themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            }
        });
    }
}

