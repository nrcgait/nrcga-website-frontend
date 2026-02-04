const CONFIG = {
  ORG_NAME: 'NRCGA',
  CALENDAR_ID: 'c3c2f805bd62806527726e9249d3124b0fd48a14078bb2300310ec64fc8b5f28@group.calendar.google.com',

  TAB_SETTINGS: 'Settings',
  TAB_EVENT_CONFIG: 'EventConfig',
  TAB_REGISTRATIONS: 'Registrations',
  TAB_ATTENDANCE: 'Attendance',

  // description markers
  DESC_START: '--- TRAINING REGISTRATION ---',
  DESC_END: '--- /TRAINING REGISTRATION ---',

  // title suffix patterns - matches [Registered: X/Y] or [Registration Closed]
  TITLE_REGISTERED_RE: /\s*\[Registered:\s*\d+\/\d+\]\s*$/,
  TITLE_CLOSED_RE: /\s*\[Registration Closed\]\s*$/,
  TITLE_SUFFIX_RE: /\s*\[(?:Registered:\s*\d+\/\d+|Registration Closed)\]\s*$/,

  // query keys
  Q_PAGE: 'page',
  Q_EVENT_ID: 'eventId',
  Q_EVENT_START: 'eventStartISO',
  Q_TOKEN: 'token',
  Q_KEY: 'key',
};

function doGet(e) {
  const page = getParam_(e, CONFIG.Q_PAGE);

  if (page === 'success') return serveSuccess_(e);
  if (page === 'cancel') return serveCancel_(e);
  if (page === 'admin') return serveAdmin_(e);

  // default: registration page
  return serveRegister_(e);
}

function doPost(e) {
  const action = getParam_(e, 'action');

  if (action === 'register') return handleRegisterPost_(e);
  if (action === 'cancel') return handleCancelPost_(e);

  return HtmlService.createHtmlOutput('Unknown action');
}

function serveRegister_(e) {
  const eventId = getParam_(e, CONFIG.Q_EVENT_ID);
  const eventStartISO = getParam_(e, CONFIG.Q_EVENT_START);

  const tpl = HtmlService.createTemplateFromFile('Register');
  tpl.model = getRegisterModel_(eventId, eventStartISO);
  return tpl.evaluate().setTitle(`${getSetting_('orgName') || CONFIG.ORG_NAME} Training Registration`);
}

function serveSuccess_(e) {
  const tpl = HtmlService.createTemplateFromFile('Success');
  tpl.model = {
    orgName: getSetting_('orgName') || CONFIG.ORG_NAME,
    message: 'Registration confirmed.',
  };
  return tpl.evaluate().setTitle(`${getSetting_('orgName') || CONFIG.ORG_NAME} Registration Success`);
}

function serveCancel_(e) {
  // Cancellation is now handled via email contact
  const orgName = getSetting_('orgName') || CONFIG.ORG_NAME;
  const tpl = HtmlService.createTemplateFromFile('Cancel');
  tpl.model = {
    ok: true,
    orgName: orgName,
    message: 'If you need to make a change or cancel your registration, please email Alexis Walker (awalker@nrcga.org) to make the necessary adjustments.',
  };
  return tpl.evaluate().setTitle(`${orgName} Cancel Registration`);
}

