function sheet_() {
  // Intended for a bound script (Extensions → Apps Script from the sheet)
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheetGetSettings_() {
  const ss = sheet_();
  const sh = ss.getSheetByName(CONFIG.TAB_SETTINGS);
  if (!sh) throw new Error('Missing Settings tab');

  const values = sh.getDataRange().getValues();
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const k = String(values[i][0] || '').trim();
    const v = String(values[i][1] || '').trim();
    if (k) out[k] = v;
  }
  return out;
}

function getSetting_(key) {
  const s = sheetGetSettings_();
  return s[key] || '';
}

function sheetGetEventConfigRow_(eventId) {
  const ss = sheet_();
  const sh = ss.getSheetByName(CONFIG.TAB_EVENT_CONFIG);
  if (!sh) throw new Error('Missing EventConfig tab');

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(h => String(h || '').trim());
  const idx = {
    eventId: headers.indexOf('eventId'),
    capacity: headers.indexOf('capacity'),
    closeHoursBefore: headers.indexOf('closeHoursBefore'),
    lastUpdated: headers.indexOf('lastUpdated'),
    notes: headers.indexOf('notes'),
  };

  for (let r = 1; r < values.length; r++) {
    const id = String(values[r][idx.eventId] || '').trim();
    if (id && id === String(eventId)) {
      return { row: r + 1, idx, values: values[r] };
    }
  }
  return null;
}

function sheetUpsertEventConfig_(eventId, capacity, closeHoursBefore, notes) {
  const ss = sheet_();
  const sh = ss.getSheetByName(CONFIG.TAB_EVENT_CONFIG);
  if (!sh) throw new Error('Missing EventConfig tab');

  const existing = sheetGetEventConfigRow_(eventId);
  const now = new Date().toISOString();

  if (!existing) {
    sh.appendRow([eventId, capacity, closeHoursBefore || '', now, notes || '']);
    return;
  }

  const r = existing.row;
  const idx = existing.idx;
  if (idx.capacity >= 0) sh.getRange(r, idx.capacity + 1).setValue(capacity);
  if (idx.closeHoursBefore >= 0) sh.getRange(r, idx.closeHoursBefore + 1).setValue(closeHoursBefore || '');
  if (idx.lastUpdated >= 0) sh.getRange(r, idx.lastUpdated + 1).setValue(now);
  if (idx.notes >= 0) sh.getRange(r, idx.notes + 1).setValue(notes || '');
}

function getEventCapacity_(eventId, defaultCapacity) {
  const row = sheetGetEventConfigRow_(eventId);
  if (!row) return defaultCapacity;
  const cap = row.idx.capacity >= 0 ? parseInt(row.values[row.idx.capacity], 10) : NaN;
  return isNaN(cap) ? defaultCapacity : cap;
}

function getEventCloseHours_(eventId, defaultCloseHours) {
  const row = sheetGetEventConfigRow_(eventId);
  if (!row) return defaultCloseHours;
  const h = row.idx.closeHoursBefore >= 0 ? parseInt(row.values[row.idx.closeHoursBefore], 10) : NaN;
  return isNaN(h) ? defaultCloseHours : h;
}

function sheetRegistrations_() {
  const ss = sheet_();
  const sh = ss.getSheetByName(CONFIG.TAB_REGISTRATIONS);
  if (!sh) throw new Error('Missing Registrations tab');
  return sh;
}

function sheetAppendRegistration_(r) {
  const sh = sheetRegistrations_();
  sh.appendRow([
    r.timestamp,
    r.eventId,
    r.eventStartISO,
    r.eventTitle,
    r.firstName,
    r.lastName,
    r.email,
    r.phone,
    r.numPeople || 1,
    r.companyName || '',
    r.address || '',
    r.city || '',
    r.state || '',
    r.zip || '',
    r.reason || '',
    r.reasonOther || '',
    r.questions || '',
    r.status,
    r.cancelToken,
    r.source,
    r.notes,
  ]);
}

