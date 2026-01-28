// Attendance Form Handler
const API_BASE_URL = (function() {
  if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = 'http://localhost:3000/api';
  }
  return window.API_BASE_URL;
})();

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('attendance-form');
    
    if (!form) {
        console.error('Attendance form not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        
        // Disable submit button and show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        
        // Remove any existing messages
        const existingMessage = form.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        // Get form data
        const formData = {
            attendanceDate: form.querySelector('#attendanceDate').value,
            firstName: form.querySelector('#firstName').value.trim(),
            lastName: form.querySelector('#lastName').value.trim(),
            email: form.querySelector('#email').value.trim(),
            phone: form.querySelector('#phone').value.trim(),
            companyName: form.querySelector('#companyName')?.value.trim() || null
        };
        
        // Validate date range (7 days ago to today)
        const selectedDate = new Date(formData.attendanceDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0); // Start of 7 days ago
        
        if (selectedDate < sevenDaysAgo || selectedDate > today) {
            showMessage(form, 'Please select a date between 7 days ago and today.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/attendance`, {
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
                    console.error('ATT_PARSE_ERR_001: Non-JSON response received:', text.substring(0, 200));
                    throw new Error('Invalid response format from server');
                }
            } catch (parseError) {
                console.error('ATT_PARSE_ERR_002: Failed to parse response:', parseError);
                showMessage(form, 'An error occurred while processing the response. Please try again.', 'error');
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                return;
            }
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit attendance');
            }
            
            // Show success message
            showMessage(form, 'Attendance submitted successfully! Your certificate is being generated and will be emailed to you shortly.', 'success');
            
            // Reset form after a delay
            setTimeout(() => {
                form.reset();
                // Reset date to today
                const dateInput = form.querySelector('#attendanceDate');
                if (dateInput) {
                    const today = new Date();
                    dateInput.value = today.toISOString().split('T')[0];
                }
            }, 3000);
            
        } catch (error) {
            console.error('Error submitting attendance:', error);
            showMessage(form, error.message || 'An error occurred while submitting attendance. Please try again.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
});

function showMessage(form, message, type) {
    // Remove any existing messages
    const existingMessage = form.querySelector('.form-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `form-message ${type}`;
    messageDiv.style.cssText = `
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 6px;
        font-size: 0.9375rem;
        text-align: center;
        ${type === 'success' 
            ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' 
            : 'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'
        }
    `;
    messageDiv.textContent = message;
    
    form.appendChild(messageDiv);
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

