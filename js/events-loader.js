// Events Loader
// Loads and displays events from backend API (with fallback to data/events.js)
// Fetches availability from backend API and displays events with registration buttons

// API URL - Update this to match your backend deployment
// For local development: 'http://localhost:3000/api'
// For production: 'https://your-backend-url.com/api'
var API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxedrS__W258karGEE_SZDN8vnCYLa82TjSoUWyZKtm4SzwlkLvU6UXCsfTUBpe7C_PaA/exec';

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

// Fetch events from Google Apps Script (Google Sheet)
async function fetchEventsFromGoogleSheet() {
    try {
        // Use JSONP to avoid CORS issues
        return new Promise((resolve, reject) => {
            // Create callback function
            const callbackName = 'handleEvents_' + Date.now();
            
            // Set a timeout (10 seconds)
            const timeout = setTimeout(() => {
                delete window[callbackName];
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
                reject(new Error('Timeout: Failed to load events from Google Sheet'));
            }, 10000);
            
            window[callbackName] = function(data) {
                clearTimeout(timeout);
                delete window[callbackName];
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
                console.log('Received data from Google Sheet:', data);
                if (data.success && data.events) {
                    resolve(data.events);
                } else {
                    reject(new Error(data.error || 'Failed to fetch events'));
                }
            };
            
            // Create script tag for JSONP
            const script = document.createElement('script');
            const url = `${API_BASE_URL}?callback=${callbackName}`;
            console.log('Loading events from:', url);
            script.src = url;
            script.onerror = (error) => {
                clearTimeout(timeout);
                delete window[callbackName];
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
                console.error('Script load error:', error);
                reject(new Error('Failed to load events from Google Sheet - script failed to load'));
            };
            document.body.appendChild(script);
        });
    } catch (error) {
        console.error('Error fetching events from Google Sheet:', error);
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
        console.log(`Processing event: ${event.name}, date: ${event.date}, repeats: ${event.eventRepeats}`);
        
        // Parse date - handle both YYYY-MM-DD format and Date object strings
        if (!event.date) {
            console.warn(`Event ${event.name} has no date field!`, event);
            return;
        }
        
        let baseDate;
        let dateStr;
        
        // Check if date is already a Date object or a formatted date string
        if (event.date instanceof Date) {
            baseDate = new Date(event.date);
            baseDate.setHours(0, 0, 0, 0);
            dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
        } else if (typeof event.date === 'string') {
            // Try to parse as YYYY-MM-DD first
            if (event.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = event.date.split('-').map(Number);
                baseDate = new Date(year, month - 1, day);
                baseDate.setHours(0, 0, 0, 0);
                dateStr = event.date;
            } else {
                // Try to parse as a date string (e.g., "Mon Feb 02 2026 00:00:00 GMT-0800")
                baseDate = new Date(event.date);
                if (isNaN(baseDate.getTime())) {
                    console.warn(`Event ${event.name} has invalid date format: ${event.date}`, event);
                    return;
                }
                baseDate.setHours(0, 0, 0, 0);
                dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
            }
        } else {
            console.warn(`Event ${event.name} has unexpected date type: ${typeof event.date}`, event);
            return;
        }
        
        console.log(`Parsed date: ${dateStr} from original: ${event.date}`);
        
        // Parse repeatEnds date string as local date, not UTC
        let repeatEnds = null;
        if (event.repeatEnds) {
            if (event.repeatEnds instanceof Date) {
                repeatEnds = new Date(event.repeatEnds);
            } else if (typeof event.repeatEnds === 'string') {
                if (event.repeatEnds.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    const [endYear, endMonth, endDay] = event.repeatEnds.split('-').map(Number);
                    repeatEnds = new Date(endYear, endMonth - 1, endDay);
                } else {
                    repeatEnds = new Date(event.repeatEnds);
                }
            }
            if (repeatEnds && !isNaN(repeatEnds.getTime())) {
                repeatEnds.setHours(23, 59, 59, 999);
            } else {
                repeatEnds = null;
            }
        }
        
        if (!event.eventRepeats) {
            // Single event - add if within date range
            // Compare dates as strings to avoid timezone issues
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
            
            console.log(`Single event check: baseDateStr=${dateStr}, todayStr=${todayStr}, endDateStr=${endDateStr}`);
            console.log(`Date comparison: ${dateStr} >= ${todayStr} = ${dateStr >= todayStr}, ${dateStr} <= ${endDateStr} = ${dateStr <= endDateStr}`);
            
            if (dateStr >= todayStr && dateStr <= endDateStr) {
                expandedEvents.push({ ...event, instanceDate: dateStr, date: dateStr });
                console.log(`✓ Added single event: ${event.name} on ${dateStr}`);
            } else {
                console.log(`✗ Skipped single event: ${event.name} on ${dateStr} (outside range: today=${todayStr}, end=${endDateStr})`);
            }
        } else {
            // Repeating event - generate instances
            let currentDate = new Date(baseDate);
            const instances = [];
            
            console.log(`Repeating event: ${event.name}, baseDate=${dateStr}, repeatType=${event.eventRepeats}, today=${today.toISOString().split('T')[0]}`);
            
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
            console.log(`Generated ${instances.length} instances for repeating event ${event.name}`);
            instances.forEach(instanceDate => {
                const instanceDateStr = instanceDate.toISOString().split('T')[0];
                expandedEvents.push({
                    ...event,
                    instanceDate: instanceDateStr,
                    date: dateStr, // Normalize the date field
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

// Check if registration is still open for an event
// Returns true if registration is open, false if past cutoff
function isRegistrationOpen(event, instanceDate = null) {
    // If event has no registration limit, registration is always open
    if (event.registrationLimit === null || event.registrationLimit === undefined) {
        return true;
    }
    
    // Get the event date (use instanceDate for repeating events)
    const eventDateStr = instanceDate || event.instanceDate || event.date;
    if (!eventDateStr) {
        return false;
    }
    
    // Parse event date and time
    const [year, month, day] = eventDateStr.split('-').map(Number);
    const eventDateTime = new Date(year, month - 1, day);
    
    // Parse event time (HH:MM format)
    if (event.time) {
        const [hours, minutes] = event.time.split(':').map(Number);
        eventDateTime.setHours(hours, minutes, 0, 0);
    } else {
        // Default to start of day if no time specified
        eventDateTime.setHours(0, 0, 0, 0);
    }
    
    // Registration cutoff: 24 hours before event start time
    // You can adjust this (e.g., 48 hours, or a specific time like "end of previous day")
    const cutoffHours = 24;
    const cutoffTime = new Date(eventDateTime);
    cutoffTime.setHours(cutoffTime.getHours() - cutoffHours);
    
    // Check if current time is before cutoff
    const now = new Date();
    const isOpen = now < cutoffTime;
    
    return isOpen;
}

// Calendar view state
let currentView = 'list'; // 'list', 'month', 'week'
let currentDate = new Date(); // Current month/week being viewed

// Cache for events to avoid reloading on view switches
let cachedEvents = null;
let cacheTimestamp = null;
const CACHE_DURATION = 15 * 60 * 1000; // 5 minutes

// Switch between calendar views
function switchCalendarView(view) {
    currentView = view;
    
    // Update button states
    const buttons = {
        'list': document.getElementById('view-list-btn'),
        'week': document.getElementById('view-week-btn'),
        'month': document.getElementById('view-month-btn')
    };
    
    Object.keys(buttons).forEach(key => {
        if (buttons[key]) {
            if (key === view) {
                buttons[key].classList.add('active', 'calendar-view-btn');
            } else {
                buttons[key].classList.remove('active');
                if (!buttons[key].classList.contains('calendar-view-btn')) {
                    buttons[key].classList.add('calendar-view-btn');
                }
            }
        }
    });
    
    const container = document.getElementById('calendar-events');
    if (container) {
        // Re-render with new view (will use cached events if available)
        displayEvents('calendar-events', null, view);
    }
}

// Navigate calendar (previous/next month or week)
function navigateCalendar(direction) {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction * 7));
    }
    displayEvents('calendar-events');
}

// Render monthly calendar view
function renderMonthlyCalendar(events, container) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Group events by date
    const eventsByDate = new Map();
    events.forEach(event => {
        const eventDate = new Date(event.instanceDate || event.date);
        if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
            const day = eventDate.getDate();
            if (!eventsByDate.has(day)) {
                eventsByDate.set(day, []);
            }
            eventsByDate.get(day).push(event);
        }
    });
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    let html = '<div class="calendar-view-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">';
    html += `<button onclick="navigateCalendar(-1)" class="btn btn-secondary" style="cursor: pointer;">← Previous</button>`;
    html += `<h2 style="margin: 0; color: var(--text-primary);">${monthNames[month]} ${year}</h2>`;
    html += `<button onclick="navigateCalendar(1)" class="btn btn-secondary" style="cursor: pointer;">Next →</button>`;
    html += '</div>';
    
    html += '<div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">';
    
    // Day headers
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header" style="background: var(--bg-secondary); padding: 0.75rem; text-align: center; font-weight: 600; color: var(--text-primary);">${day}</div>`;
    });
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day-empty" style="background: white; min-height: 100px;"></div>';
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEvents = eventsByDate.get(day) || [];
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        
        html += `<div class="calendar-day ${isToday ? 'today' : ''}" style="background: white; min-height: 100px; padding: 0.5rem; border-left: ${isToday ? '3px solid var(--primary)' : 'none'};">`;
        html += `<div class="calendar-day-number" style="font-weight: 600; color: ${isToday ? 'var(--primary)' : 'var(--text-primary)'}; margin-bottom: 0.5rem;">${day}</div>`;
        
        // Show events for this day (limit to 3, show "+X more" if more)
        const eventsToShow = dayEvents.slice(0, 3);
        const moreCount = dayEvents.length - 3;
        
        eventsToShow.forEach(event => {
            const instanceDate = event.instanceDate || event.date;
            const registrationOpen = isRegistrationOpen(event, instanceDate);
            const eventTitle = registrationOpen ? event.name : `${event.name} (Registration Closed)`;
            const bgColor = registrationOpen ? 'var(--primary)' : '#999';
            html += `<div class="calendar-event" onclick="showEventDetails('${event.id}', '${instanceDate}')" style="background: ${bgColor}; color: white; padding: 0.25rem 0.5rem; margin-bottom: 0.25rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${eventTitle}">${event.name}</div>`;
        });
        
        if (moreCount > 0) {
            html += `<div style="font-size: 0.75rem; color: var(--text-secondary); padding: 0.25rem;">+${moreCount} more</div>`;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Render weekly calendar view
function renderWeeklyCalendar(events, container) {
    // Get start of week (Sunday)
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // Get end of week (Saturday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Group events by date
    const eventsByDate = new Map();
    events.forEach(event => {
        const eventDate = new Date(event.instanceDate || event.date);
        if (eventDate >= weekStart && eventDate <= weekEnd) {
            const dateKey = eventDate.toDateString();
            if (!eventsByDate.has(dateKey)) {
                eventsByDate.set(dateKey, []);
            }
            eventsByDate.get(dateKey).push(event);
        }
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    let html = '<div class="calendar-view-controls" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">';
    html += `<button onclick="navigateCalendar(-1)" class="btn btn-secondary" style="cursor: pointer;">← Previous Week</button>`;
    html += `<h2 style="margin: 0; color: var(--text-primary);">${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}</h2>`;
    html += `<button onclick="navigateCalendar(1)" class="btn btn-secondary" style="cursor: pointer;">Next Week →</button>`;
    html += '</div>';
    
    html += '<div class="weekly-calendar" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1rem;">';
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayEvents = eventsByDate.get(day.toDateString()) || [];
        const isToday = new Date().toDateString() === day.toDateString();
        
        html += `<div class="weekly-day ${isToday ? 'today' : ''}" style="background: white; border-radius: 8px; padding: 1rem; box-shadow: var(--shadow-sm); border: ${isToday ? '2px solid var(--primary)' : '1px solid var(--border)'};">`;
        html += `<div class="weekly-day-header" style="margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);">`;
        html += `<div style="font-size: 0.875rem; color: var(--text-secondary); text-transform: uppercase;">${dayNames[i]}</div>`;
        html += `<div style="font-size: 1.5rem; font-weight: 700; color: ${isToday ? 'var(--primary)' : 'var(--text-primary)'};">${day.getDate()}</div>`;
        html += `</div>`;
        
        if (dayEvents.length === 0) {
            html += `<div style="color: var(--text-light); font-size: 0.875rem; text-align: center; padding: 1rem;">No events</div>`;
        } else {
            dayEvents.forEach(event => {
                const instanceDate = event.instanceDate || event.date;
                const registrationOpen = isRegistrationOpen(event, instanceDate);
                const borderColor = registrationOpen ? 'var(--primary)' : '#999';
                html += `<div class="weekly-event" onclick="showEventDetails('${event.id}', '${instanceDate}')" style="background: var(--bg-secondary); padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 6px; cursor: pointer; border-left: 3px solid ${borderColor};">`;
                html += `<div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${event.name}${!registrationOpen ? ' <span style="color: #999; font-size: 0.75rem;">(Registration Closed)</span>' : ''}</div>`;
                html += `<div style="font-size: 0.875rem; color: var(--text-secondary);">${formatTime(event.time)} • ${event.location}</div>`;
                html += `</div>`;
            });
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Show event details (can be a modal or expand)
function showEventDetails(eventId, instanceDate) {
    // You can implement a modal here or navigate to event details
    console.log('Show event details:', eventId, instanceDate);
    // For now, you could trigger the registration modal or show more info
    // If registration is available, show the modal
    if (typeof showRegistrationModal === 'function') {
        showRegistrationModal(eventId, instanceDate);
    }
}

// Fetch event availability from backend
async function fetchEventAvailability(eventId, instanceDate = null) {
    try {
        // Ensure eventId is a number
        const id = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId;
        if (isNaN(id)) {
            return null;
        }
        
        // Use Apps Script for availability check
        let url = `${API_BASE_URL}?eventId=${id}&action=availability`;
        if (instanceDate) {
            url += `&instanceDate=${instanceDate}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            // Silently fail if backend is not available or event not found
            return null;
        }
        
        const data = await response.json();
        
        if (data.success) {
            return {
                available: data.available,
                registered: data.registered,
                isFull: data.isFull,
                capacity: data.capacity
            };
        }
        return null;
    } catch (error) {
        // Silently fail if backend is not available (expected in development)
        return null;
    }
}

// Display events on any page
async function displayEvents(containerId = 'upcoming-events-list', filterType = null, viewType = null, forceReload = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Use viewType parameter or currentView state
    const view = viewType || (containerId === 'calendar-events' ? currentView : 'list');

    // Check cache first (unless force reload or cache expired)
    let allEvents = null;
    const now = Date.now();
    const useCache = !forceReload && cachedEvents && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;
    
    if (useCache) {
        console.log('Using cached events');
        allEvents = cachedEvents;
    } else {
        console.log('Fetching events from source...');
        // Try to fetch events from API first, fallback to CSV  
        allEvents = await fetchEventsFromGoogleSheet();
        console.log('allEvents from Google Sheet:', allEvents);
        console.log('allEvents type:', typeof allEvents, 'is array:', Array.isArray(allEvents));
        if (allEvents && allEvents.length > 0) {
            console.log('First event structure:', allEvents[0]);
        }
        
        if (!allEvents || allEvents.length === 0) {
            // Fallback to CSV if API unavailable or returns no events
            console.log('Falling back to CSV...');
            try {
                const csvEvents = await loadCSV('data/events.csv');
                console.log('CSV events loaded:', csvEvents);
                // Convert CSV data to match event format (handle numeric fields)
                allEvents = csvEvents.map(event => ({
                    ...event,
                    id: event.id.toString(),
                    length: parseInt(event.length) || 180,
                    // Map regLimit to registrationLimit for consistency
                    registrationLimit: (event.registrationLimit || event.regLimit) ? parseInt(event.registrationLimit || event.regLimit) : null,
                    eventRepeats: event.eventRepeats ? (isNaN(event.eventRepeats) ? event.eventRepeats : parseInt(event.eventRepeats)) : null
                }));
                console.log('Processed CSV events:', allEvents);
            } catch (error) {
                console.error('Error loading events from CSV:', error);
                container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No events data available.</p>';
                return;
            }
        }
    }
    
    // Ensure all events have required fields and normalize dates
    // Only normalize if not using cache (cache already has normalized events)
    if (allEvents && allEvents.length > 0 && !useCache) {
        allEvents = allEvents.map(event => {
            // Normalize date to YYYY-MM-DD format
            let normalizedDate = '';
            if (event.date) {
                if (event.date instanceof Date) {
                    normalizedDate = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}-${String(event.date.getDate()).padStart(2, '0')}`;
                } else if (typeof event.date === 'string') {
                    if (event.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        normalizedDate = event.date;
                    } else {
                        // Try to parse as date string
                        const parsedDate = new Date(event.date);
                        if (!isNaN(parsedDate.getTime())) {
                            normalizedDate = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                        }
                    }
                }
            }
            
            // Normalize repeatEnds date
            let normalizedRepeatEnds = null;
            if (event.repeatEnds) {
                if (event.repeatEnds instanceof Date) {
                    normalizedRepeatEnds = `${event.repeatEnds.getFullYear()}-${String(event.repeatEnds.getMonth() + 1).padStart(2, '0')}-${String(event.repeatEnds.getDate()).padStart(2, '0')}`;
                } else if (typeof event.repeatEnds === 'string') {
                    if (event.repeatEnds.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        normalizedRepeatEnds = event.repeatEnds;
                    } else {
                        const parsedDate = new Date(event.repeatEnds);
                        if (!isNaN(parsedDate.getTime())) {
                            normalizedRepeatEnds = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                        }
                    }
                }
            }
            
            return {
                id: event.id ? event.id.toString() : '',
                name: event.name || 'Unnamed Event',
                date: normalizedDate,
                time: event.time || '00:00',
                length: parseInt(event.length) || 180,
                location: event.location || '',
                additionalDetails: event.additionalDetails || event.description || '',
                // Map regLimit to registrationLimit for consistency
                registrationLimit: (event.registrationLimit || event.regLimit) ? parseInt(event.registrationLimit || event.regLimit) : null,
                eventRepeats: event.eventRepeats ? (isNaN(event.eventRepeats) ? event.eventRepeats : parseInt(event.eventRepeats)) : null,
                repeatEnds: normalizedRepeatEnds
            };
        });
        console.log('Normalized events:', allEvents);
        
        // Cache the normalized events
        cachedEvents = allEvents;
        cacheTimestamp = Date.now();
        // Expose cached events globally for other scripts to use
        window.cachedEvents = allEvents;
        console.log('Events cached');
    } else if (useCache) {
        console.log('Using cached normalized events');
        // Update global cache reference
        window.cachedEvents = cachedEvents;
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
    
    // Expand repeating events (use longer range for calendar views)
    // For list view on home page, show 1 month (30 days). For calendar views, show 90 days.
    // For calendar page list view, also show 30 days
    const maxDaysAhead = (view === 'month' || view === 'week') ? 90 : 30;
    const expandedEvents = expandRepeatingEvents(filteredEvents, maxDaysAhead);
    
    console.log(`View: ${view}, Container: ${containerId}, maxDaysAhead: ${maxDaysAhead}`);
    console.log(`Filtered events: ${filteredEvents.length}, Expanded events: ${expandedEvents.length}`);
    
    // Render based on view type
    if (view === 'month' && containerId === 'calendar-events') {
        renderMonthlyCalendar(expandedEvents, container);
        return;
    } else if (view === 'week' && containerId === 'calendar-events') {
        renderWeeklyCalendar(expandedEvents, container);
        return;
    }
    
    // Default list view
    // For home page, show next month (30 days). For other pages, show all upcoming events
    // Parse dates consistently (as local dates, not UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingEvents = containerId === 'upcoming-events-list' 
        ? expandedEvents.filter(event => {
            const dateStr = event.instanceDate || event.date;
            // Parse as local date (YYYY-MM-DD)
            const [year, month, day] = dateStr.split('-').map(Number);
            const eventDate = new Date(year, month - 1, day);
            eventDate.setHours(0, 0, 0, 0);
            
            const oneMonthFromNow = new Date(today);
            oneMonthFromNow.setDate(today.getDate() + 30);
            return eventDate >= today && eventDate <= oneMonthFromNow;
          })
        : expandedEvents.filter(event => {
            const dateStr = event.instanceDate || event.date;
            // Parse as local date (YYYY-MM-DD)
            const [year, month, day] = dateStr.split('-').map(Number);
            const eventDate = new Date(year, month - 1, day);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= today;
          });

    console.log(`Filtered events: ${expandedEvents.length} expanded -> ${upcomingEvents.length} upcoming`);
    console.log('Upcoming events:', upcomingEvents);
    console.log('Today:', today.toISOString());
    if (expandedEvents.length > 0) {
        console.log('First expanded event date:', expandedEvents[0].instanceDate || expandedEvents[0].date);
        console.log('First expanded event:', expandedEvents[0]);
    }

    if (upcomingEvents.length === 0) {
        // Show more helpful message with debugging info
        let message = containerId === 'upcoming-events-list' 
            ? 'No upcoming events in the next month.'
            : 'No upcoming events found.';
        
        if (expandedEvents.length > 0) {
            message += ` (Found ${expandedEvents.length} events, but none are upcoming)`;
        } else if (filteredEvents.length > 0) {
            message += ` (Found ${filteredEvents.length} events, but none expanded)`;
        } else if (allEvents && allEvents.length > 0) {
            message += ` (Found ${allEvents.length} events, but none matched filters)`;
        }
        
        container.innerHTML = `<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">${message}</p>`;
        return;
    }

    let html = '<div class="events-list" style="max-width: 900px; margin: 0 auto;">';

    // Fetch availability for each event instance (for repeating events, each instance needs its own count)
    // Group by event ID and instance date to fetch availability per instance
    const eventsWithLimit = upcomingEvents.filter(e => e.registrationLimit !== null && e.registrationLimit !== undefined);
    
    // Fetch availability for each unique event instance
    const availabilityMap = new Map();
    if (eventsWithLimit.length > 0) {
        console.log(`Fetching availability for ${eventsWithLimit.length} events with registration limits`);
        const availabilityPromises = eventsWithLimit.map(async (event) => {
            const eventId = event.id;
            const instanceDate = event.instanceDate || event.date; // Use instanceDate for repeating events
            const key = `${eventId}-${instanceDate}`; // Unique key for this instance
            try {
                const availability = await fetchEventAvailability(eventId, instanceDate);
                console.log(`Availability for ${key}:`, availability);
                return { key, availability };
            } catch (error) {
                console.warn(`Failed to fetch availability for event ${eventId}:`, error);
                return { key, availability: null };
            }
        });
        
        const availabilityResults = await Promise.all(availabilityPromises);
        availabilityResults.forEach(({ key, availability }) => {
            if (availability) {
                availabilityMap.set(key, availability);
            }
        });
        console.log(`Availability map size: ${availabilityMap.size}`);
    }

    upcomingEvents.forEach((event) => {
        const instanceDate = event.instanceDate || event.date;
        const availabilityKey = `${event.id}-${instanceDate}`;
        const availability = availabilityMap.get(availabilityKey) || null;
        console.log(`Event ${event.id}: registrationLimit=${event.registrationLimit}, availability=`, availability);
        // Use instanceDate for repeating events, otherwise use date
        const displayDate = event.instanceDate || event.date;
        const eventDate = new Date(displayDate);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[eventDate.getMonth()];
        const day = eventDate.getDate();

        // Make event card clickable
        html += `<div class="event-card" onclick="showRegistrationModal('${event.id}', '${instanceDate}')" style="display: flex; gap: 2rem; background: white; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1))';" onmouseout="this.style.transform=''; this.style.boxShadow='var(--shadow-sm, 0 2px 4px rgba(0,0,0,0.05))';">`;
        
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
        // Removed "Repeats" display from list view as requested
        // Show registration count if event has a limit
        if (event.registrationLimit !== null && event.registrationLimit !== undefined) {
            if (availability) {
                const registered = availability.registered || 0;
                const capacity = availability.capacity || event.registrationLimit;
                html += `<span style="color: var(--text-secondary); font-weight: 500;">${registered} / ${capacity} registered</span>`;
            } else {
                // Show limit even if availability fetch failed
                html += `<span style="color: var(--text-secondary); font-weight: 500;">Capacity: ${event.registrationLimit}</span>`;
            }
        }
        html += `</p>`;

        if (event.additionalDetails) {
            html += `<p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem;">${event.additionalDetails}</p>`;
        }

        // Registration button and availability
        if (event.registrationLimit !== null) {
            const registrationOpen = isRegistrationOpen(event, instanceDate);
            
            if (availability) {
                const isFull = availability.isFull || availability.registered >= event.registrationLimit;
                const available = availability.available || (event.registrationLimit - availability.registered);
                
                html += `<div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">`;
                
                if (isFull) {
                    html += `<span style="padding: 0.5rem 1rem; background: var(--bg-light); color: var(--text-secondary); border-radius: 6px; font-size: 0.875rem; font-weight: 600;">Booked</span>`;
                } else if (!registrationOpen) {
                    html += `<span style="padding: 0.5rem 1rem; background: var(--bg-light); color: var(--text-secondary); border-radius: 6px; font-size: 0.875rem; font-weight: 600;">Registration Closed</span>`;
                } else {
                    html += `<span style="padding: 0.5rem 1rem; background: var(--bg-light); color: var(--text-secondary); border-radius: 6px; font-size: 0.875rem;">${available} spot${available === 1 ? '' : 's'} available</span>`;
                    html += `<button onclick="event.stopPropagation(); showRegistrationModal('${event.id}', '${instanceDate}')" class="btn btn-primary" style="cursor: pointer; border: none;">Register</button>`;
                }
                
                html += `</div>`;
            } else {
                // Fallback if API is unavailable
                if (registrationOpen) {
                    html += `<button onclick="event.stopPropagation(); showRegistrationModal('${event.id}', '${instanceDate}')" class="btn btn-primary" style="cursor: pointer; border: none;">Register</button>`;
                } else {
                    html += `<span style="padding: 0.5rem 1rem; background: var(--bg-light); color: var(--text-secondary); border-radius: 6px; font-size: 0.875rem; font-weight: 600;">Registration Closed</span>`;
                }
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

// Make functions globally accessible
window.switchCalendarView = switchCalendarView;
window.navigateCalendar = navigateCalendar;
window.showEventDetails = showEventDetails;
window.isRegistrationOpen = isRegistrationOpen;
window.fetchEventAvailability = fetchEventAvailability;

