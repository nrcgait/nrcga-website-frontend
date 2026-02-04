# NRCGA Training Registration (Apps Script)

This folder contains the **new** multi-file Google Apps Script web app for training registrations.

## Google assets you must create

### 1) Google Sheet (single spreadsheet)

Create one Google Sheet (recommended name: `NRCGA Training`) with these tabs:

#### Tab: `Settings`

Two columns:
- `key`
- `value`

Recommended keys:
- `timezone` = `America/Los_Angeles`
- `orgName` = `NRCGA`
- `fromName` = `NRCGA Training`
- `replyToEmail` = (optional)
- `defaultCapacity` = `30`
- `registrationCloseHoursBefore` = `24` (optional)
- `confirmationEmailSubject` = `NRCGA Training Registration Confirmed`
- `cancelEmailSubject` = `NRCGA Training Registration Canceled`
- `adminEmails` = `a@...;b@...` (optional)
- `adminKey` = (optional fallback for admin access)
- `chair` = `John Doe` (for certificate signature)
- `viceChair` = `Jane Smith` (for certificate signature)

#### Tab: `EventConfig`

Headers (row 1):
- `eventId`
- `capacity`
- `closeHoursBefore`
- `lastUpdated`
- `notes`

#### Tab: `Registrations`

Headers (row 1):
- `timestamp`
- `eventId`
- `eventStartISO`
- `eventTitle`
- `firstName`
- `lastName`
- `email`
- `phone`
- `numPeople` (number of people registered in this entry)
- `companyName`
- `address`
- `city`
- `state`
- `zip`
- `reason` (Operator Mandate, Company Requirement, Other)
- `reasonOther` (explanation if reason is "Other")
- `questions` (questions, comments, or concerns)
- `status` (CONFIRMED / CANCELED)
- `cancelToken`
- `source` (web / admin)
- `notes`

### 2) Google Calendar

Training Calendar ID used in code:
- `c3c2f805bd62806527726e9249d3124b0fd48a14078bb2300310ec64fc8b5f28@group.calendar.google.com`

Share this calendar with the Apps Script **owner account** with permission **Make changes to events**.

## Deploy

1. In the Google Sheet: **Extensions → Apps Script**
2. Create files matching this folder:
   - `Code.gs`
   - `libCalendar.gs`
   - `libSheets.gs`
   - `libEmail.gs`
   - `libSecurity.gs`
   - `Register.html`
   - `Success.html`
   - `Cancel.html`
   - `Admin.html`
3. Deploy: **Deploy → New deployment → Web app**
   - Execute as: **Me** (owner/shared NRCGA account)
   - Who has access: **Anyone**
4. Set up automatic event processing:
   - In Apps Script editor, run the function `setupAutoProcessTrigger()` once
   - This installs a time-driven trigger that runs every hour
   - The script will automatically add registration links to new calendar events
   - You can also manually process events from the Admin page
5. Set up certificate generation (for attendance forms):
   - Ensure you have an "Attendance" tab in your Google Sheet
   - In Apps Script editor, run the function `setupFormSubmitTrigger()` once
   - This installs a form submission trigger that automatically generates and emails certificates
   - Add `chair` and `viceChair` names to the Settings tab for certificate signatures
6. Open Admin: `.../exec?page=admin`

## How registration works

Apps Script updates each managed calendar event:
- Adds/updates a description block:

```
--- TRAINING REGISTRATION ---
Capacity: X
Confirmed: Y
Spots left: Z
Register: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?eventId=<EVENT_ID>&eventStartISO=<EVENT_START_ISO>
--- /TRAINING REGISTRATION ---
```

- Updates the title with registration status:
  - `[Registered: X/Y]` where X is confirmed registrations and Y is capacity
  - `[Registration Closed]` when at capacity
  - Capacity is parsed from the title format, allowing manual capacity setting in calendar titles

- Automatically adds registration links to new events:
  - When a new event is created in the calendar, the script automatically adds a registration block
  - The registration link appears as a clickable button: **"Click Here to Register"**
  - The raw URL is hidden - only the styled button is visible
  - Runs automatically every hour via time-driven trigger
  - Can also be triggered manually from the Admin page

### Admin Features

- **Title Parsing**: Capacity is automatically parsed from event titles in the format `[Registered: X/Y]`
- **Series Updates**: For recurring events, you can update all instances in a series at once
- **Clickable Links**: Register links are clickable and can be copied to clipboard
- **Registration Status**: Shows current registration count vs capacity in real-time

### Certificate Generation

- **Automatic Certificates**: When someone submits the attendance form, a certificate is automatically generated and emailed
- **Fancy Design**: Professional certificate with decorative borders, official seal, and elegant typography
- **Dual Signatures**: Certificates include signatures from Chair and Vice Chair (configured in Settings)
- **PDF Format**: Certificates are generated as PDFs and attached to confirmation emails
- **Sample Previews**: See `certificate-sample-1.html` for design examples

#### Google Form Field Mapping

To ensure certificates are generated correctly, your Google Form should include these fields. The script will automatically detect them using common variations of these names:

**Required Fields:**
- **First Name** - Can be named: "First Name", "First", "Firstname", "Given Name", etc.
- **Last Name** - Can be named: "Last Name", "Last", "Lastname", "Surname", "Family Name", etc.
- **Email** - Can be named: "Email", "Email Address", "E-mail", "Your Email", etc.

**Optional Fields:**
- **Phone** - Can be named: "Phone", "Phone Number", "Telephone", "Mobile", "Cell", etc.
- **Company** - Can be named: "Company", "Company Name", "Employer", "Organization", etc.
- **Training Date** - Can be named: "Date", "Training Date", "Completion Date", etc. (If not provided, uses form submission timestamp)

**How it works:**
1. The script normalizes all form field names (removes spaces, special characters, converts to lowercase)
2. It tries multiple common variations to find each field
3. If a field isn't found, it will log an error and skip certificate generation for that submission
4. The form must be linked to the "Attendance" tab in your Google Sheet

**Example Form Setup:**
- Question 1: "What is your first name?" (Short answer)
- Question 2: "What is your last name?" (Short answer)
- Question 3: "What is your email address?" (Short answer)
- Question 4: "What is your phone number?" (Short answer - optional)
- Question 5: "What is your company name?" (Short answer - optional)
- Question 6: "Date of training" (Date picker - optional)

The script will automatically detect these fields regardless of the exact wording you use.