function serveAdmin_(e) {
  enforceAdmin_(e);
  const tpl = HtmlService.createTemplateFromFile('Admin');
  tpl.model = { orgName: getSetting_('orgName') || CONFIG.ORG_NAME };
  return tpl.evaluate().setTitle(`${getSetting_('orgName') || CONFIG.ORG_NAME} Training Admin`);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getRegisterModel_(eventId, eventStartISO) {
  const tz = getSetting_('timezone') || 'America/Los_Angeles';
  const orgName = getSetting_('orgName') || CONFIG.ORG_NAME;
  const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
  const defaultCloseHours = toInt_(getSetting_('registrationCloseHoursBefore'), 0);

  if (!eventId) {
    return { ok: false, orgName, error: 'Missing eventId. Please use the Register link from the calendar event.' };
  }

  const ev = calGetEventByIdAndStart_(CONFIG.CALENDAR_ID, eventId, eventStartISO);
  if (!ev) {
    return { ok: false, orgName, error: 'Event not found. Please use the Register link from the calendar event.' };
  }

  const start = ev.getStartTime();
  // Use the eventStartISO from URL parameter to ensure consistency with stored registrations
  const startISO = eventStartISO || toIso_(start);
  const closeHours = getEventCloseHours_(eventId, defaultCloseHours);
  const closesAt = new Date(start.getTime() - closeHours * 60 * 60 * 1000);
  const closed = closeHours > 0 && new Date() >= closesAt;

  // Try to parse capacity from title first
  const currentTitle = ev.getTitle() || '';
  let capacity = parseCapacityFromTitle_(currentTitle);
  if (!capacity) {
    capacity = getEventCapacity_(eventId, defaultCapacity);
  }
  
  // Count confirmed registrations for THIS specific event instance using exact eventStartISO
  const confirmed = sheetCountConfirmed_(eventId, startISO);
  const spotsLeft = Math.max(0, capacity - confirmed);
  const full = spotsLeft <= 0;

  return {
    ok: true,
    orgName,
    timezone: tz,
    event: {
      eventId,
      eventStartISO: startISO,
      title: ev.getTitle(),
      startText: formatInTz_(start, tz),
      location: ev.getLocation() || '',
    },
    capacity,
    confirmed,
    spotsLeft,
    closed,
    closeHours,
    full,
    postUrl: ScriptApp.getService().getUrl(),
  };
}

function handleRegisterPost_(e) {
  const tz = getSetting_('timezone') || 'America/Los_Angeles';
  const orgName = getSetting_('orgName') || CONFIG.ORG_NAME;
  const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
  const defaultCloseHours = toInt_(getSetting_('registrationCloseHoursBefore'), 0);

  const eventId = getParam_(e, CONFIG.Q_EVENT_ID);
  const eventStartISO = getParam_(e, CONFIG.Q_EVENT_START);

  // Required fields
  const firstName = (getParam_(e, 'firstName') || '').trim();
  const lastName = (getParam_(e, 'lastName') || '').trim();
  const email = (getParam_(e, 'email') || '').trim().toLowerCase();
  const phone = (getParam_(e, 'phone') || '').trim();
  const numPeople = toInt_(getParam_(e, 'numPeople'), 1);
  const companyName = (getParam_(e, 'companyName') || '').trim();
  const address = (getParam_(e, 'address') || '').trim();
  const city = (getParam_(e, 'city') || '').trim();
  const state = (getParam_(e, 'state') || '').trim();
  const zip = (getParam_(e, 'zip') || '').trim();
  const reason = (getParam_(e, 'reason') || '').trim();
  const reasonOther = (getParam_(e, 'reasonOther') || '').trim();
  const questions = (getParam_(e, 'questions') || '').trim();

  if (!eventId || !eventStartISO) return HtmlService.createHtmlOutput('Missing event parameters.');
  if (!firstName || !lastName || !email || !phone || !companyName || !reason) {
    return HtmlService.createHtmlOutput('Missing required fields. Please fill in all required fields.');
  }
  if (numPeople < 1) return HtmlService.createHtmlOutput('Number of people must be at least 1.');
  if (reason === 'Other' && !reasonOther) {
    return HtmlService.createHtmlOutput('Please explain your reason for training when selecting "Other".');
  }

  const ev = calGetEventByIdAndStart_(CONFIG.CALENDAR_ID, eventId, eventStartISO);
  if (!ev) return HtmlService.createHtmlOutput('Event not found.');

  const start = ev.getStartTime();
  const closeHours = getEventCloseHours_(eventId, defaultCloseHours);
  const closesAt = new Date(start.getTime() - closeHours * 60 * 60 * 1000);
  if (closeHours > 0 && new Date() >= closesAt) return HtmlService.createHtmlOutput('Registration is closed for this event.');

  // Get capacity from title or config
  const currentTitle = ev.getTitle() || '';
  let capacity = parseCapacityFromTitle_(currentTitle);
  if (!capacity) {
    capacity = getEventCapacity_(eventId, defaultCapacity);
  }
  
  const confirmed = sheetCountConfirmed_(eventId, eventStartISO);
  if (confirmed + numPeople > capacity) {
    return HtmlService.createHtmlOutput(`Class is full. Only ${capacity - confirmed} spots available, but you requested ${numPeople}.`);
  }

  if (sheetHasConfirmedRegistration_(eventId, eventStartISO, email)) {
    return HtmlService.createHtmlOutput('You are already registered for this event.');
  }

  const token = secNewToken_();
  const nowIso = toIso_(new Date());

  sheetAppendRegistration_({
    timestamp: nowIso,
    eventId,
    eventStartISO,
    eventTitle: ev.getTitle(),
    firstName,
    lastName,
    email,
    phone,
    numPeople,
    companyName,
    address,
    city,
    state,
    zip,
    reason,
    reasonOther,
    questions,
    status: 'CONFIRMED',
    cancelToken: token,
    source: 'web',
    notes: '',
  });

  updateEventRegistrationOverlay_(eventId, eventStartISO);

  emailSendConfirmation_({
    orgName,
    tz,
    to: email,
    firstName,
    lastName,
    eventTitle: ev.getTitle(),
    eventStartText: formatInTz_(start, tz),
    numPeople,
  });

  // Return success message directly instead of redirecting
  const tpl = HtmlService.createTemplateFromFile('Success');
  tpl.model = {
    orgName: orgName,
    message: 'Registration confirmed successfully!',
  };
  return tpl.evaluate().setTitle(`${orgName} Registration Success`);
}

function handleCancelPost_(e) {
  // Cancellation is now handled via email contact
  const orgName = getSetting_('orgName') || CONFIG.ORG_NAME;
  return HtmlService.createHtmlOutput(
    `<html><body style="font-family: Arial, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px;">
      <h2>${orgName}</h2>
      <p>If you need to make a change or cancel your registration, please email Alexis Walker (awalker@nrcga.org) to make the necessary adjustments.</p>
      <p>You may close this window.</p>
    </body></html>`
  );
}

function updateEventRegistrationOverlay_(eventId, eventStartISO) {
  const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
  
  // Use the exact eventStartISO passed in to ensure we're updating the correct event instance
  const ev = calGetEventByIdAndStart_(CONFIG.CALENDAR_ID, eventId, eventStartISO);
  if (!ev) {
    Logger.log(`Event not found: eventId=${eventId}, eventStartISO=${eventStartISO}`);
    return;
  }

  const currentTitle = ev.getTitle() || '';
  // Count confirmed registrations for THIS specific event instance only
  const confirmed = sheetCountConfirmed_(eventId, eventStartISO);
  
  // Try to get capacity from title first, then from config, then default
  let capacity = parseCapacityFromTitle_(currentTitle);
  if (!capacity) {
    capacity = getEventCapacity_(eventId, defaultCapacity);
  }
  
  const spotsLeft = Math.max(0, capacity - confirmed);
  const full = spotsLeft <= 0;

  const registerUrl = `${ScriptApp.getService().getUrl()}?${CONFIG.Q_EVENT_ID}=${encodeURIComponent(eventId)}&${CONFIG.Q_EVENT_START}=${encodeURIComponent(eventStartISO)}`;
  
  // Create HTML-formatted registration block with clickable button
  // Google Calendar supports HTML in descriptions, so we use styled anchor tag as button
  const newBlock = [
    CONFIG.DESC_START,
    `<div><strong>Training Registration</strong></div>`,
    `<div>Capacity: ${capacity} | Confirmed: ${confirmed} | Spots left: ${spotsLeft}</div>`,
    `<div style="margin-top: 10px;">`,
    `<a href="${registerUrl}" style="background-color: #1a73e8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Click Here to Register</a>`,
    `</div>`,
    CONFIG.DESC_END,
  ].join('\n');

  const existingDesc = ev.getDescription() || '';
  const mergedDesc = calUpsertBlock_(existingDesc, CONFIG.DESC_START, CONFIG.DESC_END, newBlock);
  if (mergedDesc !== existingDesc) ev.setDescription(mergedDesc);

  // Update title with new format
  const baseTitle = String(currentTitle)
    .replace(CONFIG.TITLE_SUFFIX_RE, '')
    .trim();
  
  const suffix = full ? `[Registration Closed]` : `[Registered: ${confirmed}/${capacity}]`;
  ev.setTitle(`${baseTitle} ${suffix}`);
}

// Admin RPCs (called from Admin.html)
function adminListUpcoming() {
  enforceAdmin_({ parameter: {} });

  const tz = getSetting_('timezone') || 'America/Los_Angeles';
  const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
  const defaultCloseHours = toInt_(getSetting_('registrationCloseHoursBefore'), 0);

  const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const events = cal.getEvents(now, future);

  return events.slice(0, 100).map(ev => {
    const id = ev.getId();
    const startISO = toIso_(ev.getStartTime());
    const title = ev.getTitle() || '';
    
    // Try to parse capacity from title first
    let capacity = parseCapacityFromTitle_(title);
    if (!capacity) {
      // Fall back to EventConfig sheet, then default
      capacity = getEventCapacity_(id, defaultCapacity);
    }
    
    const closeH = getEventCloseHours_(id, defaultCloseHours);
    const regUrl = `${ScriptApp.getService().getUrl()}?eventId=${encodeURIComponent(id)}&eventStartISO=${encodeURIComponent(startISO)}`;
    
    // Parse current registration count from title
    const titleInfo = parseRegisteredFromTitle_(title);
    const currentRegistered = titleInfo.registered !== null ? titleInfo.registered : sheetCountConfirmed_(id, startISO);
    
    return {
      eventId: id,
      eventStartISO: startISO,
      title: title.replace(CONFIG.TITLE_SUFFIX_RE, '').trim(), // Clean title for display
      startText: formatInTz_(ev.getStartTime(), tz),
      capacity: capacity,
      currentRegistered: currentRegistered,
      closeHoursBefore: closeH,
      registerUrl: regUrl,
      location: ev.getLocation() || '',
      isRecurring: ev.isRecurringEvent(),
      isClosed: titleInfo.closed || false,
    };
  });
}

function adminSaveConfig(eventId, capacity, closeHoursBefore) {
  enforceAdmin_({ parameter: {} });
  sheetUpsertEventConfig_(String(eventId), parseInt(capacity, 10), closeHoursBefore === '' ? '' : parseInt(closeHoursBefore, 10), '');
}

function adminUpdateOverlay(eventId, eventStartISO) {
  enforceAdmin_({ parameter: {} });
  updateEventRegistrationOverlay_(String(eventId), String(eventStartISO));
}

// Automatic event processing - runs on trigger
function processNewEvents() {
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!cal) {
      Logger.log('Calendar not found');
      return;
    }

    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead
    const events = cal.getEvents(now, future);
    
    const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < events.length; i++) {
      try {
        const ev = events[i];
        const eventId = ev.getId();
        const eventStartISO = toIso_(ev.getStartTime());
        const description = ev.getDescription() || '';
        
        // Check if registration block already exists
        if (description.indexOf(CONFIG.DESC_START) >= 0) {
          // Block exists, just update it (this will also sync counts)
          updateEventRegistrationOverlay_(eventId, eventStartISO);
          processed++;
        } else {
          // New event without registration block - add it
          // Only process events that are in the future and don't have the block
          const startTime = ev.getStartTime();
          if (startTime > now) {
            // Initialize capacity if not set in title
            const currentTitle = ev.getTitle() || '';
            let capacity = parseCapacityFromTitle_(currentTitle);
            if (!capacity) {
              // Check EventConfig sheet first, then use default
              capacity = getEventCapacity_(eventId, defaultCapacity);
              // Set capacity in title if not already there
              const baseTitle = currentTitle.replace(CONFIG.TITLE_SUFFIX_RE, '').trim();
              ev.setTitle(`${baseTitle} [Registered: 0/${capacity}]`);
            }
            
            // Add registration block
            updateEventRegistrationOverlay_(eventId, eventStartISO);
            processed++;
          } else {
            skipped++;
          }
        }
      } catch (e) {
        Logger.log(`Error processing event: ${e.message}`);
        errors++;
      }
    }

    // After processing new events, also sync counts for existing events
    // This catches any manual deletions/changes in the sheet
    const syncResult = syncRegistrationCounts();
    Logger.log(`Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}, Synced: ${syncResult.updated}`);
  } catch (e) {
    Logger.log(`Error in processNewEvents: ${e.message}`);
  }
}

