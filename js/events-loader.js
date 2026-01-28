// Events Loader
// Loads and displays events from backend API (with fallback to data/events.js)
// Fetches availability from backend API and displays events with registration buttons

// API URL - Update this to match your backend deployment
// For local development: 'http://localhost:3000/api'
// For production: 'https://your-backend-url.com/api'
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';

// Fetch events from backend API
async function fetchEventsFromAPI() {
    try {
        const response = await fetch(`${API_BASE_URL}/events`);
        if (!response.ok) {
            console.warn('Failed to fetch events from API:', response.statusText);
            return null;
        }
        const data = await response.json();
        // Transform database events to match frontend format
        const transformed = (data.events || []).map(event => {
            // Map repeat fields from database to frontend format
            let eventRepeats = null;
            if (event.repeat_interval) {
                // Custom interval (every X days)
                eventRepeats = parseInt(event.repeat_interval);
            } else if (event.event_repeats) {
                // Standard repeat type (daily, weekly, monthly)
                eventRepeats = event.event_repeats;
            }
            
            const transformedEvent = {
                id: event.id.toString(),
                name: event.name,
                date: event.date,
                time: event.time,
                length: 180, // Default length (can be added to database schema later)
                location: event.location || '',
                additionalDetails: event.description || '',
                registrationLimit: event.registration_enabled ? event.capacity : null,
                eventRepeats: eventRepeats,
                repeatEnds: event.repeat_ends || null
            };
            
            // Debug logging
            if (eventRepeats) {
                console.log(`Event "${event.name}" (ID: ${event.id}) - Repeats: ${eventRepeats}, Interval: ${event.repeat_interval}, Ends: ${event.repeat_ends}`);
            }
            
            return transformedEvent;
        });
        
        console.log(`Loaded ${transformed.length} events from API`);
        return transformed;
    } catch (error) {
        console.warn('Error fetching events from API:', error);
        return null;
    }
}

