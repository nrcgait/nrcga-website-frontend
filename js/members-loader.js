// Members Data Loader
// Loads and displays member data from local data/members.csv file

// Load and display members
async function loadMembers() {
    try {
        // Load CSV data
        const members = await loadCSV('data/members.csv');
        
        // Normalize Type field (trim whitespace and handle case)
        members.forEach(m => {
            if (m.Type) {
                m.Type = m.Type.trim();
            }
        });
        
        // Separate members by type (case-insensitive with trimmed values)
        let officers = members.filter(m => m.Type && m.Type.trim() === 'Officer');
        let directors = members.filter(m => m.Type && m.Type.trim() === 'Director');
        let stakeholderMembers = members.filter(m => m.Type && m.Type.trim() === 'Stakeholder');
        let associateMembers = members.filter(m => m.Type && m.Type.trim() === 'Associate');
        
        // Sort officers by Stakeholder Group (Position) alphabetically
        officers.sort((a, b) => {
            const groupA = (a['Stakeholder Group'] || a.Position || '').toLowerCase();
            const groupB = (b['Stakeholder Group'] || b.Position || '').toLowerCase();
            return groupA.localeCompare(groupB);
        });
        
        // Sort directors by Stakeholder Group alphabetically
        directors.sort((a, b) => {
            const groupA = (a['Stakeholder Group'] || '').toLowerCase();
            const groupB = (b['Stakeholder Group'] || '').toLowerCase();
            return groupA.localeCompare(groupB);
        });
        
        // Sort stakeholders by Company Name alphabetically
        stakeholderMembers.sort((a, b) => {
            const nameA = (a['Company Name'] || '').toLowerCase();
            const nameB = (b['Company Name'] || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        // Sort associate members by Company Name alphabetically
        associateMembers.sort((a, b) => {
            const nameA = (a['Company Name'] || '').toLowerCase();
            const nameB = (b['Company Name'] || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
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
        const hasWebsite = member.Website && member.Website.trim();
        const websiteUrl = hasWebsite ? member.Website.trim() : '#';
        
        // Show contact person if available
        const contactInfo = member['Contact Person'] ? 
            `<p class="member-contact">${member['Contact Person']}</p>` : '';
        
        // Build categories section
        const categoryHtml = member['Stakeholder Group'] ? 
            `<div style="margin-top: 0.5rem; margin-bottom: 0.5rem;"><span class="member-category">${member['Stakeholder Group']}</span></div>` : '';
        
        // Make the entire member item clickable if website exists
        const itemTag = hasWebsite ? 'a' : 'div';
        const itemAttrs = hasWebsite ? 
            `href="${websiteUrl}" target="_blank" rel="noopener noreferrer"` : '';
        const itemClass = hasWebsite ? 'member-item member-item-link' : 'member-item';
        
        return `
            <${itemTag} class="${itemClass}" ${itemAttrs} style="${hasWebsite ? 'text-decoration: none; color: inherit; display: block;' : ''}">
                <h4>${member['Company Name'] || ''}</h4>
                ${contactInfo}
                ${categoryHtml}
            </${itemTag}>
        `;
    }).join('');
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
        const hasWebsite = member.Website && member.Website.trim();
        const websiteUrl = hasWebsite ? member.Website.trim() : '#';
        
        // Make the entire member item clickable if website exists
        const itemTag = hasWebsite ? 'a' : 'div';
        const itemAttrs = hasWebsite ? 
            `href="${websiteUrl}" target="_blank" rel="noopener noreferrer"` : '';
        const itemClass = hasWebsite ? 'member-item member-item-link' : 'member-item';
        
        return `
            <${itemTag} class="${itemClass}" ${itemAttrs} style="${hasWebsite ? 'text-decoration: none; color: inherit; display: block;' : ''}">
                <h4>${member['Company Name'] || ''}</h4>
            </${itemTag}>
        `;
    }).join('');
}

// Note: Modal functionality removed - members now link directly to their websites

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Only load if we're on the members page
    if (document.getElementById('stakeholder-members-grid')) {
        await loadMembers();
    }
});