// Manual function to process events immediately (can be called from admin or run manually)
function adminProcessEventsNow() {
  enforceAdmin_({ parameter: {} });
  processNewEvents();
  return 'Events processed successfully.';
}

// Sync registration counts - checks for manual changes in the sheet and updates calendar events
function syncRegistrationCounts() {
  try {
    const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (!cal) {
      Logger.log('Calendar not found');
      return { updated: 0, checked: 0, errors: [] };
    }

    const now = new Date();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead
    const events = cal.getEvents(now, future);
    
    const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
    let updated = 0;
    let checked = 0;
    const errors = [];

    for (let i = 0; i < events.length; i++) {
      try {
        const ev = events[i];
        const eventId = ev.getId();
        const eventStartISO = toIso_(ev.getStartTime());
        const currentTitle = ev.getTitle() || '';
        
        // Skip events that don't have registration format in title
        if (!currentTitle.match(CONFIG.TITLE_SUFFIX_RE)) {
          continue;
        }
        
        checked++;
        
        // Get actual count from sheet
        const actualCount = sheetCountConfirmed_(eventId, eventStartISO);
        
        // Parse current count from title
        const titleInfo = parseRegisteredFromTitle_(currentTitle);
        const titleCount = titleInfo.registered !== null ? titleInfo.registered : null;
        
        // If counts don't match, update the event
        if (titleCount !== actualCount) {
          Logger.log(`Count mismatch for event ${eventId}: title shows ${titleCount}, sheet shows ${actualCount}`);
          updateEventRegistrationOverlay_(eventId, eventStartISO);
          updated++;
        }
      } catch (e) {
        Logger.log(`Error syncing event: ${e.message}`);
        errors.push(`Event ${i + 1}: ${e.message}`);
      }
    }

    Logger.log(`Sync complete: Checked ${checked} events, Updated ${updated} events`);
    return { updated, checked, total: events.length, errors };
  } catch (e) {
    Logger.log(`Error in syncRegistrationCounts: ${e.message}`);
    return { updated: 0, checked: 0, errors: [e.message] };
  }
}

