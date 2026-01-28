// Archive Data Loader
// Loads and displays archive data (meeting minutes and historical documents) from data/archive.js

// Format date for display
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            // If date parsing fails, try to extract from string
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
        // Try to extract year from string (YYYY-MM-DD format)
        const yearMatch = dateString.match(/\d{4}/);
        return yearMatch ? yearMatch[0] : 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

// Load and display archive items
function loadArchive() {
    try {
        // Check if archiveData is available (loaded from data/archive.js)
        if (typeof window.archiveData === 'undefined') {
            throw new Error('Archive data not found. Make sure data/archive.js is loaded before archive-loader.js');
        }
        
        const archiveItems = window.archiveData;
        
        // Separate items by type
        const meetingMinutes = archiveItems.filter(item => item.type === 'meeting-minute');
        const historicalDocuments = archiveItems.filter(item => item.type === 'historical-document');
        
        // Display meeting minutes
        displayMeetingMinutes(meetingMinutes);
        
        // Display historical documents
        displayHistoricalDocuments(historicalDocuments);
        
    } catch (error) {
        console.error('Error loading archive:', error);
        // Show error message on page
        const meetingMinutesContent = document.getElementById('meeting-minutes-content');
        if (meetingMinutesContent) {
            meetingMinutesContent.innerHTML = '<h2>Meeting Minutes</h2><p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load meeting minutes. Please try again later.</p>';
        }
    }
}

// Display meeting minutes organized by year
function displayMeetingMinutes(minutes) {
    const container = document.getElementById('meeting-minutes-content');
    if (!container) return;
    
    if (minutes.length === 0) {
        container.innerHTML = '<h2>Meeting Minutes</h2><p>Historical meeting minutes and records from NRCGA board meetings, committee meetings, and general assemblies. NRCGA monthly membership meetings take place the second Tuesday of January, March, May, July, September, and November.</p><p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No meeting minutes available.</p>';
        return;
    }
    
    // Group by year
    const byYear = {};
    minutes.forEach(minute => {
        const year = getYear(minute.date);
        if (!byYear[year]) {
            byYear[year] = [];
        }
        byYear[year].push(minute);
    });
    
    // Sort years descending
    const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
    
    // Sort minutes within each year by date (newest first)
    years.forEach(year => {
        byYear[year].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
        });
    });
    
    let html = '<h2>Meeting Minutes</h2>';
    html += '<p>Historical meeting minutes and records from NRCGA board meetings, committee meetings, and general assemblies. NRCGA monthly membership meetings take place the second Tuesday of January, March, May, July, September, and November.</p>';
    
    years.forEach(year => {
        html += `<div style="margin-top: 2rem;">`;
        html += `<h3 style="margin-bottom: 1rem; color: var(--primary);">${year}</h3>`;
        html += `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">`;
        
        byYear[year].forEach(minute => {
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
    });
    
    container.innerHTML = html;
}

// Display historical documents organized by year
function displayHistoricalDocuments(documents) {
    const container = document.getElementById('historical-documents-content');
    if (!container) return;
    
    if (documents.length === 0) {
        container.innerHTML = '<h2>Historical Documents</h2><p>NRCGA news articles and historical documents organized by year.</p><p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No historical documents available.</p>';
        return;
    }
    
    // Group by year
    const byYear = {};
    documents.forEach(doc => {
        const year = getYear(doc.date);
        if (!byYear[year]) {
            byYear[year] = [];
        }
        byYear[year].push(doc);
    });
    
    // Sort years descending
    const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
    
    // Sort documents within each year by date (newest first)
    years.forEach(year => {
        byYear[year].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
        });
    });
    
    let html = '<h2>Historical Documents</h2>';
    html += '<p>NRCGA news articles and historical documents organized by year.</p>';
    
    years.forEach(year => {
        html += `<div style="margin-top: 2rem;">`;
        html += `<h3 style="margin-bottom: 1rem; color: var(--primary);">${year}</h3>`;
        html += `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">`;
        
        byYear[year].forEach(doc => {
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
    });
    
    container.innerHTML = html;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only load if we're on the archive page
    if (document.getElementById('meeting-minutes-content') || document.getElementById('historical-documents-content')) {
        loadArchive();
    }
});

