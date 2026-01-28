// Registration Modal Handler
// Handles registration form in a modal popup

const API_BASE_URL = (function() {
  if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
  }
  return window.API_BASE_URL;
})();

// Format date for display
function formatEventDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format time from 24-hour to 12-hour
function formatEventTime(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Load event details
async function loadEventDetails(eventId) {
    if (!eventId) return null;

    try {
        const id = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId;
        if (!isNaN(id)) {
            const response = await fetch(`${API_BASE_URL}/events/${id}`);
            if (response.ok) {
                const data = await response.json();
                return data.event;
            }
        }

        // Fallback to events config if API unavailable
        if (typeof window.eventsData !== 'undefined') {
            const event = window.eventsData.find(e => e.id === eventId || e.id === parseInt(eventId));
            if (event) {
                return {
                    id: event.id,
                    name: event.name,
                    date: event.date,
                    time: event.time,
                    location: event.location
                };
            }
        }
    } catch (error) {
        console.error('Error loading event details:', error);
    }
    return null;
}

// Create registration modal HTML
function createRegistrationModal() {
    const modal = document.createElement('div');
    modal.id = 'registration-modal';
    modal.className = 'registration-modal';
    modal.innerHTML = `
        <div class="registration-modal-overlay"></div>
        <div class="registration-modal-content">
            <button class="registration-modal-close" aria-label="Close">&times;</button>
            <div class="registration-modal-header">
                <h2 id="modal-event-title">Event Registration</h2>
            </div>
            <div class="registration-modal-body">
                <div id="modal-event-info" style="background: var(--bg-light); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;"></div>
                <form id="registration-modal-form">
                    <div class="form-group">
                        <label for="modal-firstName">First Name *</label>
                        <input type="text" id="modal-firstName" name="firstName" required 
                               placeholder="Enter your first name">
                    </div>
                    <div class="form-group">
                        <label for="modal-lastName">Last Name *</label>
                        <input type="text" id="modal-lastName" name="lastName" required 
                               placeholder="Enter your last name">
                    </div>
                    <div class="form-group">
                        <label for="modal-phone">Phone Number *</label>
                        <input type="tel" id="modal-phone" name="phone" required 
                               placeholder="Enter your phone number">
                    </div>
                    <div class="form-group">
                        <label for="modal-email">Email Address *</label>
                        <input type="email" id="modal-email" name="email" required 
                               placeholder="Enter your email address">
                    </div>
                    <div class="form-group">
                        <label for="modal-numberOfPeople">Number of People Being Registered *</label>
                        <input type="number" id="modal-numberOfPeople" name="numberOfPeople" required 
                               min="1" max="10" value="1" placeholder="1-10">
                        <small style="color: var(--text-light); font-size: 0.875rem;">Minimum 1, maximum 10</small>
                    </div>
                    <div class="form-group">
                        <label for="modal-companyName">Company Name</label>
                        <input type="text" id="modal-companyName" name="companyName" 
                               placeholder="Enter your company name (optional)">
                    </div>
                    <div class="form-group">
                        <label for="modal-reasonForTraining">Reason for Training *</label>
                        <select id="modal-reasonForTraining" name="reasonForTraining" required>
                            <option value="">Select a reason...</option>
                            <option value="Operator mandate">Operator mandate</option>
                            <option value="Company Requirement">Company Requirement</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group" id="modal-reasonOtherGroup" style="display: none;">
                        <label for="modal-reasonOtherExplanation">If Other, Please Explain *</label>
                        <textarea id="modal-reasonOtherExplanation" name="reasonOtherExplanation" rows="3"
                                  placeholder="Please explain your reason for training"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="modal-comments">Any Comments, Questions, or Concerns</label>
                        <textarea id="modal-comments" name="comments" rows="4"
                                  placeholder="Enter any additional comments, questions, or concerns (optional)"></textarea>
                    </div>
                    <input type="hidden" id="modal-eventId" name="eventId">
                    <input type="hidden" id="modal-instanceDate" name="instanceDate">
                    <div id="modal-error-message" class="modal-error" style="display: none;"></div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Register</button>
                    <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary); text-align: center;">
                        A confirmation will be sent to your email after registration.
                    </p>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Show registration modal
async function showRegistrationModal(eventId, instanceDate = null) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('registration-modal');
    if (!modal) {
        modal = createRegistrationModal();
    }

    // Load event details
    const event = await loadEventDetails(eventId);
    if (!event) {
        alert('Error: Could not load event details. Please try again.');
        return;
    }

    // Use instance date if provided (for repeating events), otherwise use event date
    const displayDate = instanceDate || event.date;

    // Update modal content
    document.getElementById('modal-event-title').textContent = `Register for ${event.name}`;
    
    const eventInfo = document.getElementById('modal-event-info');
    eventInfo.innerHTML = `
        <h3 style="margin: 0 0 0.75rem 0; color: var(--text-primary);">Event Details</h3>
        <p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Date:</strong> ${formatEventDate(displayDate)}</p>
        <p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Time:</strong> ${formatEventTime(event.time)}</p>
        ${event.location ? `<p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Location:</strong> ${event.location}</p>` : ''}
    `;

    // Set hidden fields
    document.getElementById('modal-eventId').value = eventId;
    document.getElementById('modal-instanceDate').value = instanceDate || '';

    // Reset form
    document.getElementById('registration-modal-form').reset();
    document.getElementById('modal-numberOfPeople').value = '1';
    document.getElementById('modal-error-message').style.display = 'none';
    document.getElementById('modal-reasonOtherGroup').style.display = 'none';

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Focus first input
    setTimeout(() => {
        document.getElementById('modal-firstName').focus();
    }, 100);
}

// Close registration modal
function closeRegistrationModal() {
    const modal = document.getElementById('registration-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Initialize registration modal
function initializeRegistrationModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('registration-modal');
    if (!modal) {
        modal = createRegistrationModal();
    }

    const form = document.getElementById('registration-modal-form');
    const closeBtn = modal.querySelector('.registration-modal-close');
    const overlay = modal.querySelector('.registration-modal-overlay');

    // Close button
    closeBtn.addEventListener('click', closeRegistrationModal);

    // Close on overlay click
    overlay.addEventListener('click', closeRegistrationModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeRegistrationModal();
        }
    });

    // Handle "Other" reason toggle
    const reasonSelect = document.getElementById('modal-reasonForTraining');
    const otherGroup = document.getElementById('modal-reasonOtherGroup');
    const otherExplanation = document.getElementById('modal-reasonOtherExplanation');

    reasonSelect.addEventListener('change', () => {
        if (reasonSelect.value === 'Other') {
            otherGroup.style.display = 'block';
            otherExplanation.required = true;
        } else {
            otherGroup.style.display = 'none';
            otherExplanation.required = false;
            otherExplanation.value = '';
        }
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        const errorMessage = document.getElementById('modal-error-message');
        
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        errorMessage.style.display = 'none';

        // Get form data
        const formData = {
            eventId: parseInt(document.getElementById('modal-eventId').value),
            eventInstanceDate: document.getElementById('modal-instanceDate').value || null,
            firstName: document.getElementById('modal-firstName').value.trim(),
            lastName: document.getElementById('modal-lastName').value.trim(),
            email: document.getElementById('modal-email').value.trim(),
            phone: document.getElementById('modal-phone').value.trim(),
            numberOfPeople: parseInt(document.getElementById('modal-numberOfPeople').value) || 1,
            companyName: document.getElementById('modal-companyName').value.trim() || null,
            reasonForTraining: document.getElementById('modal-reasonForTraining').value,
            reasonOtherExplanation: document.getElementById('modal-reasonOtherExplanation').value.trim() || null,
            comments: document.getElementById('modal-comments').value.trim() || null
        };

        // Validate required fields
        if (!formData.eventId) {
            errorMessage.textContent = 'Error: Event ID is missing.';
            errorMessage.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/registrations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            let data;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    const text = await response.text();
                    console.error('REG_PARSE_ERR_001: Non-JSON response received:', text.substring(0, 200));
                    throw new Error('Invalid response format from server');
                }
            } catch (parseError) {
                console.error('REG_PARSE_ERR_002: Failed to parse response:', parseError);
                errorMessage.textContent = 'An error occurred while processing the response. Please try again.';
                errorMessage.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                return;
            }

            if (response.ok && data.success) {
                // Success - show confirmation
                const modalBody = document.querySelector('.registration-modal-body');
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <div style="font-size: 4rem; margin-bottom: 1rem; color: var(--secondary);">✓</div>
                        <h2 style="color: var(--primary); margin-bottom: 1rem;">Registration Successful!</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                            You have successfully registered ${data.registration.numberOfPeople} ${data.registration.numberOfPeople === 1 ? 'person' : 'people'} for this event.
                        </p>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                            A confirmation email will be sent to ${data.registration.email}
                        </p>
                        <button onclick="closeRegistrationModal(); location.reload();" class="btn btn-primary">Close</button>
                    </div>
                `;
                
                // Reload events after a delay to update availability
                setTimeout(() => {
                    if (typeof displayEvents === 'function') {
                        const containerId = document.getElementById('upcoming-events-list') ? 'upcoming-events-list' : 'calendar-events';
                        displayEvents(containerId);
                    }
                }, 2000);
            } else {
                // Error - show error message
                const errorMsg = data.error || data.message || 'Registration failed. Please try again.';
                errorMessage.textContent = `Registration Error: ${errorMsg}`;
                errorMessage.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        } catch (error) {
            console.error('Registration error:', error);
            errorMessage.textContent = 'An error occurred while submitting your registration. Please check your connection and try again.';
            errorMessage.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

// Make functions available globally
window.showRegistrationModal = showRegistrationModal;
window.closeRegistrationModal = closeRegistrationModal;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeRegistrationModal();
});

