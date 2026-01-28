// Program Form Loader
// Loads and displays program-specific forms from data/programs.js
// This script should be loaded on individual program pages

function loadProgramForm() {
    try {
        // Check if programsData is available
        if (typeof window.programsData === 'undefined') {
            console.warn('Programs data not found. Make sure data/programs.js is loaded before program-form-loader.js');
            return;
        }

        // Get current page filename
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Find the program that matches this page
        const program = window.programsData.find(p => {
            const programLink = p.link.split('/').pop();
            return programLink === currentPage;
        });

        // If no program found or no form specified, do nothing
        if (!program || !program.form) {
            return;
        }

        // Get the placeholder div
        const placeholder = document.getElementById('program-form-placeholder');
        if (!placeholder) {
            console.warn('Program form placeholder not found. Add <div id="program-form-placeholder"></div> to the program page.');
            return;
        }

        // Create the form section
        const formSection = createFormSection(program.form, program.title);
        
        // Inject the form section
        placeholder.outerHTML = formSection;

    } catch (error) {
        console.error('Error loading program form:', error);
    }
}

function createFormSection(formUrl, programTitle) {
    // Create a section with proper styling for the embedded form
    return `
        <section class="content-section" style="background: var(--bg-light);">
            <div class="container">
                <div class="section-header" style="margin-bottom: 2rem;">
                    <h2 class="section-title">${programTitle} Form</h2>
                    <p class="section-subtitle">Complete the form below to get involved or learn more.</p>
                </div>
                <div class="form-wrapper" style="max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; padding: 2rem; box-shadow: var(--shadow-sm);">
                    <iframe 
                        src="${formUrl}" 
                        width="100%" 
                        height="800" 
                        frameborder="0" 
                        marginheight="0" 
                        marginwidth="0"
                        style="border: none; border-radius: 8px; min-height: 600px;"
                        title="${programTitle} Form"
                        loading="lazy">
                        Loading…
                    </iframe>
                </div>
            </div>
        </section>
    `;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only load if we're on a program page with a form placeholder
    if (document.getElementById('program-form-placeholder')) {
        loadProgramForm();
    }
});

