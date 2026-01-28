// Members Data Loader
// Loads and displays member data from GitHub CSV file

// Simple CSV parser
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle CSV with quoted fields
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim()); // Add last value
        
        // Create object from headers and values
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        data.push(obj);
    }
    
    return data;
}

// Load and display members
async function loadMembers() {
    try {
        // Fetch CSV from GitHub raw URL with cache-busting
        // Add timestamp to prevent browser caching
        // Note: Don't add custom headers as they trigger CORS preflight requests
        const timestamp = new Date().getTime();
        const csvUrl = `https://raw.githubusercontent.com/nrcgait/nrcga-website/main/members.csv?v=${timestamp}`;
        const response = await fetch(csvUrl, {
            cache: 'no-store' // Use no-store instead of no-cache to avoid preflight
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load members: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const members = parseCSV(csvText);
        
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
        console.error('Error loading members:', error);
        // Show error message on page
        const grid = document.getElementById('stakeholder-members-grid');
        if (grid) {
            grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Unable to load members data. Please try again later.</p>';
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
            `<p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">${member['Contact Person']}</p>` : '';
        
        return `
            <div class="member-item" data-member='${JSON.stringify(member).replace(/'/g, "&apos;")}'>
                <h4>${member['Company Name'] || ''}</h4>
                ${contactInfo}
                ${member['Stakeholder Group'] ? `<span class="member-category">${member['Stakeholder Group']}</span>` : ''}
                ${member['Voting Member'] === 'Yes' ? '<span class="member-badge">Voting Member</span>' : ''}
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

