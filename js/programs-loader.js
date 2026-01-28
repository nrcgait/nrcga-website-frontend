// Programs Data Loader
// Loads and displays programs data from data/programs.js

// Load and display programs
function loadPrograms() {
    try {
        // Check if programsData is available (loaded from data/programs.js)
        if (typeof window.programsData === 'undefined') {
            throw new Error('Programs data not found. Make sure data/programs.js is loaded before programs-loader.js');
        }
        
        const programs = window.programsData;
        
        // Sort by order if specified, otherwise keep original order
        const sortedPrograms = [...programs].sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 999;
            const orderB = b.order !== undefined ? b.order : 999;
            return orderA - orderB;
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
        const isExternal = program.link.startsWith('http://') || program.link.startsWith('https://');
        const linkTarget = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        
        html += `<a href="${program.link}" class="program-card" style="text-decoration: none; color: inherit; display: block;"${linkTarget}>`;
        html += `<div class="program-image">`;
        html += `<div class="program-icon">${program.icon || '📄'}</div>`;
        html += `</div>`;
        html += `<div class="program-content">`;
        html += `<h3>${program.title || 'Program'}</h3>`;
        html += `<p>${program.description || ''}</p>`;
        html += `</div>`;
        html += `</a>`;
    });
    
    container.innerHTML = html;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only load if we're on the programs page
    if (document.getElementById('programs-list')) {
        loadPrograms();
    }
});

