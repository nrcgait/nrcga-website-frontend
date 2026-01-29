// Members Data Loader
// Loads and displays member data from local data/members.csv file

// Load and display members
async function loadMembers() {
    try {
        // Load CSV data
        const members = await loadCSV('data/members.csv');
        
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
document.addEventListener('DOMContentLoaded', async () => {
    // Only load if we're on the members page
    if (document.getElementById('stakeholder-members-grid')) {
        await loadMembers();
    }
});

