// Members Data Loader
// Loads and displays member data from data/members.csv file

// Simple CSV parser
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Parse header row
    const headers = parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue; // Skip empty lines
        
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        data.push(obj);
    }
    
    return data;
}

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last field
    result.push(current.trim());
    
    return result;
}

// Load and display members from CSV
async function loadMembers() {
    try {
        // Fetch CSV file - try relative path first
        let csvPath = 'data/members.csv';
        
        // If we're in a subdirectory, adjust path
        const currentPath = window.location.pathname;
        if (currentPath.includes('/') && currentPath.split('/').length > 2) {
            // We're in a subdirectory, go up one level
            csvPath = '../data/members.csv';
        }
        
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`Failed to load members.csv: ${response.status} ${response.statusText}. Make sure you're running from a web server (not file:// protocol).`);
        }
        
        const csvText = await response.text();
        const members = parseCSV(csvText);
        
        if (members.length === 0) {
            throw new Error('No members data found in CSV file');
        }
        
        // Separate members by type
        const officers = members.filter(m => m.Type === 'Officer');
        const directors = members.filter(m => m.Type === 'Director');
        const stakeholderMembers = members.filter(m => m.Type === 'Stakeholder');
        const associateMembers = members.filter(m => m.Type === 'Associate');
        
        // Display officers
        displayOfficers(officers);
        
        // Display directors
        displayDirectors(directors);
        
        // Display stakeholder members
        displayStakeholderMembers(stakeholderMembers);
        
        // Display associate members
        displayAssociateMembers(associateMembers);
        
    } catch (error) {
        console.error('Error loading members from CSV:', error);
        // Show error message on page
        const grid = document.getElementById('stakeholder-members-grid');
        if (grid) {
            const errorMsg = error.message.includes('file://') || error.message.includes('Failed to fetch') 
                ? '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load members data. Please use a web server (not file://). The CSV file requires HTTP/HTTPS protocol.</p>'
                : `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load members data: ${error.message}</p>`;
            grid.innerHTML = errorMsg;
        }
    }
}

// Display officers in the board table
function displayOfficers(officers) {
    const officersTable = document.querySelector('.board-table');
    if (!officersTable || officers.length === 0) return;
    
    officers.forEach(officer => {
        const row = document.createElement('div');
        row.className = 'board-row';
        // Format: "Name, Company" or just "Name"
        const nameDisplay = officer['Contact Person'] ? 
            `${officer['Company Name']}, ${officer['Contact Person']}` : 
            officer['Company Name'] || '';
        row.innerHTML = `
            <div class="board-cell">${officer['Stakeholder Group'] || officer.Position || ''}</div>
            <div class="board-cell">${nameDisplay}</div>
            <div class="board-cell">${officer.Term || ''}</div>
        `;
        officersTable.appendChild(row);
    });
}

// Display directors in the board table
function displayDirectors(directors) {
    const directorsTables = document.querySelectorAll('.board-table');
    const directorsTable = directorsTables[directorsTables.length - 1]; // Get the second table
    if (!directorsTable || directors.length === 0) return;
    
    directors.forEach(director => {
        const row = document.createElement('div');
        row.className = 'board-row';
        // Format: "Name, Company" or just "Name"
        const nameDisplay = director['Contact Person'] ? 
            `${director['Contact Person']}, ${director['Company Name']}` : 
            director['Company Name'] || '';
        row.innerHTML = `
            <div class="board-cell">${director['Stakeholder Group'] || ''}</div>
            <div class="board-cell">${nameDisplay}</div>
            <div class="board-cell">${director.Term || ''}</div>
        `;
        directorsTable.appendChild(row);
    });
}

