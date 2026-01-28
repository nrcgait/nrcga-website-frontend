// Registration Form Handler
// Handles form submission to backend API

var API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Load event details if eventId is provided
async function loadEventDetails(eventId) {
    if (!eventId) return null;

    try {
        // First try to get from API (source of truth)
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

// Initialize registration form
async function initializeRegistrationForm() {
    const form = document.getElementById('attendance-form');
    if (!form) return;

    const eventId = getUrlParameter('eventId');
    const instanceDate = getUrlParameter('instanceDate');
    
    // Load and display event details
    if (eventId) {
        const event = await loadEventDetails(eventId);
        if (event) {
            // Use instance date if provided (for repeating events), otherwise use event date
            const displayDate = instanceDate || event.date;
            
            // Update page title/header with event name
            const header = document.querySelector('.compact-header h1');
            if (header) {
                header.textContent = `Register for ${event.name}`;
            }

            // Add event info display
            const formContainer = form.parentElement;
            const eventInfo = document.createElement('div');
            eventInfo.style.cssText = 'background: var(--bg-light); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;';
            eventInfo.innerHTML = `
                <h3 style="margin: 0 0 0.75rem 0; color: var(--text-primary);">Event Details</h3>
                <p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Date:</strong> ${formatEventDate(displayDate)}</p>
                <p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Time:</strong> ${formatEventTime(event.time)}</p>
                ${event.location ? `<p style="margin: 0.5rem 0; color: var(--text-secondary);"><strong>Location:</strong> ${event.location}</p>` : ''}
            `;
            formContainer.insertBefore(eventInfo, form);

            // Store eventId in a hidden field
            const hiddenEventId = document.createElement('input');
            hiddenEventId.type = 'hidden';
            hiddenEventId.name = 'eventId';
            hiddenEventId.value = eventId;
            form.appendChild(hiddenEventId);
        }
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        // Get form data
        const eventInstanceDate = getUrlParameter('instanceDate');
        const formData = {
            eventId: parseInt(getUrlParameter('eventId') || form.querySelector('input[name="eventId"]')?.value),
            eventInstanceDate: eventInstanceDate || null, // Pass instance date for repeating events
            firstName: form.querySelector('#firstName').value.trim(),
            lastName: form.querySelector('#lastName').value.trim(),
            email: form.querySelector('#email').value.trim(),
            phone: form.querySelector('#phone').value.trim(),
            numberOfPeople: parseInt(form.querySelector('#numberOfPeople').value) || 1,
            companyName: form.querySelector('#companyName')?.value.trim() || null,
            reasonForTraining: form.querySelector('#reasonForTraining').value,
            reasonOtherExplanation: form.querySelector('#reasonOtherExplanation')?.value.trim() || null,
            comments: form.querySelector('#comments')?.value.trim() || null
        };

        // Validate required fields
        if (!formData.eventId) {
            alert('Error: Event ID is missing. Please access this page from an event registration link.');
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

            const data = await response.json();

            if (response.ok && data.success) {
                // Success - show confirmation
                form.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">✓</div>
                        <h2 style="color: var(--primary); margin-bottom: 1rem;">Registration Successful!</h2>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                            You have successfully registered ${data.registration.numberOfPeople} ${data.registration.numberOfPeople === 1 ? 'person' : 'people'} for this event.
                        </p>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                            A confirmation email will be sent to ${data.registration.email}
                        </p>
                        <a href="index.html" class="btn btn-primary" style="text-decoration: none;">Return to Home</a>
                    </div>
                `;
            } else {
                // Error - show error message
                const errorMsg = data.error || data.message || 'Registration failed. Please try again.';
                alert(`Registration Error: ${errorMsg}`);
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('An error occurred while submitting your registration. Please check your connection and try again.');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeRegistrationForm();
});