// Admin function to sync registration counts manually
function adminSyncRegistrationCounts() {
  enforceAdmin_({ parameter: {} });
  const result = syncRegistrationCounts();
  return `Synced ${result.updated} of ${result.checked} events. ${result.errors.length > 0 ? 'Errors: ' + result.errors.join('; ') : ''}`;
}

// Setup time-driven trigger (run once to install)
function setupAutoProcessTrigger() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processNewEvents') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger to run every hour
  ScriptApp.newTrigger('processNewEvents')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('Auto-process trigger installed. Will run every hour.');
  return 'Trigger installed successfully. The script will automatically process new events every hour.';
}

// Admin functions for series support
function adminGetEventSeries(eventId) {
  enforceAdmin_({ parameter: {} });
  
  const cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead
  
  // Get the first event to check if it's recurring
  let firstEvent = null;
  try {
    firstEvent = cal.getEventById(eventId);
  } catch (e) {
    return [];
  }
  
  if (!firstEvent) return [];
  
  // Get all events in the calendar
  const allEvents = cal.getEvents(now, future);
  const seriesEvents = [];
  const defaultCapacity = toInt_(getSetting_('defaultCapacity'), 30);
  
  // For recurring events, they share the same base ID (before the instance suffix)
  const baseId = String(eventId).split('_')[0];
  
  for (let i = 0; i < allEvents.length; i++) {
    const ev = allEvents[i];
    const evId = String(ev.getId());
    // Match if it's the same base ID (for recurring) or exact match
    if (evId === String(eventId) || evId.startsWith(baseId + '_')) {
      const startISO = toIso_(ev.getStartTime());
      const title = ev.getTitle() || '';
      
      // Parse capacity from title
      let capacity = parseCapacityFromTitle_(title);
      if (!capacity) {
        capacity = getEventCapacity_(evId, defaultCapacity);
      }
      
      const titleInfo = parseRegisteredFromTitle_(title);
      const currentRegistered = titleInfo.registered !== null ? titleInfo.registered : sheetCountConfirmed_(evId, startISO);
      
      seriesEvents.push({
        eventId: evId,
        eventStartISO: startISO,
        title: title.replace(CONFIG.TITLE_SUFFIX_RE, '').trim(),
        startText: formatInTz_(ev.getStartTime(), getSetting_('timezone') || 'America/Los_Angeles'),
        capacity: capacity,
        currentRegistered: currentRegistered,
        location: ev.getLocation() || '',
        isClosed: titleInfo.closed || false,
      });
    }
  }
  
  return seriesEvents.sort((a, b) => new Date(a.eventStartISO) - new Date(b.eventStartISO));
}

