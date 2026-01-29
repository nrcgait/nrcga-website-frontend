// Archive Data Loader
// Loads and displays archive data (meeting minutes and historical documents) from data/archive.csv

// Format date for display
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
        return dateString;
    }
}

// Extract year from date string
function getYear(dateString) {
    try {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.getFullYear().toString();
        }
        const yearMatch = dateString.match(/\d{4}/);
        return yearMatch ? yearMatch[0] : 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

// Store grouped data globally
let meetingMinutesByYear = {};
let historicalDocumentsByYear = {};
let allMeetingMinutesYears = [];
let allHistoricalDocumentsYears = [];

// Load and display archive items
async function loadArchive() {
    try {
        // Load CSV data
        const archiveItems = await loadCSV('data/archive.csv');
        
        // Separate items by type
        const meetingMinutes = archiveItems.filter(item => item.type === 'meeting-minute');
        const historicalDocuments = archiveItems.filter(item => item.type === 'historical-document');
        
        // Group meeting minutes by year
        meetingMinutes.forEach(minute => {
            const year = getYear(minute.date);
            if (!meetingMinutesByYear[year]) {
                meetingMinutesByYear[year] = [];
            }
            meetingMinutesByYear[year].push(minute);
        });
        
        // Sort minutes within each year by date (newest first)
        Object.keys(meetingMinutesByYear).forEach(year => {
            meetingMinutesByYear[year].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });
        });
        
        // Get sorted years for meeting minutes
        allMeetingMinutesYears = Object.keys(meetingMinutesByYear).sort((a, b) => b.localeCompare(a));
        
        // Group historical documents by year
        historicalDocuments.forEach(doc => {
            const year = getYear(doc.date);
            if (!historicalDocumentsByYear[year]) {
                historicalDocumentsByYear[year] = [];
            }
            historicalDocumentsByYear[year].push(doc);
        });
        
        // Sort documents within each year by date (newest first)
        Object.keys(historicalDocumentsByYear).forEach(year => {
            historicalDocumentsByYear[year].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
            });
        });
        
        // Get sorted years for historical documents
        allHistoricalDocumentsYears = Object.keys(historicalDocumentsByYear).sort((a, b) => b.localeCompare(a));
        
        // Initialize display with dropdowns
        initializeMeetingMinutes();
        initializeHistoricalDocuments();
        
    } catch (error) {
        console.error('Error loading archive:', error);
        const meetingMinutesContent = document.getElementById('meeting-minutes-content');
        if (meetingMinutesContent) {
            meetingMinutesContent.innerHTML = '<h2>Meeting Minutes</h2><p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load meeting minutes. Please try again later.</p>';
        }
    }
}

// Initialize meeting minutes section with dropdown
function initializeMeetingMinutes() {
    const container = document.getElementById('meeting-minutes-content');
    if (!container) return;
    
    if (allMeetingMinutesYears.length === 0) {
        container.innerHTML = '<h2>Meeting Minutes</h2><p>Historical meeting minutes and records from NRCGA board meetings, committee meetings, and general assemblies. NRCGA monthly membership meetings take place the second Tuesday of January, March, May, July, September, and November.</p><p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No meeting minutes available.</p>';
        return;
    }
    
    let html = '<h2>Meeting Minutes</h2>';
    html += '<p>Historical meeting minutes and records from NRCGA board meetings, committee meetings, and general assemblies. NRCGA monthly membership meetings take place the second Tuesday of January, March, May, July, September, and November.</p>';
    html += '<div style="margin: 1.5rem 0;">';
    html += '<label for="meeting-minutes-year-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Select Year:</label>';
    html += '<select id="meeting-minutes-year-select" style="width: 100%; max-width: 300px; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; background: white;">';
    html += '<option value="">-- All Years -- (Default)</option>';
    
    allMeetingMinutesYears.forEach(year => {
        html += `<option value="${year}">${year}</option>`;
    });
    
    html += '</select>';
    html += '</div>';
    html += '<div id="meeting-minutes-list"></div>';
    
    container.innerHTML = html;
    
    // Display all years initially
    displayMeetingMinutesByYear('');
    
    // Add event listener
    const select = document.getElementById('meeting-minutes-year-select');
    if (select) {
        select.addEventListener('change', (e) => {
            displayMeetingMinutesByYear(e.target.value);
        });
    }
}

