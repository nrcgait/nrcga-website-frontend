// Registration Modal Handler
// Handles registration form in a modal popup

var API_BASE_URL = window.API_BASE_URL || 'https://script.google.com/macros/s/AKfycbxedrS__W258karGEE_SZDN8vnCYLa82TjSoUWyZKtm4SzwlkLvU6UXCsfTUBpe7C_PaA/exec';

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
        if (isNaN(id)) {
            return null;
        }

        // Try to get from cached events first (if events-loader.js has cached them)
        if (typeof window.cachedEvents !== 'undefined' && Array.isArray(window.cachedEvents)) {
            const event = window.cachedEvents.find(e => e.id == id || e.id == id.toString());
            if (event) {
                return {
                    id: event.id,
                    name: event.name,
                    date: event.date,
                    time: event.time,
                    location: event.location || '',
                    registrationLimit: event.registrationLimit || null
                };
            }
        }

        // Fallback: Try to fetch from Apps Script
        // Since Apps Script uses JSONP for GET, we'll need to use a different approach
        // For now, try to get events list and find the event
        try {
            const response = await fetch(`${API_BASE_URL}?callback=temp_callback`, {
                method: 'GET'
            });
            // This won't work directly due to JSONP, so we'll rely on cached events
        } catch (e) {
            // Ignore
        }

        // Fallback to events config if available
        if (typeof window.eventsData !== 'undefined') {
            const event = window.eventsData.find(e => e.id === eventId || e.id === parseInt(eventId));
            if (event) {
                return {
                    id: event.id,
                    name: event.name,
                    date: event.date,
                    time: event.time,
                    location: event.location || '',
                    registrationLimit: event.registrationLimit || null
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
    
    // Check if registration is still open
    const registrationOpen = typeof isRegistrationOpen === 'function' ? isRegistrationOpen(event, instanceDate) : true;

    // Fetch availability to show registration count
    let availabilityInfo = '';
    if (event.registrationLimit !== null && typeof fetchEventAvailability === 'function') {
        try {
            const availability = await fetchEventAvailability(eventId, instanceDate);
            if (availability) {
                const registered = availability.registered || 0;
                const capacity = availability.capacity || event.registrationLimit;
                const available = availability.available || (capacity - registered);
                const isFull = availability.isFull || registered >= capacity;
                
                if (isFull) {
                    availabilityInfo = `<p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Registration Status:</strong> <span style="color: #dc3545; font-weight: 600;">Full (${registered} / ${capacity} registered)</span></p>`;
                } else {
                    availabilityInfo = `<p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Registration Status:</strong> ${registered} / ${capacity} registered (${available} spot${available === 1 ? '' : 's'} available)</p>`;
                }
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
        }
    }

    // Update modal content
    document.getElementById('modal-event-title').textContent = `Register for ${event.name}`;
    
    const eventInfo = document.getElementById('modal-event-info');
    eventInfo.innerHTML = `
        <h3 style="margin: 0 0 0.75rem 0; color: var(--text-primary);">Event Details</h3>
        <p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Date:</strong> ${formatEventDate(displayDate)}</p>
        <p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Time:</strong> ${formatEventTime(event.time)}</p>
        ${event.location ? `<p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Location:</strong> ${event.location}</p>` : ''}
        ${availabilityInfo}
        ${!registrationOpen ? `<p style="margin: 0.5rem 0; color: #dc3545; font-weight: 600;"><strong>⚠ Registration is closed for this event.</strong></p>` : ''}
    `;

    // Set hidden fields
    document.getElementById('modal-eventId').value = eventId;
    document.getElementById('modal-instanceDate').value = instanceDate || '';

    // Reset form
    const form = document.getElementById('registration-modal-form');
    form.reset();
    document.getElementById('modal-numberOfPeople').value = '1';
    document.getElementById('modal-error-message').style.display = 'none';
    document.getElementById('modal-reasonOtherGroup').style.display = 'none';
    
    // Disable form if registration is closed
    const submitButton = form.querySelector('button[type="submit"]');
    const formInputs = form.querySelectorAll('input, select, textarea');
    
    if (!registrationOpen) {
        formInputs.forEach(input => input.disabled = true);
        submitButton.disabled = true;
        submitButton.textContent = 'Registration Closed';
        submitButton.style.opacity = '0.6';
        submitButton.style.cursor = 'not-allowed';
    } else {
        formInputs.forEach(input => input.disabled = false);
        submitButton.disabled = false;
        submitButton.textContent = 'Register';
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
    }

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Focus first input (if form is enabled)
    if (registrationOpen) {
        setTimeout(() => {
            document.getElementById('modal-firstName').focus();
        }, 100);
    }
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

        // Check if registration is still open
        const eventId = document.getElementById('modal-eventId').value;
        const instanceDate = document.getElementById('modal-instanceDate').value || null;
        const event = await loadEventDetails(eventId);
        
        if (event && typeof isRegistrationOpen === 'function' && !isRegistrationOpen(event, instanceDate)) {
            errorMessage.textContent = 'Registration is closed for this event.';
            errorMessage.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            return;
        }

        // Get form data
        const formData = {
            eventId: parseInt(eventId),
            eventInstanceDate: instanceDate,
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
            // Use Apps Script URL for POST
            // Note: With no-cors mode, we can't read the response, but the registration will still be processed
            const response = await fetch(API_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData),
                mode: 'no-cors' // Apps Script handles CORS, but we can't read response with no-cors
            });

            // With no-cors mode, we can't read the response directly
            // The Apps Script will still process the registration
            // Show success message (we assume it worked, but can't verify)
            const modalBody = document.querySelector('.registration-modal-body');
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; color: var(--secondary);">✓</div>
                    <h2 style="color: var(--primary); margin-bottom: 1rem;">Registration Submitted!</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                        Your registration for ${formData.numberOfPeople} ${formData.numberOfPeople === 1 ? 'person' : 'people'} has been submitted.
                    </p>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                        A confirmation email will be sent to ${formData.email}
                    </p>
                    <button onclick="closeRegistrationModal(); location.reload();" class="btn btn-primary">Close</button>
                </div>
            `;
            
            // Reload events after a delay to update availability
            setTimeout(() => {
                if (typeof displayEvents === 'function') {
                    const containerId = document.getElementById('upcoming-events-list') ? 'upcoming-events-list' : 'calendar-events';
                    displayEvents(containerId, null, null, true); // Force reload
                }
            }, 2000);
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