// Display stakeholder members in grid
function displayStakeholderMembers(members) {
    const grid = document.getElementById('stakeholder-members-grid');
    if (!grid) return;
    
    if (members.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No stakeholder members found.</p>';
        return;
    }
    
    grid.innerHTML = members.map(member => {
        const website = member.Website && member.Website.trim() ? 
            `<a href="${member.Website}" target="_blank" rel="noopener noreferrer" class="member-website">Visit Website →</a>` : '';
        
        // Show contact person if available
        const contactInfo = member['Contact Person'] ? 
            `<p class="member-contact">${member['Contact Person']}</p>` : '';
        
        // Build categories section
        const categoryHtml = member['Stakeholder Group'] ? 
            `<div style="margin-top: 0.5rem; margin-bottom: 0.5rem;"><span class="member-category">${member['Stakeholder Group']}</span></div>` : '';
        
        return `
            <div class="member-item" data-member='${JSON.stringify(member).replace(/'/g, "&apos;")}'>
                <h4>${member['Company Name'] || ''}</h4>
                ${contactInfo}
                ${categoryHtml}
                ${website}
            </div>
        `;
    }).join('');
    
    // Add click handlers for member modals
    attachMemberClickHandlers();
}

// Display associate members
function displayAssociateMembers(members) {
    const grid = document.getElementById('associate-members-grid');
    if (!grid) return;
    
    if (members.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No associate members found.</p>';
        return;
    }
    
    grid.innerHTML = members.map(member => {
        const website = member.Website && member.Website.trim() ? 
            `<a href="${member.Website}" target="_blank" rel="noopener noreferrer" class="member-website">Visit Website →</a>` : '';
        
        return `
            <div class="member-item" data-member='${JSON.stringify(member).replace(/'/g, "&apos;")}'>
                <h4>${member['Company Name'] || ''}</h4>
                ${website}
            </div>
        `;
    }).join('');
    
    // Add click handlers for member modals
    attachMemberClickHandlers();
}

// Attach click handlers to member items for modal display
function attachMemberClickHandlers() {
    const memberItems = document.querySelectorAll('.member-item');
    const modal = document.getElementById('member-modal');
    const modalClose = document.getElementById('member-modal-close');
    
    if (!modal) return;
    
    memberItems.forEach(item => {
        item.addEventListener('click', () => {
            const memberData = JSON.parse(item.getAttribute('data-member'));
            showMemberModal(memberData);
        });
    });
    
    // Close modal handlers
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Show member modal with details
function showMemberModal(member) {
    const modal = document.getElementById('member-modal');
    if (!modal) return;
    
    document.getElementById('modal-company-name').textContent = member['Company Name'] || '';
    const categoryText = member['Stakeholder Group'] || member.Category || '';
    document.getElementById('modal-category').textContent = categoryText;
    
    // Voting member
    const votingMemberEl = document.getElementById('modal-voting-member');
    if (member['Voting Member'] === 'Yes') {
        votingMemberEl.style.display = 'flex';
        document.getElementById('modal-voting-member-value').textContent = 'Yes';
    } else {
        votingMemberEl.style.display = 'none';
    }
    
    // Stakeholder group
    const stakeholderGroupEl = document.getElementById('modal-stakeholder-group');
    if (member['Stakeholder Group']) {
        stakeholderGroupEl.style.display = 'flex';
        document.getElementById('modal-stakeholder-group-value').textContent = member['Stakeholder Group'];
    } else {
        stakeholderGroupEl.style.display = 'none';
    }
    
    // Contact person
    const contactPersonEl = document.getElementById('modal-contact-person');
    if (member['Contact Person']) {
        contactPersonEl.style.display = 'flex';
        document.getElementById('modal-contact-person-value').textContent = member['Contact Person'];
    } else {
        contactPersonEl.style.display = 'none';
    }
    
    // Website
    const websiteEl = document.getElementById('modal-website');
    const websiteLink = document.getElementById('modal-website-link');
    if (member.Website && member.Website.trim()) {
        websiteEl.style.display = 'block';
        websiteLink.href = member.Website;
    } else {
        websiteEl.style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only load if we're on the members page
    if (document.getElementById('stakeholder-members-grid')) {
        loadMembers();
    }
});