function sheetCountConfirmed_(eventId, eventStartISO) {
  const sh = sheetRegistrations_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return 0;

  const headers = values[0].map(h => String(h || '').trim());
  const idx = {
    eventId: headers.indexOf('eventId'),
    eventStartISO: headers.indexOf('eventStartISO'),
    status: headers.indexOf('status'),
    numPeople: headers.indexOf('numPeople'),
  };

  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    // Ensure exact match on both eventId and eventStartISO (strict comparison)
    const rowEventId = String(row[idx.eventId] || '').trim();
    const rowEventStartISO = String(row[idx.eventStartISO] || '').trim();
    const rowStatus = String(row[idx.status] || '').trim().toUpperCase();
    
    if (
      rowEventId === String(eventId).trim() &&
      rowEventStartISO === String(eventStartISO).trim() &&
      rowStatus === 'CONFIRMED'
    ) {
      // Sum up numPeople instead of counting rows
      const numPeople = idx.numPeople >= 0 ? parseInt(row[idx.numPeople] || '1', 10) : 1;
      count += isNaN(numPeople) ? 1 : numPeople;
    }
  }
  return count;
}

function sheetHasConfirmedRegistration_(eventId, eventStartISO, email) {
  const sh = sheetRegistrations_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return false;

  const headers = values[0].map(h => String(h || '').trim());
  const idx = {
    eventId: headers.indexOf('eventId'),
    eventStartISO: headers.indexOf('eventStartISO'),
    status: headers.indexOf('status'),
    email: headers.indexOf('email'),
  };

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (
      String(row[idx.eventId] || '') === String(eventId) &&
      String(row[idx.eventStartISO] || '') === String(eventStartISO) &&
      String(row[idx.status] || '').toUpperCase() === 'CONFIRMED' &&
      String(row[idx.email] || '').toLowerCase() === String(email).toLowerCase()
    ) return true;
  }
  return false;
}

function sheetFindRegistrationByToken_(token) {
  const sh = sheetRegistrations_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0].map(h => String(h || '').trim());
  const idx = {
    timestamp: headers.indexOf('timestamp'),
    eventId: headers.indexOf('eventId'),
    eventStartISO: headers.indexOf('eventStartISO'),
    eventTitle: headers.indexOf('eventTitle'),
    firstName: headers.indexOf('firstName'),
    lastName: headers.indexOf('lastName'),
    email: headers.indexOf('email'),
    phone: headers.indexOf('phone'),
    numPeople: headers.indexOf('numPeople'),
    companyName: headers.indexOf('companyName'),
    address: headers.indexOf('address'),
    city: headers.indexOf('city'),
    state: headers.indexOf('state'),
    zip: headers.indexOf('zip'),
    reason: headers.indexOf('reason'),
    reasonOther: headers.indexOf('reasonOther'),
    questions: headers.indexOf('questions'),
    status: headers.indexOf('status'),
    cancelToken: headers.indexOf('cancelToken'),
  };

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[idx.cancelToken] || '') === String(token)) {
      return {
        rowNumber: i + 1,
        timestamp: row[idx.timestamp],
        eventId: row[idx.eventId],
        eventStartISO: row[idx.eventStartISO],
        eventTitle: row[idx.eventTitle],
        firstName: row[idx.firstName],
        lastName: row[idx.lastName],
        email: row[idx.email],
        phone: row[idx.phone],
        numPeople: idx.numPeople >= 0 ? (parseInt(row[idx.numPeople] || '1', 10) || 1) : 1,
        companyName: idx.companyName >= 0 ? row[idx.companyName] : '',
        address: idx.address >= 0 ? row[idx.address] : '',
        city: idx.city >= 0 ? row[idx.city] : '',
        state: idx.state >= 0 ? row[idx.state] : '',
        zip: idx.zip >= 0 ? row[idx.zip] : '',
        reason: idx.reason >= 0 ? row[idx.reason] : '',
        reasonOther: idx.reasonOther >= 0 ? row[idx.reasonOther] : '',
        questions: idx.questions >= 0 ? row[idx.questions] : '',
        status: String(row[idx.status] || '').toUpperCase(),
        cancelToken: row[idx.cancelToken],
      };
    }
  }
  return null;
}

function sheetCancelByToken_(token) {
  const sh = sheetRegistrations_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('Registrations sheet missing header row');

  const headers = values[0].map(h => String(h || '').trim());
  const idxStatus = headers.indexOf('status');
  const idxToken = headers.indexOf('cancelToken');
  if (idxStatus < 0 || idxToken < 0) throw new Error('Registrations missing status/cancelToken headers');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxToken] || '') === String(token)) {
      sh.getRange(i + 1, idxStatus + 1).setValue('CANCELED');
      return;
    }
  }
}


