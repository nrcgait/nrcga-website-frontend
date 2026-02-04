function calGetEventByIdAndStart_(calendarId, eventId, eventStartISO) {
  const cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) throw new Error('Calendar not found or not shared to script owner.');

  // Try direct fetch by ID (may work for non-recurring events)
  try {
    const ev = cal.getEventById(eventId);
    if (ev) {
      if (!eventStartISO) return ev;
      const startIso = new Date(ev.getStartTime()).toISOString();
      if (startIso === eventStartISO) return ev;
      // else fall through to search
    }
  } catch (e) {
    // ignore, fall back to search
  }

  if (!eventStartISO) return null;

  // Search around the start time to locate the matching instance
  const t = new Date(eventStartISO);
  const start = new Date(t.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(t.getTime() + 12 * 60 * 60 * 1000);
  const events = cal.getEvents(start, end);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const idMatches = String(ev.getId()) === String(eventId);
    const startMatches = new Date(ev.getStartTime()).toISOString() === eventStartISO;
    if (idMatches && startMatches) return ev;
  }

  return null;
}

function calUpsertBlock_(desc, startMarker, endMarker, fullBlock) {
  const s = String(desc || '');

  const startIdx = s.indexOf(startMarker);
  const endIdx = s.indexOf(endMarker);

  if (startIdx >= 0 && endIdx > startIdx) {
    const before = s.substring(0, startIdx).trimEnd();
    const after = s.substring(endIdx + endMarker.length).trimStart();
    return [before, fullBlock, after].filter(Boolean).join('\n\n').trim();
  }

  // No existing block, append at end
  if (!s.trim()) return fullBlock;
  return (s.trimEnd() + '\n\n' + fullBlock).trim();
}


