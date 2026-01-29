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
                { text: "Calendar", href: "index.html#calendar" }
            ]
        },
        {
            type: "dropdown",
            text: "About 811",
            href: "about-811.html",
            items: [
                { text: "About 811", href: "about-811.html" },
                { text: "Create a Ticket", href: "https://usanorth811.org/", external: true },
                { text: "General Questions", href: "about-811-questions.html" }
            ]
        },
        {
            type: "dropdown",
            text: "Safety & Training",
            href: "training.html",
            items: [
                { text: "Education and Training", href: "training.html" },
                { text: "Request Training", href: "training.html#request-training", external: true },
                { text: "Training Database", href: "about-811-questions.html", external: true }
            ]
        },
        {
            type: "link",
            text: "Programs & Committees",
            href: "programs.html"
        },
        {
            type: "link",
            text: "Nevada DIRT",
            href: "data-maps.html"
        },
        {
            type: "link",
            text: "Contact Us",
            href: "contact.html"
        }
    ]
};

