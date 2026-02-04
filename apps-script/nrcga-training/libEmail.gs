function emailSendConfirmation_(p) {
  const subject = getSetting_('confirmationEmailSubject') || `${p.orgName} Training Registration Confirmed`;
  const replyTo = getSetting_('replyToEmail') || '';
  const fromName = getSetting_('fromName') || `${p.orgName} Training`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif;">
      <h2>Registration Confirmed</h2>
      <p>Hi ${escapeHtml_(p.firstName)} ${escapeHtml_(p.lastName)},</p>
      <p>You are confirmed for:</p>
      <p><b>${escapeHtml_(p.eventTitle)}</b><br/>
         ${escapeHtml_(p.eventStartText)}</p>
      ${p.numPeople > 1 ? `<p>Number of registrations: ${p.numPeople}</p>` : ''}
      <p style="margin-top: 20px; padding: 12px; background-color: #f0f0f0; border-left: 4px solid #1a73e8;">
        <strong>Need to make a change or cancel?</strong><br/>
        Please email Alexis Walker at <a href="mailto:awalker@nrcga.org">awalker@nrcga.org</a> to make the necessary adjustments.
      </p>
      <p style="color:#666;font-size:12px">Do not reply to this email.</p>
    </div>
  `;

  const body = `Registration Confirmed

${p.eventTitle}
${p.eventStartText}
${p.numPeople > 1 ? `\nNumber of registrations: ${p.numPeople}` : ''}

Need to make a change or cancel?
Please email Alexis Walker at awalker@nrcga.org to make the necessary adjustments.
`;

  MailApp.sendEmail({
    to: p.to,
    subject,
    htmlBody,
    body,
    replyTo: replyTo || undefined,
    name: fromName || undefined,
  });
}

function escapeHtml_(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


