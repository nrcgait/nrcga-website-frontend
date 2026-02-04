function secNewToken_() {
  return Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
}

function enforceAdmin_(e) {
  const settings = sheetGetSettings_();
  const adminEmailsRaw = String(settings.adminEmails || '').trim();
  const adminKey = String(settings.adminKey || '').trim();
  const keyProvided = getParam_(e, CONFIG.Q_KEY);

  // Prefer allowlist by email, if Apps Script can resolve an active user.
  const activeEmail = (Session.getActiveUser && Session.getActiveUser().getEmail)
    ? Session.getActiveUser().getEmail()
    : '';
  const email = String(activeEmail || '').trim().toLowerCase();

  if (email && adminEmailsRaw) {
    const allow = adminEmailsRaw.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allow.includes(email)) return;
    throw new Error('Not authorized (adminEmails).');
  }

  // Fallback: shared adminKey in Settings + ?key=...
  if (adminKey && keyProvided && adminKey === keyProvided) return;

  throw new Error('Not authorized. Add your email to Settings.adminEmails or use Settings.adminKey + ?key=...');
}


