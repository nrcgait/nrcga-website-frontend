// Programs Data Loader
// Loads and displays programs data from data/programs.csv

function programEsc(value) {
    return window.NRCGA_safeDom ? window.NRCGA_safeDom.escapeHtml(value) : String(value ?? '');
}

function programSafeHref(value) {
    return window.NRCGA_safeDom ? window.NRCGA_safeDom.safeHref(value) : '#';
}

// Load and display programs
async function loadPrograms() {
    try {
        let raw = null;
        if (window.NRCGA_API) {
            try {
                raw = await window.NRCGA_API.get('/programs');
            } catch (e) {
                console.warn('Programs API unavailable, falling back to CSV', e);
            }
        }
        if (!raw) {
            raw = await loadCSV('data/programs.csv');
        }
        const programs = raw.map(p => ({
            title: pickCsvField(p, 'title'),
            description: pickCsvField(p, 'description'),
            link: pickCsvField(p, 'link'),
            icon: pickCsvField(p, 'icon')
        })).filter(p => p.title || p.link);
        
        // Sort by title alphabetically
        const sortedPrograms = [...programs].sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
        
        // Display programs
        displayPrograms(sortedPrograms);
        
    } catch (error) {
        console.error('Error loading programs:', error);
        // Show error message on page
        const programsList = document.getElementById('programs-list');
        if (programsList) {
            programsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load programs. Please try again later.</p>';
        }
    }
}

// Display programs in the programs list
function displayPrograms(programs) {
    const container = document.getElementById('programs-list');
    if (!container) return;
    
    if (programs.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No programs available.</p>';
        return;
    }
    
    let html = '';
    
    programs.forEach(program => {
        const href = programSafeHref(program.link);
        if (!program.link || href === '#') return;
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        const linkTarget = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        
        html += `<a href="${programEsc(href)}" class="program-card"${linkTarget}>`;
        html += `<div style="display: block;"><span class="program-icon">${programEsc(program.icon || '📄')}</span> <strong class="program-title">${programEsc(program.title || 'Program')}</strong></div>`;
        if (program.description) {
            html += `<div style="display: block; margin-top: 0.75rem; color: var(--text-secondary);">${programEsc(program.description)}</div>`;
        }
        html += `</a>`;
    });
    
    container.innerHTML = html;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Only load if we're on the programs page
    if (document.getElementById('programs-list')) {
        await loadPrograms();
    }
});