// Expand repeating events into individual instances
function expandRepeatingEvents(events, maxDaysAhead = 14) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + maxDaysAhead);
    
    const expandedEvents = [];
    
    events.forEach(event => {
        // Parse date string (YYYY-MM-DD) as local date, not UTC
        const [year, month, day] = event.date.split('-').map(Number);
        const baseDate = new Date(year, month - 1, day);
        baseDate.setHours(0, 0, 0, 0);
        
        // Parse repeatEnds date string as local date, not UTC
        let repeatEnds = null;
        if (event.repeatEnds) {
            const [endYear, endMonth, endDay] = event.repeatEnds.split('-').map(Number);
            repeatEnds = new Date(endYear, endMonth - 1, endDay);
            repeatEnds.setHours(23, 59, 59, 999);
        }
        
        if (!event.eventRepeats) {
            // Single event - add if within date range
            if (baseDate >= today && baseDate <= endDate) {
                expandedEvents.push({ ...event, instanceDate: event.date });
            }
        } else {
            // Repeating event - generate instances
            let currentDate = new Date(baseDate);
            const instances = [];
            
            // If base date is in the past, fast-forward to the first future occurrence
            if (currentDate < today) {
                // Calculate how many intervals have passed
                const daysDiff = Math.floor((today - currentDate) / (1000 * 60 * 60 * 24));
                
                if (event.eventRepeats === 'daily') {
                    // Fast-forward to today or next occurrence
                    const intervalsPassed = daysDiff;
                    currentDate.setDate(currentDate.getDate() + intervalsPassed);
                    // If still in past, add one more interval
                    if (currentDate < today) {
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                } else if (event.eventRepeats === 'weekly') {
                    const intervalsPassed = Math.floor(daysDiff / 7);
                    currentDate.setDate(currentDate.getDate() + (intervalsPassed * 7));
                    // If still in past, add one more week
                    if (currentDate < today) {
                        currentDate.setDate(currentDate.getDate() + 7);
                    }
                } else if (event.eventRepeats === 'monthly') {
                    // For monthly, just keep adding months until we're at or past today
                    while (currentDate < today) {
                        currentDate.setMonth(currentDate.getMonth() + 1);
                    }
                } else if (typeof event.eventRepeats === 'number' && event.eventRepeats > 0) {
                    // Integer value = repeat every N days
                    const intervalsPassed = Math.floor(daysDiff / event.eventRepeats);
                    currentDate.setDate(currentDate.getDate() + (intervalsPassed * event.eventRepeats));
                    // If still in past, add one more interval
                    if (currentDate < today) {
                        currentDate.setDate(currentDate.getDate() + event.eventRepeats);
                    }
                }
            }
            
            // Generate instances up to endDate or until repeatEnds
            // Compare dates properly (ignore time component) by comparing date strings
            const getDateString = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            const endDateStr = getDateString(endDate);
            const repeatEndsStr = repeatEnds ? getDateString(repeatEnds) : null;
            const todayStr = getDateString(today);
            
            let loopCount = 0;
            while (true) {
                loopCount++;
                if (loopCount > 1000) {
                    // Safety limit to prevent infinite loops
                    break;
                }
                
                const currentDateStr = getDateString(currentDate);
                
                // Check if we've exceeded our limits
                if (currentDateStr > endDateStr) break;
                if (repeatEndsStr && currentDateStr > repeatEndsStr) break;
                
                // Add instance if it's today or in the future
                if (currentDateStr >= todayStr) {
                    instances.push(new Date(currentDate));
                }
                
                // Calculate next occurrence based on repeat type
                if (event.eventRepeats === 'daily') {
                    currentDate.setDate(currentDate.getDate() + 1);
                } else if (event.eventRepeats === 'weekly') {
                    currentDate.setDate(currentDate.getDate() + 7);
                } else if (event.eventRepeats === 'monthly') {
                    currentDate.setMonth(currentDate.getMonth() + 1);
                } else if (typeof event.eventRepeats === 'number' && event.eventRepeats > 0) {
                    // Integer value = repeat every N days
                    currentDate.setDate(currentDate.getDate() + event.eventRepeats);
                } else {
                    break; // Unknown repeat type
                }
            }
            
            // Create event instances
            instances.forEach(instanceDate => {
                const instanceDateStr = instanceDate.toISOString().split('T')[0];
                expandedEvents.push({
                    ...event,
                    instanceDate: instanceDateStr,
                    originalDate: event.date
                });
            });
        }
    });
    
    const sorted = expandedEvents.sort((a, b) => {
        // Sort by instance date, then by time
        const dateCompare = new Date(a.instanceDate || a.date) - new Date(b.instanceDate || b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
    });
    
    console.log(`Expanded ${events.length} events into ${sorted.length} instances (maxDaysAhead: ${maxDaysAhead})`);
    return sorted;
}

// Get events for the next 2 weeks
function getNextTwoWeeksEvents(events) {
    return expandRepeatingEvents(events, 14); // 2 weeks = 14 days
}

// Get all upcoming events (no 2-week limit, but limit to 6 months ahead for performance)
function getAllUpcomingEvents(events) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Expand events up to 6 months ahead (180 days) for calendar/training pages
    const expandedEvents = expandRepeatingEvents(events, 180);
    
    // Filter to only show future events (should already be filtered, but double-check)
    return expandedEvents.filter(event => {
        const eventDate = new Date(event.instanceDate || event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
    }).sort((a, b) => {
        // Sort by date, then by time
        const dateCompare = new Date(a.instanceDate || a.date) - new Date(b.instanceDate || b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
    });
}

// Format time from 24-hour to 12-hour format
function formatTime(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Format date to readable format
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format length in minutes to readable format
function formatLength(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`;
}

// Fetch event availability from backend
async function fetchEventAvailability(eventId, instanceDate = null) {
    try {
        // Ensure eventId is a number (database uses integer IDs)
        const id = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId;
        if (isNaN(id)) {
            return null;
        }
        let url = `${API_BASE_URL}/events/${id}/availability`;
        if (instanceDate) {
            url += `?instanceDate=${instanceDate}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            // Silently fail if backend is not available or event not found
            return null;
        }
        return await response.json();
    } catch (error) {
        // Silently fail if backend is not available (expected in development)
        return null;
    }
}

// Display events on any page
async function displayEvents(containerId = 'upcoming-events-list', filterType = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Try to fetch events from API first, fallback to window.eventsData
    let allEvents = await fetchEventsFromAPI();
    if (!allEvents || allEvents.length === 0) {
        // Fallback to static events.js if API unavailable or returns no events
        if (typeof window.eventsData !== 'undefined') {
            allEvents = window.eventsData;
        } else {
            container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No events data available.</p>';
            return;
        }
    }
    
    // Filter events based on page type
    let filteredEvents = allEvents;
    if (filterType === 'training') {
        // Filter for training-related events (you can customize this logic)
        filteredEvents = allEvents.filter(event => 
            event.name.toLowerCase().includes('training') || 
            event.name.toLowerCase().includes('workshop') ||
            event.name.toLowerCase().includes('session')
        );
    }
    
    // For home page, show next 2 weeks. For other pages, show all upcoming events
    const upcomingEvents = containerId === 'upcoming-events-list' 
        ? getNextTwoWeeksEvents(filteredEvents)
        : getAllUpcomingEvents(filteredEvents);

    if (upcomingEvents.length === 0) {
        const message = containerId === 'upcoming-events-list' 
            ? 'No upcoming events in the next 2 weeks.'
            : 'No upcoming events found.';
        container.innerHTML = `<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">${message}</p>`;
        return;
    }

    let html = '<div class="events-list" style="max-width: 900px; margin: 0 auto;">';

    // Fetch availability for each event instance (for repeating events, each instance needs its own count)
    // Group by event ID and instance date to fetch availability per instance
    const eventsWithLimit = upcomingEvents.filter(e => e.registrationLimit);
    
    // Fetch availability for each unique event instance
    const availabilityMap = new Map();
    const availabilityPromises = eventsWithLimit.map(async (event) => {
        const eventId = event.id;
        const instanceDate = event.instanceDate || event.date; // Use instanceDate for repeating events
        const key = `${eventId}-${instanceDate}`; // Unique key for this instance
        const availability = await fetchEventAvailability(eventId, instanceDate);
        return { key, availability };
    });
    
    const availabilityResults = await Promise.all(availabilityPromises);
    availabilityResults.forEach(({ key, availability }) => {
        if (availability) {
            availabilityMap.set(key, availability);
        }
    });

    upcomingEvents.forEach((event) => {
        const instanceDate = event.instanceDate || event.date;
        const availabilityKey = `${event.id}-${instanceDate}`;
        const availability = availabilityMap.get(availabilityKey) || null;
        // Use instanceDate for repeating events, otherwise use date
        const displayDate = event.instanceDate || event.date;
        const eventDate = new Date(displayDate);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[eventDate.getMonth()];
        const day = eventDate.getDate();

        html += '<div class="event-card" style="display: flex; gap: 2rem; background: white; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">';
        
        // Date display
        html += `<div class="event-date" style="flex-shrink: 0; text-align: center; min-width: 80px;">`;
        html += `<div class="event-month" style="font-size: 0.875rem; font-weight: 600; color: var(--primary); text-transform: uppercase;">${month}</div>`;
        html += `<div class="event-day" style="font-size: 2rem; font-weight: 700; color: var(--text-primary); line-height: 1;">${day}</div>`;
        html += `</div>`;

        // Event details
        html += `<div class="event-details" style="flex: 1;">`;
        html += `<h3 style="font-size: 1.5rem; margin-bottom: 0.75rem; color: var(--text-primary);">${event.name}</h3>`;
        
        html += `<p class="event-meta" style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.9375rem;">`;
        html += `<span>${formatDate(displayDate)}</span>`;
        html += `<span>${formatTime(event.time)}</span>`;
        html += `<span>${event.location}</span>`;
        html += `<span>${formatLength(event.length)}</span>`;
        if (event.eventRepeats) {
            let repeatLabel;
            if (typeof event.eventRepeats === 'number') {
                if (event.eventRepeats === 1) {
                    repeatLabel = 'Daily';
                } else if (event.eventRepeats === 7) {
                    repeatLabel = 'Weekly';
                } else {
                    repeatLabel = `Every ${event.eventRepeats} days`;
                }
            } else {
                repeatLabel = event.eventRepeats.charAt(0).toUpperCase() + event.eventRepeats.slice(1);
            }
            html += `<span style="color: var(--primary); font-weight: 500;">Repeats ${repeatLabel}</span>`;
        }
        html += `</p>`;

        if (event.additionalDetails) {
            html += `<p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem;">${event.additionalDetails}</p>`;
        }

        // Registration button and availability
        if (event.registrationLimit !== null) {
            if (availability) {
                const isFull = availability.isFull || availability.registered >= event.registrationLimit;
                const available = availability.available || (event.registrationLimit - availability.registered);
                
                html += `<div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">`;
                
                if (isFull) {
                    html += `<span style="padding: 0.5rem 1rem; background: var(--bg-light); color: var(--text-secondary); border-radius: 6px; font-size: 0.875rem; font-weight: 600;">Booked</span>`;
                } else {
                    html += `<span style="padding: 0.5rem 1rem; background: var(--bg-light); color: var(--text-secondary); border-radius: 6px; font-size: 0.875rem;">${available} spot${available === 1 ? '' : 's'} available</span>`;
                    const instanceDate = event.instanceDate || event.date;
                    html += `<button onclick="showRegistrationModal('${event.id}', '${instanceDate}')" class="btn btn-primary" style="cursor: pointer; border: none;">Register</button>`;
                }
                
                html += `</div>`;
            } else {
                // Fallback if API is unavailable
                const instanceDate = event.instanceDate || event.date;
                html += `<button onclick="showRegistrationModal('${event.id}', '${instanceDate}')" class="btn btn-primary" style="cursor: pointer; border: none;">Register</button>`;
            }
        }

        html += `</div>`;
        html += `</div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Home page - show next 2 weeks
    if (document.getElementById('upcoming-events-list')) {
        displayEvents('upcoming-events-list');
    }
    
    // Calendar/Training pages - show all upcoming events
    if (document.getElementById('calendar-events')) {
        // Check if we're on training page
        const isTrainingPage = window.location.pathname.includes('training.html');
        displayEvents('calendar-events', isTrainingPage ? 'training' : null);
    }
});