// Display meeting minutes for selected year
function displayMeetingMinutesByYear(selectedYear) {
    const container = document.getElementById('meeting-minutes-list');
    if (!container) return;
    
    let html = '';
    
    const yearsToShow = selectedYear ? [selectedYear] : allMeetingMinutesYears;
    
    if (yearsToShow.length === 0) {
        html = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No meeting minutes available.</p>';
    } else {
        yearsToShow.forEach(year => {
            const minutes = meetingMinutesByYear[year];
            if (minutes && minutes.length > 0) {
                html += `<div style="margin-top: 2rem;">`;
                html += `<h3 style="margin-bottom: 1rem; color: var(--primary);">${year}</h3>`;
                html += `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">`;
                
                minutes.forEach(minute => {
                    const formattedDate = formatDate(minute.date);
                    const isExternal = minute.link.startsWith('http://') || minute.link.startsWith('https://');
                    const linkTarget = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
                    
                    html += `<li style="display: flex; align-items: flex-start; gap: 0.75rem;">`;
                    html += `<span style="color: var(--primary); font-size: 1.25rem;">📄</span>`;
                    html += `<div>`;
                    html += `<a href="${minute.link}"${linkTarget} style="color: var(--primary); text-decoration: none; font-weight: 500;">${minute.title}</a>`;
                    html += `<p style="margin: 0.25rem 0 0 0; color: var(--text-light); font-size: 0.9375rem;">${formattedDate}</p>`;
                    html += `</div>`;
                    html += `</li>`;
                });
                
                html += `</ul>`;
                html += `</div>`;
            }
        });
    }
    
    container.innerHTML = html;
}

// Initialize historical documents section with dropdown
function initializeHistoricalDocuments() {
    const container = document.getElementById('historical-documents-content');
    if (!container) return;
    
    if (allHistoricalDocumentsYears.length === 0) {
        container.innerHTML = '<h2>Historical Documents</h2><p>NRCGA news articles and historical documents organized by year.</p><p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No historical documents available.</p>';
        return;
    }
    
    let html = '<h2>Historical Documents</h2>';
    html += '<p>NRCGA news articles and historical documents organized by year.</p>';
    html += '<div style="margin: 1.5rem 0;">';
    html += '<label for="historical-documents-year-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Select Year:</label>';
    html += '<select id="historical-documents-year-select" style="width: 100%; max-width: 300px; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; background: white;">';
    html += '<option value="">-- All Years -- (Default)</option>';
    
    allHistoricalDocumentsYears.forEach(year => {
        html += `<option value="${year}">${year}</option>`;
    });
    
    html += '</select>';
    html += '</div>';
    html += '<div id="historical-documents-list"></div>';
    
    container.innerHTML = html;
    
    // Display all years initially
    displayHistoricalDocumentsByYear('');
    
    // Add event listener
    const select = document.getElementById('historical-documents-year-select');
    if (select) {
        select.addEventListener('change', (e) => {
            displayHistoricalDocumentsByYear(e.target.value);
        });
    }
}

// Display historical documents for selected year
function displayHistoricalDocumentsByYear(selectedYear) {
    const container = document.getElementById('historical-documents-list');
    if (!container) return;
    
    let html = '';
    
    const yearsToShow = selectedYear ? [selectedYear] : allHistoricalDocumentsYears;
    
    if (yearsToShow.length === 0) {
        html = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No historical documents available.</p>';
    } else {
        yearsToShow.forEach(year => {
            const documents = historicalDocumentsByYear[year];
            if (documents && documents.length > 0) {
                html += `<div style="margin-top: 2rem;">`;
                html += `<h3 style="margin-bottom: 1rem; color: var(--primary);">${year}</h3>`;
                html += `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">`;
                
                documents.forEach(doc => {
                    const formattedDate = formatDate(doc.date);
                    const isExternal = doc.link.startsWith('http://') || doc.link.startsWith('https://');
                    const linkTarget = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
                    
                    // Determine icon based on link type
                    let icon = '📄';
                    if (doc.link.includes('photos.google.com') || doc.link.includes('photo')) {
                        icon = '📷';
                    } else if (doc.link.includes('youtube.com') || doc.link.includes('video')) {
                        icon = '🎥';
                    }
                    
                    html += `<li style="display: flex; align-items: flex-start; gap: 0.75rem;">`;
                    html += `<span style="color: var(--primary); font-size: 1.25rem;">${icon}</span>`;
                    html += `<div>`;
                    html += `<a href="${doc.link}"${linkTarget} style="color: var(--primary); text-decoration: none; font-weight: 500;">${doc.title}</a>`;
                    html += `<p style="margin: 0.25rem 0 0 0; color: var(--text-light); font-size: 0.9375rem;">${formattedDate}</p>`;
                    html += `</div>`;
                    html += `</li>`;
                });
                
                html += `</ul>`;
                html += `</div>`;
            }
        });
    }
    
    container.innerHTML = html;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('meeting-minutes-content') || document.getElementById('historical-documents-content')) {
        await loadArchive();
    }
});