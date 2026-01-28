// Events Configuration
// Edit this file to add/update events
//
// Structure:
// - id: Unique identifier (string or number)
// - name: Event name (required)
// - date: Event date in YYYY-MM-DD format (required)
// - time: Event time in HH:MM format (24-hour, required)
// - length: Event length in minutes (required)
// - location: Event location (required)
// - additionalDetails: Additional event details/description (optional)
// - registrationLimit: Maximum number of people who can register (null = no registration, optional)
// - eventRepeats: How the event repeats - "daily", "weekly", "monthly", an integer (number of days), or null for no repeat (optional)
//   Examples: "daily" (every day), "weekly" (every 7 days), "monthly" (every month), 14 (every 14 days), 3 (every 3 days)
// - repeatEnds: Date when repetition ends in YYYY-MM-DD format (required if eventRepeats is set, optional otherwise)

window.eventsData = [
    {
        id: "1",
        name: "Northern Nevada Training",
        date: "2025-01-26",
        time: "09:00",
        length: 180,
        location: "Reno, NV",
        additionalDetails: "Monthly training session covering utility marking standards, safe excavation practices, and the 811 process.",
        registrationLimit: 20,
        eventRepeats: 3,
        repeatEnds: "2026-12-31"
    },
    {
        id: "2",
        name: "Southern Nevada Training",
        date: "2025-01-28",
        time: "13:00",
        length: 120,
        location: "Las Vegas, NV",
        additionalDetails: "Weekly training session for Southern Nevada excavators.",
        registrationLimit: 40,
        eventRepeats: 4,
        repeatEnds: "2026-12-31"
    }
];

