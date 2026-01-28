# Website Management Guide

## Notes to the Future Maintainer

Welcome! You've taken on an important responsibility. This website is central to NRCGA's mission: Facilitate communication and collaboration within Nevada's damage prevention community.

You might wonder why this is a custom-built static site rather than a WordPress page or similar CMS. The answer is freedom. This approach gives our community the flexibility to innovate, experiment, and adapt quickly to new needs without being constrained by a single system's limitations.

This documentation is here to help you succeed. The site is designed to be maintainable by someone with basic technical skills, and most updates are straightforward edits to simple configuration files. When you need help, don't hesitate to reach out—the technical support contact information is above.

Take ownership of this project. Make it your own. The community will benefit from your care and creativity.

Good luck, and thank you for continuing this work.

*—Charles Folashade Jr, 2026*

This document provides instructions for managing and updating content on the NRCGA website.

## Table of Contents
- [Updating the Navigation Bar](#updating-the-navigation-bar)
- [Updating Members Data](#updating-members-data)
- [Updating Archive Links](#updating-archive-links)
- [Updating Programs](#updating-programs)
- [Updating the Front Page Carousel and Breaking News](#updating-the-front-page-carousel-and-breaking-news)
- [Deploying Files to the Website](#deploying-files-to-the-website)
- [Backend API Configuration](#backend-api-configuration)
- [Technical Assistance Contact](#technical-assistance-contact)

---

## Updating the Navigation Bar

The navigation bar is now **dynamically loaded** from a simple configuration file, making it very easy to update without touching any code!

### Location
The navigation bar configuration is located in: **`js/nav-config.js`**

### How to Update

1. **Open the file**: `js/nav-config.js`

2. **Edit the configuration object** - it's a simple JavaScript object with clear structure

3. **Save the file** - changes will automatically appear on all pages

### Configuration Structure

The file contains a `navConfig` object with two main sections:

#### Logo Settings
```javascript
logo: {
    image: "assets/images/NRCGA-Logo_Badge-Color-300x272.png",  // Logo image path
    alt: "NRCGA Logo",                                            // Alt text for logo
    text: "Nevada Regional Common Ground Alliance",              // Logo text
    link: "index.html"                                            // Where logo links to
}
```

#### Menu Items
The `menuItems` array contains all navigation menu items. Each item can be either:
- **Simple Link** (`type: "link"`)
- **Dropdown Menu** (`type: "dropdown"`)

### Common Updates

#### Adding a New Simple Menu Item
Add a new object to the `menuItems` array:

```javascript
{
    type: "link",
    text: "New Page",
    href: "new-page.html"
}
```

#### Adding a New Dropdown Menu
Add a new object with `type: "dropdown"` and an `items` array:

```javascript
{
    type: "dropdown",
    text: "Menu Name",
    href: "parent-page.html",
    items: [
        { text: "Child Page 1", href: "child-page-1.html" },
        { text: "Child Page 2", href: "child-page-2.html" }
    ]
}
```

#### Adding External Links (Opens in New Tab)
For external links, add `external: true`:

```javascript
{
    text: "External Site",
    href: "https://example.com",
    external: true
}
```

#### Updating Existing Items
Simply edit the `text` or `href` values in the configuration file.

#### Reordering Menu Items
Move items up or down in the `menuItems` array to change their order.

### Example: Complete Configuration

```javascript
menuItems: [
    {
        type: "dropdown",
        text: "About NRCGA",
        href: "about.html",
        items: [
            { text: "About NRCGA", href: "about.html" },
            { text: "Members", href: "members.html" }
        ]
    },
    {
        type: "link",
        text: "Contact Us",
        href: "contact.html"
    }
]
```

### Important Notes

- **No code knowledge required** - Just edit the simple configuration object
- **Automatic updates** - Changes apply to all pages automatically
- **Active page highlighting** - The current page is automatically highlighted (no configuration needed)
- **Mobile responsive** - All changes work automatically on mobile devices
- **Syntax matters** - Make sure to:
  - Use commas between items (except the last one)
  - Use quotes around text values
  - Match opening and closing braces `{ }` and brackets `[ ]`

---

## Updating Members Data

Members data is stored in a **JavaScript file** for easy editing. The format is simple and works without needing a web server.

### Location
The members data file is located in: **`data/members.js`**

### File Structure

The file contains a JavaScript array called `membersData` with member objects. Each member has these properties:
- **Type**: The type of member (`"Officer"`, `"Director"`, `"Stakeholder"`, or `"Associate"`)
- **Company Name**: The name of the company or person
- **Stakeholder Group**: The stakeholder category (e.g., `"Excavator"`, `"Locator"`, `"Chair"`, `"Vice Chair"`)
- **Voting Member**: Whether they are a voting member (`"Yes"` or `"No"`)
- **Website**: Company website URL (optional, use `""` if none)
- **Category**: Additional category information
- **Term**: Term dates for officers/directors (optional, use `""` if none)
- **Contact Person**: Contact person name (optional, use `""` if none)

### Important Note About Officers and Directors

**The formatting for Officers and Directors may seem counterintuitive at first glance.** For these member types:
- **"Company Name"** field contains the **person's name** (e.g., "Kristen Garcia", "Ryan White")
- **"Contact Person"** field contains the **company/organization name** (e.g., "NV Energy", "USA North")

This is how the file was originally formatted and must be maintained this way for the website to display correctly. **When adding or updating Officers or Directors, match the existing format in the config file** - use the person's name in "Company Name" and the organization in "Contact Person".

### How to Update

1. **Open the file**: `data/members.js` in any text editor

2. **Add a new member**: Add a new object to the array:
   ```javascript
   { Type: "Stakeholder", "Company Name": "New Company", "Stakeholder Group": "Excavator", "Voting Member": "Yes", Website: "https://newcompany.com", Category: "Excavator", Term: "", "Contact Person": "John Doe" },
   ```

3. **Update an existing member**: Find the member object and edit the values

4. **Remove a member**: Delete the entire object (including the comma before it)

5. **Save the file** - changes will appear on the members page automatically

### Format Rules

- **Use commas between objects**: Each member object is separated by a comma (except the last one)
- **Use quotes for text values**: All text values must be in quotes: `"Company Name"`
- **Empty values**: Use empty quotes: `""` for optional fields
- **Trailing comma**: The last object in the array should NOT have a comma after it

### Example Entry

```javascript
{ Type: "Stakeholder", "Company Name": "ABC Excavation", "Stakeholder Group": "Excavator", "Voting Member": "Yes", Website: "https://abcexcavation.com", Category: "Excavator", Term: "", "Contact Person": "John Smith" },
{ Type: "Associate", "Company Name": "XYZ Services", "Stakeholder Group": "", "Voting Member": "No", Website: "https://xyzservices.com", Category: "Associate", Term: "", "Contact Person": "" },
{ Type: "Officer", "Company Name": "Jane Doe", "Stakeholder Group": "Chair", "Voting Member": "Yes", Website: "", Category: "Officer", Term: "2025-2026", "Contact Person": "ABC Company" },
```

### Member Types

- **Officer**: Board officers (Chair, Vice Chair, etc.) - displayed in Officers table
- **Director**: Board directors - displayed in Directors table  
- **Stakeholder**: Stakeholder members - displayed in Stakeholder Members grid
- **Associate**: Associate members - displayed in Associate Members grid

### Tips

- **Backup first**: Make a copy of the file before making major changes
- **Test after changes**: Refresh the members page to verify your changes display correctly
- **Check syntax**: Make sure all quotes, commas, and braces are correct
- **Browser console**: If members don't display, check the browser console (F12) for errors
- **Copy-paste format**: When adding new members, copy an existing entry and modify it to ensure correct format

---

## Updating Archive Links

Archive links (meeting minutes and historical documents) are stored in a **JavaScript configuration file** for easy editing.

### Location
The archive data file is located in: **`data/archive.js`**

### File Structure

The file contains a JavaScript array called `archiveData` with archive item objects. Each item has these properties:
- **type**: The type of archive item (`"meeting-minute"` or `"historical-document"`)
- **title**: Display title for the document
- **date**: Date string (format: `"YYYY-MM-DD"` or `"Month DD, YYYY"`)
- **link**: URL or file path to the document

### How to Update

1. **Open the file**: `data/archive.js` in any text editor

2. **Add a new archive item**: Add a new object to the array:
   ```javascript
   { type: "meeting-minute", title: "March 15, 2026 NRCGA Minutes", date: "2026-03-15", link: "assets/meeting-minutes/15March2026NRCGA_Minutes.pdf" },
   ```

3. **Update an existing item**: Find the item object and edit the values

4. **Remove an item**: Delete the entire object (including the comma before it)

5. **Save the file** - changes will appear on the archive page automatically

### Format Rules

- **Use commas between objects**: Each archive item is separated by a comma (except the last one)
- **Use quotes for text values**: All text values must be in quotes: `"Meeting Minutes"`
- **Date format**: Use `"YYYY-MM-DD"` format (e.g., `"2025-03-11"`) for best results
- **Link format**: 
  - For local files: `"assets/meeting-minutes/filename.pdf"`
  - For external links: `"https://example.com/link"`

### Example Entries

```javascript
// Meeting Minute
{ type: "meeting-minute", title: "March 15, 2026 NRCGA Minutes", date: "2026-03-15", link: "assets/meeting-minutes/15March2026NRCGA_Minutes.pdf" },

// Historical Document (external link)
{ type: "historical-document", title: "Silver Shovel 2025 Photos", date: "2025-04-30", link: "https://photos.google.com/share/..." },

// Historical Document (local file)
{ type: "historical-document", title: "2025 Annual Report", date: "2025-12-31", link: "assets/documents/2025-annual-report.pdf" },
```

### Archive Types

- **meeting-minute**: Meeting minutes and records - displayed in Meeting Minutes section
- **historical-document**: News articles, photos, reports, etc. - displayed in Historical Documents section

### Display Features

- **Automatic organization**: Items are automatically grouped by year (newest first)
- **Date formatting**: Dates are automatically formatted for display
- **External link handling**: External links (http:// or https://) open in new tabs
- **Icon selection**: Icons are automatically selected based on link type (📄 for documents, 📷 for photos, etc.)

### Tips

- **Backup first**: Make a copy of the file before making major changes
- **Test after changes**: Refresh the archive page to verify your changes display correctly
- **Check syntax**: Make sure all quotes, commas, and braces are correct
- **Browser console**: If items don't display, check the browser console (F12) for errors
- **Copy-paste format**: When adding new items, copy an existing entry and modify it to ensure correct format

---

## Updating Programs

Programs and committees are stored in a **JavaScript configuration file** for easy editing.

### Location
The programs data file is located in: **`data/programs.js`**

### File Structure

The file contains a JavaScript array called `programsData` with program objects. Each program has these properties:
- **title**: Program/committee name
- **description**: Short description of the program
- **link**: URL or file path to the program page
- **icon**: Emoji icon for the program (optional, defaults to 📄)
- **order**: Display order number (lower numbers appear first, optional)
- **form**: Optional iframe URL for embedding a form on the individual program page (e.g., Google Forms, Typeform, etc.)

### How to Update

1. **Open the file**: `data/programs.js` in any text editor

2. **Add a new program**: Add a new object to the array:
   ```javascript
   {
       title: "New Program Name",
       description: "Description of what this program does and its purpose.",
       link: "new-program.html",
       icon: "🎯",
       order: 10,
       form: "https://docs.google.com/forms/d/e/1FAIpQLSd..." // Optional
   },
   ```

3. **Update an existing program**: Find the program object and edit the values

4. **Remove a program**: Delete the entire object (including the comma before it)

5. **Reorder programs**: Change the `order` value (lower numbers appear first)

6. **Save the file** - changes will appear on the programs page automatically

### Format Rules

- **Use commas between objects**: Each program is separated by a comma (except the last one)
- **Use quotes for text values**: All text values must be in quotes: `"Program Name"`
- **Link format**: 
  - For local pages: `"program-page.html"`
  - For external links: `"https://example.com/program"`
- **Icon**: Use emoji characters directly: `"🎓"` or `"⭐"`

### Example Entry

```javascript
{
    title: "Excavator Safety Training",
    description: "Our comprehensive training programs combine classroom education with real-world scenarios at mock jobsites.",
    link: "training.html",
    icon: "🎓",
    order: 1,
    form: "https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?embedded=true" // Optional
},
```

### Program Properties

- **title**: Display name of the program (required)
- **description**: Brief description shown on the programs page (required)
- **link**: Link to the program's detail page (required)
- **icon**: Emoji icon displayed in the program card (optional)
- **order**: Number controlling display order - lower numbers appear first (optional, defaults to end of list)
- **form**: URL for an iframe-embedded form (e.g., Google Forms) that will appear on the individual program page (optional)

### Adding Forms to Program Pages

If you want to add a form (like a registration form, contact form, or survey) to a specific program page:

1. **Create or get the form URL**: 
   - For Google Forms: Create a form, click "Send", then click the `</>` icon to get the embed URL
   - For other form services: Get the iframe embed URL from your form provider

2. **Add the form field to the program**:
   ```javascript
   {
       title: "Golf Tournament Fundraiser",
       description: "Annual fundraising event...",
       link: "golf-tournament.html",
       icon: "⛳",
       order: 5,
       form: "https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform?embedded=true"
   },
   ```

3. **Add the form placeholder to the program page**:
   - Open the individual program HTML file (e.g., `golf-tournament.html`)
   - Add this placeholder div where you want the form to appear (typically before the "Get Involved" section):
     ```html
     <!-- Program Form Section (will be populated if form is configured in data/programs.js) -->
     <div id="program-form-placeholder"></div>
     ```

4. **Add the script tags** (if not already present):
   ```html
   <script src="data/programs.js"></script>
   <script src="js/program-form-loader.js"></script>
   ```

5. **Save and test**: The form will automatically appear on the program page if configured correctly.

**Note**: The form will only appear if:
- The program has a `form` field in `data/programs.js`
- The program page has the `<div id="program-form-placeholder"></div>` placeholder
- The program page loads `data/programs.js` and `js/program-form-loader.js`

### Display Features

- **Automatic sorting**: Programs are automatically sorted by `order` value (if specified)
- **External link handling**: External links (http:// or https://) open in new tabs
- **Responsive design**: Program cards automatically adapt to screen size
- **Hover effects**: Cards have hover animations for better user experience

### Tips

- **Backup first**: Make a copy of the file before making major changes
- **Test after changes**: Refresh the programs page to verify your changes display correctly
- **Check syntax**: Make sure all quotes, commas, and braces are correct
- **Browser console**: If programs don't display, check the browser console (F12) for errors
- **Copy-paste format**: When adding new programs, copy an existing entry and modify it to ensure correct format
- **Order numbers**: Use increments of 10 (1, 10, 20, 30...) to make it easy to insert new programs between existing ones

---

## Updating the Front Page Carousel and Breaking News

The carousel and breaking news popup on the front page (homepage) are configured in a **JavaScript configuration file** for easy editing.

### Location
The front page configuration file is located in: **`data/front-page.js`**

### File Structure

The file contains a JavaScript object called `frontPageConfig` with two main sections:

#### Carousel Images

The `carousel` array contains image objects. Each image has these properties:
- **image_url**: URL to the image (required)
- **alt_text**: Alt text for accessibility (required)
- **link_url**: Optional URL to link the image to (can be `null` or empty string)
- **display_order**: Order in which images appear (lower numbers appear first, optional)
- **active**: Whether the image is active/visible (`1` = active, `0` = inactive, optional, defaults to `1`)

#### Breaking News Popup

The `breakingNews` object contains popup configuration:
- **active**: Whether the popup is enabled (`true` = show, `false` = hide, optional, defaults to `false`)
- **title**: Title/headline for the breaking news (required if active is `true`)
- **content**: Main text content of the breaking news (required if active is `true`)
- **image_url**: Optional image URL to display in the popup (optional)
- **read_more_url**: Optional URL for "Read More" button (optional)
- **storage_key**: Unique identifier for localStorage to prevent showing again if dismissed (optional)

### How to Update

1. **Open the file**: `data/front-page.js` in any text editor

2. **Add a new carousel image**: Add a new object to the `carousel` array:
   ```javascript
   {
       image_url: "https://example.com/image.jpg",
       alt_text: "Description of the image",
       link_url: "https://example.com/page", // Optional - can be null
       display_order: 5,
       active: 1
   },
   ```

3. **Update an existing image**: Find the image object in the `carousel` array and edit the values

4. **Remove an image**: Delete the entire object from the `carousel` array (including the comma before it)

5. **Reorder images**: Change the `display_order` value (lower numbers appear first)

6. **Temporarily hide an image**: Set `active: 0` instead of deleting it

7. **Enable/Configure Breaking News**: Edit the `breakingNews` object:
   ```javascript
   breakingNews: {
       active: true,  // Set to true to show the popup
       title: "Important Announcement",
       content: "This is the main message for the breaking news popup.",
       image_url: "https://example.com/news-image.jpg",  // Optional
       read_more_url: "archive.html#historical-documents",  // Optional
       storage_key: "nrcga_breaking_news_dismissed"
   }
   ```

8. **Disable Breaking News**: Set `active: false` in the `breakingNews` object

9. **Save the file** - changes will appear on the front page automatically

### Format Rules

- **Use commas between objects**: Each carousel object is separated by a comma (except the last one)
- **Use quotes for text values**: All text values must be in quotes: `"Image URL"`
- **Image URL format**: 
  - For external images: `"https://example.com/image.jpg"`
  - For local images: `"assets/images/carousel/image.jpg"`
- **Link URL**: Can be a full URL, relative path, or `null` if the image shouldn't be clickable
- **Active status**: Use `1` for active (visible) or `0` for inactive (hidden)

### Example Entries

**Carousel Image:**
```javascript
{
    image_url: "https://storage.googleapis.com/nodeodm-outputs-v1/outputs/WILD_HORSE_35202ad3/images/DJI_20250526135552_0040_V.JPG",
    alt_text: "Aerial view of excavation site",
    link_url: "programs.html",
    display_order: 0,
    active: 1
},
```

**Breaking News Popup:**
```javascript
breakingNews: {
    active: true,
    title: "New Training Program Available",
    content: "We're excited to announce our new comprehensive safety training program starting next month. Register now to secure your spot!",
    image_url: "assets/images/news/training-announcement.jpg",
    read_more_url: "training.html",
    storage_key: "nrcga_breaking_news_dismissed"
}
```

### Carousel Image Properties

- **image_url**: URL to the image file (required)
- **alt_text**: Alternative text for screen readers and accessibility (required)
- **link_url**: URL to link to when image is clicked (optional - use `null` or empty string for no link)
- **display_order**: Number controlling display order - lower numbers appear first (optional, defaults to 0)
- **active**: Whether the image is visible (`1` = active, `0` = inactive, optional, defaults to `1`)

### Breaking News Properties

- **active**: Whether the popup is enabled (`true` = show, `false` = hide, optional, defaults to `false`)
- **title**: Title/headline displayed in the popup (required if active is `true`)
- **content**: Main text content displayed in the popup (required if active is `true`)
- **image_url**: Optional image URL to display in the popup (optional)
- **read_more_url**: Optional URL for the "Read More" button - if provided, button will be shown (optional)
- **storage_key**: Unique identifier for localStorage - prevents showing popup again if user checks "Don't show again" (optional, defaults to `"nrcga_breaking_news_dismissed"`)

### Display Features

**Carousel:**
- **Automatic sorting**: Images are automatically sorted by `display_order` value (if specified)
- **Auto-play**: Carousel automatically advances every 5 seconds
- **Pause on hover**: Auto-play pauses when you hover over the carousel
- **Navigation controls**: Previous/Next buttons and dot indicators for manual navigation
- **Clickable images**: Images with `link_url` set become clickable links
- **Responsive design**: Carousel automatically adapts to screen size
- **Lazy loading**: Images load efficiently for better performance

**Breaking News Popup:**
- **Conditional display**: Only shows if `active` is set to `true`
- **Dismiss functionality**: Users can close the popup or check "Don't show again"
- **LocalStorage**: Remembers if user dismissed the popup (won't show again)
- **Optional image**: Can display an image in the popup
- **Optional "Read More" button**: Can link to a specific page for more information
- **Responsive design**: Popup adapts to screen size

### Tips

- **Backup first**: Make a copy of the file before making major changes
- **Test after changes**: Refresh the front page to verify your changes display correctly
- **Check syntax**: Make sure all quotes, commas, and braces are correct
- **Browser console**: If images don't display, check the browser console (F12) for errors
- **Copy-paste format**: When adding new images, copy an existing entry and modify it to ensure correct format
- **Order numbers**: Use increments of 10 (0, 10, 20, 30...) to make it easy to insert new images between existing ones
- **Image optimization**: Use optimized images (compressed, appropriate size) for faster loading
- **Alt text**: Always provide descriptive alt text for accessibility
- **Temporary hiding**: Use `active: 0` to temporarily hide images without deleting them
- **Breaking news storage**: Each breaking news item should have a unique `storage_key` if you want to show different news items over time
- **Breaking news reset**: To show the popup again after it's been dismissed, change the `storage_key` value or clear browser localStorage

---

## Deploying Files to the Website

After making changes to files, you need to upload them to the cloud storage where the website is hosted. The website files are stored in a cloud bucket (Likely either Cloudflare R2 or Google Cloud Platform as of 1/27/2026).

### Important Notes

- **Always test locally first**: Make sure your changes work by opening the HTML files in a browser before uploading
- **Backup before uploading**: Keep a copy of the files before making changes
- **Upload entire folder structure**: Maintain the same folder structure when uploading
- **File paths matter**: Don't change folder names or file locations - the website expects files in specific places

### Deployment Process

1. **Make your changes** to the files locally (on your computer)

2. **Test your changes**:
   - Open the HTML files in a web browser
   - Check that everything displays correctly
   - Use browser console (F12) to check for errors

3. **Upload to cloud storage**:
   - **Cloudflare R2**: Use the R2 dashboard or upload tool to sync your `frontend` folder
   - **GCP Cloud Storage**: Use the Google Cloud Console or `gsutil` command to upload files
   - Make sure to upload the entire `frontend` folder structure, not just individual files

4. **Verify deployment**:
   - Visit the live website
   - Check that your changes appear correctly
   - Test on different pages if you made site-wide changes

### Common Deployment Issues

- **Files not updating**: Clear your browser cache (Ctrl+F5) or wait a few minutes for CDN cache to clear
- **Broken images/links**: Check that file paths are correct and files were uploaded to the right location
- **JavaScript errors**: Check browser console (F12) for error messages - usually indicates a syntax error in a data file

### Getting Help

If you encounter issues during deployment:
1. Check the browser console (F12) for error messages
2. Verify file paths are correct
3. Make sure all files were uploaded (not just some)


---

## Backend API Configuration

The website connects to a backend API to fetch events and handle registrations. This configuration is **locked in place** and should **not be changed** unless instructed by technical support.

### Location

The backend API URL is configured in: **`data/api-config.js`**

### Current Configuration

```javascript
window.API_BASE_URL = 'https://nrcgaapi.thefieldmappinggroup.com/api';
```

### Important Notes

- **DO NOT CHANGE THIS**: The backend URL is set to the production server and should remain unchanged
- **Backend is stable**: The backend runs on a GCP VM and the URL will not change
- **No updates needed**: You don't need to modify this file for normal website management
- **If the URL changes**: Only update this if explicitly instructed by technical support (this should be rare)

### What This Does

This configuration tells the website where to fetch:
- Event data and availability
- Registration submissions
- Other dynamic content from the backend

### Troubleshooting

If events or registrations stop working:
1. **Check the backend URL**: Verify `data/api-config.js` still has the correct URL
2. **Check browser console**: Open browser console (F12) and look for API errors
3. **Contact technical support**: Backend issues require technical assistance. See the Technical Assistance Contact section below.

### When to Update

You should **only** update this file if:
- Technical support explicitly tells you the backend URL has changed
- You're setting up a development/test environment (and you know what you're doing)

**For normal website management, you should never need to touch this file.**

---

## Technical Assistance Contact

**Current Technical Support (as of 2026):**

Charles Folashade Jr created this website. If you can find him, he will likely still help you with fixing any issues you may come across.

**Contact Information:**
- **Name**: Charles Folashade Jr
- **Email**: folashade96@gmail.com
- **Phone**: 410-709-8225 or 702-202-8319

---


*More sections coming soon...*

