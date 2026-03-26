// Navigation Bar Configuration
// Update this file to modify the navigation bar across all pages
// 
// Structure:
// - logo: Logo image and text settings
// - menuItems: Array of menu items (can be simple links or dropdowns)
//   - type: "link" for simple links, "dropdown" for dropdown menus
//   - text: Display text
//   - href: Link URL (for links) or parent page URL (for dropdowns)
//   - items: Array of sub-items (only for dropdowns)

const navConfig = {
    logo: {
        image: "assets/images/NRCGA-Logo_Badge-Color-300x272.png",
        alt: "NRCGA Logo",
        text: "Nevada Regional Common Ground Alliance",
        link: "index.html"
    },
    menuItems: [
        {
            type: "dropdown",
            text: "About NRCGA",
            href: "about.html",
            items: [
                { text: "About NRCGA", href: "about.html" },
                { text: "Members", href: "members.html" },
                { text: "Bylaws & Standing Rules", href: "bylaws.html" },
                { text: "Archive", href: "archive.html" },
                { text: "Calendar", href: "calendar.html" }
            ]
        },
        {
            type: "dropdown",
            text: "About 811",
            href: "about-811.html",
            items: [
                { text: "About 811", href: "about-811.html" },
                { text: "Create a Ticket", href: "https://usanorth811.org/", external: true },
                { text: "General Questions", href: "about-811-questions.html" },
                { text: "EPR Codes", href: "https://usanorth811.org/assets/PDF/NV-EPR-Codes_Update-Announcment.pdf", external: true}
            ]
        },
        {
            type: "dropdown",
            text: "Safety & Training",
            href: "training.html",
            items: [
                { text: "Education and Training", href: "training.html" },
                { text: "Training Schedule", href: "https://luma.com/calendar/cal-9DDWMhenRIXr0U5", external: true},
                { text: "Request Training", href: "training.html#request-training"},
                { text: "Training Database", href: "https://nrcga-my.sharepoint.com/:x:/g/personal/admin_nrcga_onmicrosoft_com/IQC7Yc8zSWelS5dOo4v4xgbwAUgTRtrCv_I_VR9y58OTZQ8?e=mmh953&nav=MTVfezg2REVGNTM2LTU1QkItNDlGRS04NjY1LTEyRUY2QjVFMzc0RX0"}
            ]
        },
        {
            type: "link",
            text: "Programs & Committees",
            href: "programs.html"
        },
        {
            type: "link",
            text: "Nevada Data",
            href: "data-maps.html"
        },
        {
            type: "link",
            text: "Contact Us",
            href: "contact.html"
        }
    ]
};