function adminUpdateSeriesOverlay(eventId) {
  enforceAdmin_({ parameter: {} });
  
  const series = adminGetEventSeries(eventId);
  let updated = 0;
  let errors = [];
  
  for (let i = 0; i < series.length; i++) {
    try {
      updateEventRegistrationOverlay_(series[i].eventId, series[i].eventStartISO);
      updated++;
    } catch (e) {
      errors.push(`${series[i].startText}: ${e.message}`);
    }
  }
  
  return { updated, total: series.length, errors };
}

// Utilities
function getParam_(e, name) {
  return (e && e.parameter && e.parameter[name]) ? String(e.parameter[name]) : '';
}

function toInt_(v, fallback) {
  const n = parseInt(String(v || ''), 10);
  return isNaN(n) ? fallback : n;
}

function toIso_(d) {
  return new Date(d).toISOString();
}

function formatInTz_(d, tz) {
  return Utilities.formatDate(new Date(d), tz, "EEE, MMM d, yyyy 'at' h:mm a z");
}

function parseCapacityFromTitle_(title) {
  if (!title) return null;
  // Look for [Registered: X/Y] format
  const match = title.match(/\[Registered:\s*\d+\/(\d+)\]/);
  return match ? parseInt(match[1], 10) : null;
}

function parseRegisteredFromTitle_(title) {
  if (!title) return { registered: null, capacity: null };
  // Look for [Registered: X/Y] format
  const match = title.match(/\[Registered:\s*(\d+)\/(\d+)\]/);
  if (match) {
    return {
      registered: parseInt(match[1], 10),
      capacity: parseInt(match[2], 10)
    };
  }
  // Check if closed
  if (title.match(/\[Registration Closed\]/)) {
    // Try to extract capacity from previous format if available
    const capMatch = title.match(/\[Registered:\s*\d+\/(\d+)\]/);
    return {
      registered: null,
      capacity: capMatch ? parseInt(capMatch[1], 10) : null,
      closed: true
    };
  }
  return { registered: null, capacity: null };
}

// Certificate Generation Functions
function generateCertificate(data) {
  const orgName = getSetting_('orgName') || CONFIG.ORG_NAME;
  const chair = getSetting_('chair') || 'Chair';
  const viceChair = getSetting_('viceChair') || 'Vice Chair';
  
  // Format training date
  let trainingDate = data.trainingDate || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // If it's a date string, try to format it nicely
  if (typeof trainingDate === 'string' && trainingDate.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(trainingDate);
    trainingDate = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  const companyName = data.companyName || data.company || '';
  
  // Fancy certificate HTML template
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { 
          size: letter landscape; 
          margin: 0; 
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Times New Roman', 'Georgia', serif;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          width: 11in;
          height: 8.5in;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .certificate-container {
          width: 10.5in;
          height: 8in;
          background: white;
          position: relative;
          padding: 0.5in;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .border-decoration {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 14px solid transparent;
          background: 
            linear-gradient(white, white) padding-box,
            repeating-linear-gradient(
              45deg,
              #1a73e8 0px,
              #1a73e8 10px,
              #d4af37 10px,
              #d4af37 20px,
              #1a73e8 20px,
              #1a73e8 30px
            ) border-box;
          border-radius: 12px;
        }
        .border-decoration::before {
          content: '';
          position: absolute;
          top: -14px;
          left: -14px;
          right: -14px;
          bottom: -14px;
          background: 
            repeating-conic-gradient(
              from 0deg at 50% 50%,
              #1a73e8 0deg 10deg,
              #d4af37 10deg 20deg
            );
          z-index: -1;
          border-radius: 16px;
        }
        .corner-ornament {
          display: none;
        }
        .logo {
          text-align: center;
          margin: 0.15in auto 0.2in;
          width: 130px;
          height: auto;
        }
        .logo img {
          width: 100%;
          height: auto;
          display: block;
        }
        .content {
          position: relative;
          z-index: 1;
          text-align: center;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .header-section {
          margin-top: 0.15in;
        }
        .certificate-title {
          font-size: 44px;
          font-weight: bold;
          color: #1a73e8;
          letter-spacing: 3px;
          margin-bottom: 8px;
          text-transform: uppercase;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .decorative-line {
          width: 200px;
          height: 2px;
          background: linear-gradient(to right, transparent, #d4af37, transparent);
          margin: 0.2in auto;
        }
        .body-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0.15in 0;
        }
        .presentation-text {
          font-size: 17px;
          color: #555;
          margin-bottom: 0.2in;
          line-height: 1.6;
        }
        .recipient-name {
          font-size: 38px;
          font-weight: bold;
          color: #1a73e8;
          margin: 0.15in 0;
          padding: 0.1in 0.25in;
          border-bottom: 3px solid #d4af37;
          border-top: 3px solid #d4af37;
          display: inline-block;
          letter-spacing: 2px;
        }
        .completion-text {
          font-size: 17px;
          color: #555;
          margin-top: 0.15in;
          line-height: 1.6;
        }
        .training-date {
          font-size: 15px;
          color: #666;
          font-style: italic;
          margin-top: 0.12in;
        }
        .validity-note {
          font-size: 12px;
          color: #888;
          font-style: italic;
          margin-top: 0.08in;
        }
        .signatures-section {
          display: flex;
          justify-content: space-around;
          margin-top: 0.25in;
          padding-top: 0.15in;
          padding-bottom: 0.1in;
        }
        .signature-block {
          width: 45%;
          text-align: center;
        }
        .signature-name {
          font-size: 15px;
          font-weight: bold;
          color: #333;
          margin-bottom: 0.03in;
        }
        .signature-title {
          font-size: 13px;
          color: #666;
          font-style: italic;
        }
        .footer-section {
          margin-top: 0.1in;
          font-size: 11px;
          color: #999;
          padding-bottom: 0.05in;
        }
        .certificate-number {
          position: absolute;
          bottom: 10px;
          right: 25px;
          font-size: 9px;
          color: #ccc;
        }
      </style>
    </head>
    <body>
      <div class="certificate-container">
        <div class="border-decoration"></div>
        <div class="corner-ornament top-left"></div>
        <div class="corner-ornament top-right"></div>
        <div class="corner-ornament bottom-left"></div>
        <div class="corner-ornament bottom-right"></div>
        
        <div class="content">
          <div class="header-section">
            <div class="certificate-title">Certificate</div>
            <div class="certificate-title" style="font-size: 32px; margin-top: -8px;">of Completion</div>
            <div class="decorative-line"></div>
            <div class="logo">
              <img src="https://testsite.nrcga.org/assets/images/NRCGA-Logo_Badge-Color-300x272.png" alt="NRCGA Logo">
            </div>
          </div>
          
          <div class="body-section">
            <div class="presentation-text">
              This certificate is proudly presented to
            </div>
            <div class="recipient-name">${escapeHtml_(fullName)}</div>
            <div class="completion-text">
              ${companyName ? `An employee of <strong>${escapeHtml_(companyName)}</strong>, for completing the` : 'For completing the'}<br/>
              <strong style="color: #1a73e8; font-size: 20px;">Nevada Regional Common Ground Alliance's Excavator Safety Training class</strong>.
            </div>
            <div class="training-date">
              Date of Issuance: ${escapeHtml_(trainingDate)}
            </div>
            <div class="validity-note">
              (This certificate is valid for one year from the date of issuance)
            </div>
          </div>
          
          <div class="signatures-section">
            <div class="signature-block">
              <div class="signature-name">${escapeHtml_(chair)}</div>
              <div class="signature-title">Chair</div>
            </div>
            <div class="signature-block">
              <div class="signature-name">${escapeHtml_(viceChair)}</div>
              <div class="signature-title">Vice Chair</div>
            </div>
          </div>
          
          <div class="certificate-number">
            Certificate ID: ${Date.now().toString(36).toUpperCase()}
          </div>
        </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Convert HTML to PDF blob
  const htmlBlob = Utilities.newBlob(htmlTemplate, 'text/html', 'certificate.html');
  const pdfBlob = htmlBlob.getAs('application/pdf');
  
  return pdfBlob;
}

// Main function triggered on form submission
function onFormSubmit(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.TAB_ATTENDANCE);
    
    if (!sheet) {
      Logger.log('Attendance sheet not found');
      return;
    }
    
    // Get the last row (newest submission)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('No data rows found');
      return;
    }
    
    const values = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Map headers to values (normalize header names)
    const data = {};
    headers.forEach((header, index) => {
      const key = String(header || '').trim().toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
      data[key] = values[index];
    });
    
    // Also store original headers for exact matching
    const originalData = {};
    headers.forEach((header, index) => {
      if (header) {
        originalData[String(header).trim()] = values[index];
      }
    });
    
    // Helper function to find field value by trying multiple variations
    const findField = (variations) => {
      for (const variation of variations) {
        const normalized = variation.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        if (data[normalized]) return String(data[normalized]).trim();
        if (originalData[variation]) return String(originalData[variation]).trim();
      }
      return '';
    };
    
    // Extract field names - tries multiple common variations
    // You can customize these in the Settings tab with field mappings if needed
    const submissionData = {
      firstName: findField([
        'firstname', 'first name', 'first', 'fname', 'given name', 'givenname',
        'name (first)', 'firstname', 'first_name'
      ]),
      lastName: findField([
        'lastname', 'last name', 'last', 'lname', 'surname', 'family name', 'familyname',
        'name (last)', 'lastname', 'last_name'
      ]),
      email: findField([
        'email', 'email address', 'emailaddress', 'e-mail', 'e mail', 'emailaddress',
        'your email', 'email address', 'email_address'
      ]),
      phone: findField([
        'phone', 'phone number', 'phonenumber', 'phone number', 'telephone', 'tel',
        'mobile', 'cell', 'contact number', 'phone_number'
      ]),
      companyName: findField([
        'company', 'company name', 'companyname', 'company name', 'employer',
        'organization', 'org', 'company_name'
      ]),
      trainingDate: findField([
        'date', 'training date', 'trainingdate', 'training date', 'date of training',
        'completion date', 'completiondate', 'date completed', 'training_date'
      ]) || (originalData['Timestamp'] ? new Date(originalData['Timestamp']).toLocaleDateString() : new Date().toLocaleDateString()),
    };
    
    if (!submissionData.email) {
      Logger.log('No email found in submission');
      return;
    }
    
    if (!submissionData.firstName || !submissionData.lastName) {
      Logger.log('Missing name information');
      return;
    }
    
    // Generate certificate
    const certificatePdf = generateCertificate(submissionData);
    
    // Email the certificate
    const orgName = getSetting_('orgName') || CONFIG.ORG_NAME;
    const fromName = getSetting_('fromName') || `${orgName} Training`;
    const replyTo = getSetting_('replyToEmail') || '';
    const subject = `${orgName} Training Certificate of Completion`;
    
    const emailBody = `
Dear ${submissionData.firstName} ${submissionData.lastName},

Thank you for completing the Excavator Training Program. Please find your certificate of completion attached.

Training Date: ${submissionData.trainingDate}

If you have any questions, please contact us.

Best regards,
${orgName}
    `;
    
    const htmlEmailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #1a73e8;">Training Certificate</h2>
        <p>Dear ${escapeHtml_(submissionData.firstName)} ${escapeHtml_(submissionData.lastName)},</p>
        <p>Thank you for completing the <strong>Excavator Training Program</strong>. Please find your certificate of completion attached.</p>
        <p><strong>Training Date:</strong> ${escapeHtml_(submissionData.trainingDate)}</p>
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br/><strong>${escapeHtml_(orgName)}</strong></p>
      </div>
    `;
    
    MailApp.sendEmail({
      to: submissionData.email,
      subject: subject,
      htmlBody: htmlEmailBody,
      body: emailBody,
      attachments: [certificatePdf],
      name: fromName,
      replyTo: replyTo || undefined,
    });
    
    Logger.log(`Certificate sent to ${submissionData.email}`);
  } catch (error) {
    Logger.log(`Error processing form submission: ${error.message}`);
    Logger.log(error.stack);
    // Optionally send error notification to admin
    try {
      const adminEmails = getSetting_('adminEmails');
      if (adminEmails) {
        MailApp.sendEmail({
          to: adminEmails.split(';')[0].trim(),
          subject: 'Certificate Generation Error',
          body: `Error generating certificate: ${error.message}\n\nStack: ${error.stack}`,
        });
      }
    } catch (e) {
      Logger.log(`Could not send error notification: ${e.message}`);
    }
  }
}

// Check if form is linked to the Attendance sheet
function checkFormLink() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TAB_ATTENDANCE);
  
  if (!sheet) {
    return {
      linked: false,
      message: 'Attendance sheet not found. Please create an "Attendance" tab in your Google Sheet.'
    };
  }
  
  try {
    const formUrl = sheet.getFormUrl();
    if (formUrl) {
      const form = FormApp.openByUrl(formUrl);
      const formTitle = form.getTitle();
      return {
        linked: true,
        message: `Form is linked! Form: "${formTitle}"`,
        formUrl: formUrl,
        formId: form.getId()
      };
    } else {
      return {
        linked: false,
        message: 'Form is NOT linked to the Attendance sheet. You need to link your Google Form to the sheet first.'
      };
    }
  } catch (error) {
    return {
      linked: false,
      message: `Error checking form link: ${error.message}`
    };
  }
}

// Setup form submission trigger (run once)
function setupFormSubmitTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TAB_ATTENDANCE);
  
  if (!sheet) {
    throw new Error('Attendance sheet not found. Please create an "Attendance" tab in your Google Sheet.');
  }
  
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // For Google Forms linked to Sheets, we need to get the form object
  // and create a trigger on it. The onFormSubmit function will be called
  // automatically when a form is submitted.
  try {
    // Try to get the form URL from the sheet (if form is linked)
    const formUrl = sheet.getFormUrl();
    if (formUrl) {
      const form = FormApp.openByUrl(formUrl);
      ScriptApp.newTrigger('onFormSubmit')
        .onFormSubmit(form)
        .create();
      Logger.log('Form submission trigger installed successfully');
      return 'Form submission trigger installed successfully! Certificates will be sent automatically when forms are submitted.';
    } else {
      // Form is not linked to the sheet, so we need to set it up manually
      Logger.log('No form URL found. The Google Form must be linked to the Attendance sheet.');
      Logger.log('To link the form:');
      Logger.log('1. Open your Google Form');
      Logger.log('2. Click the Responses tab');
      Logger.log('3. Click the three dots (⋮) next to the Google Sheets icon');
      Logger.log('4. Select "Select existing spreadsheet" and choose your sheet');
      Logger.log('5. Then run this function again, or set up the trigger manually');
      Logger.log('');
      Logger.log('To set up the trigger manually:');
      Logger.log('1. Go to Extensions → Apps Script → Triggers (clock icon)');
      Logger.log('2. Click "Add Trigger"');
      Logger.log('3. Select function: onFormSubmit');
      Logger.log('4. Select event source: From form');
      Logger.log('5. Select event type: On form submit');
      Logger.log('6. Click Save');
      return 'Form is not linked to the Attendance sheet. Please link your Google Form to the sheet first, then run this function again. See the execution log for detailed instructions.';
    }
  } catch (error) {
    Logger.log(`Error setting up trigger: ${error.message}`);
    Logger.log('You may need to set up the trigger manually:');
    Logger.log('1. Go to Extensions → Apps Script → Triggers (clock icon)');
    Logger.log('2. Click "Add Trigger"');
    Logger.log('3. Select function: onFormSubmit');
    Logger.log('4. Select event source: From form');
    Logger.log('5. Select event type: On form submit');
    Logger.log('6. Click Save');
    throw new Error(`Could not set up trigger automatically: ${error.message}. Please set it up manually via the Triggers UI.`);
  }
}


