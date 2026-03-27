# Website Management Guide

## Notes to the Future Maintainer

Welcome! You've taken on an important responsibility. This website is central to NRCGA's mission: Facilitate communication and collaboration within Nevada's damage prevention community.

You might wonder why this is a custom-built static site rather than a WordPress page or similar CMS. The answer is freedom. This approach gives our community the flexibility to innovate, experiment, and adapt quickly to new needs without being constrained by a single system's limitations.

This documentation is here to help you succeed. The site is designed to be maintainable by someone with basic technical skills, and most updates are straightforward edits to **CSV data files** under `data/` (and `assets/` where noted) plus the navigation config in `js/nav-config.js`. When you need help, don't hesitate to reach out—the technical support contact information is below.

Take ownership of this project. Make it your own. The community will benefit from your care and creativity.

You got this, and thank you for continuing this work.

*—Charles Folashade Jr, 2026*

This document provides instructions for managing and updating content on the NRCGA website.

## Table of Contents
- [CSV data files (overview)](#csv-data-files-overview)
- [Updating the Navigation Bar](#updating-the-navigation-bar)
- [Updating Members Data](#updating-members-data)
- [Updating Archive Links](#updating-archive-links)
- [Updating Programs](#updating-programs)
- [Updating the Front Page Carousel and Breaking News](#updating-the-front-page-carousel-and-breaking-news)
- [Updating Committee Enrollment](#updating-committee-enrollment)
- [Updating Zero at Fault Damages List](#updating-zero-at-fault-damages-list)
- [Deploying Files to the Website](#deploying-files-to-the-website)
- [Technical Assistance Contact](#technical-assistance-contact)

---

## CSV data files (overview)

List-style and table content is stored in **CSV** (comma-separated values) files. Pages load them in the browser with `js/csv-parser.js` (`loadCSV`). Use a **local HTTP server** when testing (not `file://`), because `fetch()` is used to read the files.

| File | Used on / by |
|------|----------------|
| **`data/members.csv`** | `members.html` — `js/members-loader.js` |
| **`data/archive.csv`** | `archive.html` — `js/archive-loader.js` |
| **`data/programs.csv`** | `programs.html` — `js/programs-loader.js` |
| **`data/front-page-carousel.csv`** | Home page — `js/carousel-loader.js` (carousel) |
| **`data/front-page-breaking-news.csv`** | Home page — `js/carousel-loader.js` (popup; **only the first data row** is used) |
| **`data/committee-members-committees.csv`** | `committee-enrollment.html` — committee id → display name |
| **`data/committee-members-members.csv`** | `committee-enrollment.html` — people and per-committee membership codes |
| **`assets/zerodamages.csv`** | `zero-at-fault-damages.html` — `js/zero-at-fault-damages-loader.js` |

### CSV editing rules (all files)

- **Keep the header row** as the first line; column names must stay exactly as documented in each section below (the loaders map rows to those names).
- **Commas inside a value** must be wrapped in double quotes, e.g. `"January 13, 2026 Minutes"`.
- **Double quotes inside a value** are escaped by doubling them: `"He said ""hello"""`.
- After editing, open the relevant page over **http://localhost** (see README) and check the browser console (F12) for load or parse errors.

---

## Updating the Navigation Bar

The navigation bar is **dynamically loaded** from a simple configuration file, making it very easy to update without editing multiple pages!

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

Members data is stored in **`data/members.csv`**. It is loaded on `members.html` by `js/members-loader.js` (with `js/csv-parser.js`).

### Location
**`data/members.csv`**

### CSV columns (header row)

The first line must be exactly:

```text
Type,Company Name,Stakeholder Group,Voting Member,Website,Category,Term,Contact Person
```

Each following row is one member:

- **Type**: `Officer`, `Director`, `Stakeholder`, or `Associate`
- **Company Name**: For stakeholders/associates, enter the company name; see note below for officers/directors
- **Stakeholder Group**: e.g. `Excavator`, `Locator`, `Chair`, `Vice Chair` (can be empty where appropriate)
- **Voting Member**: `Yes` or `No`
- **Website**: Full URL or empty
- **Category**: Display category (e.g. `Officer`, `Excavator`)
- **Term**: Term label for officers/directors (e.g. `2025-2026`) or empty
- **Contact Person**: Contact name or empty; see note below for officers/directors

### Important note about Officers and Directors

For **Officer** and **Director** rows, the columns are used in a specific way on the site:

- **Company Name** holds the **person's name** (e.g. Kristen Garcia).
- **Contact Person** holds the **organization name** (e.g. NV Energy).

Keep that pattern when adding or editing officers and directors so tables still render correctly.

### Example rows

```csv
Type,Company Name,Stakeholder Group,Voting Member,Website,Category,Term,Contact Person
Stakeholder,ABC Excavation,Excavator,Yes,https://abcexcavation.com,Excavator,,
Associate,XYZ Services,,No,https://xyzservices.com,Associate,,
Officer,Jane Doe,Chair,Yes,,Officer,2025-2026,ABC Company
```

### Member types (display)

- **Officer** — Officers table  
- **Director** — Directors table  
- **Stakeholder** — Stakeholder members grid  
- **Associate** — Associate members grid  

### Tips

- **Backup first** before bulk edits  
- **Test** on `members.html` over a local HTTP server  
- **Copy an existing row** and change values to avoid column mistakes  
- If the page is blank, open the **browser console (F12)** for CSV or network errors  

---

## Updating Archive Links

Archive links (meeting minutes and historical documents) are stored in **`data/archive.csv`**, loaded on `archive.html` by `js/archive-loader.js`.

### Location
**`data/archive.csv`**

### CSV columns (header row)

The first line must be:

```text
type,title,date,link
```

Each data row is one item:

- **type**: `meeting-minute` or `historical-document`
- **title**: Title shown in the list (wrap in quotes if it contains commas)
- **date**: Prefer `YYYY-MM-DD` for consistent sorting (e.g. `2026-03-15`)
- **link**: Full `https://...` URL or a site-relative path such as `assets/meeting-minutes/filename.pdf`

### Example rows

```csv
type,title,date,link
meeting-minute,"March 15, 2026 NRCGA Minutes",2026-03-15,assets/meeting-minutes/15March2026NRCGA_Minutes.pdf
historical-document,Silver Shovel 2025 Photos,2025-04-30,https://photos.google.com/share/...
historical-document,2025 Annual Report,2025-12-31,assets/documents/2025-annual-report.pdf
```

### Archive types (display)

- **meeting-minute** — Meeting Minutes section  
- **historical-document** — Historical Documents section  

### Display behavior

Items are grouped by year (newest first). External `http`/`https` links open in a new tab; the loader also picks icons by link type where supported.

### Tips

- **Backup first**  
- **Test** on `archive.html` over HTTP  
- **Copy an existing row** when adding entries  
- Use the **browser console (F12)** if nothing appears after a change  

---

## Updating Programs

Programs and committees are stored in **`data/programs.csv`**. The programs list on `programs.html` is filled by `js/programs-loader.js`. To add a form on a program page, embed **Microsoft Forms** (or similar) directly in that page’s HTML—there is no CSV-driven form loader.

### Location
**`data/programs.csv`**

### CSV columns (header row)

The first line must be:

```text
title,description,link,icon
```

- **title**: Name shown on the programs page  
- **description**: Short paragraph under the title (if it contains commas, wrap the whole field in double quotes)  
- **link**: Page filename (e.g. `training.html`) or a full `https://` URL for an external program site  
- **icon**: Single emoji for the card (e.g. `🎓`)  

### Display order

On `programs.html`, programs are sorted **alphabetically by title** (not by a separate order column).

### Example row

```csv
title,description,link,icon
"Excavator Safety Training","Our comprehensive training programs combine classroom education with real-world scenarios at mock jobsites.",training.html,🎓
```

### Tips

- **Backup** `data/programs.csv` before large edits  
- **Match `link`** to the actual HTML filename for internal program pages  
- **External program links**: Use a full `https://` URL in **link**; those cards open in a new tab  
- Use **F12** if the list fails to load  

---

## Updating the Front Page Carousel and Breaking News

The home page carousel and breaking news popup are driven by **two CSV files**, both loaded by `js/carousel-loader.js` (with `js/csv-parser.js` on `index.html`).

### Carousel — location and columns

**File:** `data/front-page-carousel.csv`

**Header row:**

```text
image_url,alt_text,link_url,display_order,active
```

- **image_url**: Full URL or path to the image (required)  
- **alt_text**: Accessibility text (required)  
- **link_url**: Where the slide links when clicked; leave empty for no link  
- **display_order**: Integer; lower values appear first among active slides  
- **active**: `1` = show in carousel, `0` = hidden (keeps the row without deleting it)  

**Example row:**

```csv
image_url,alt_text,link_url,display_order,active
https://example.org/assets/images/hero.jpg,Locate Rodeo,utility-locate-rodeo.html,10,1
```

**Behavior:** Active rows are sorted by `display_order`. The carousel auto-advances about every five seconds and pauses on hover; slides with a `link_url` are clickable.

### Breaking news — location and columns

**File:** `data/front-page-breaking-news.csv`

**Header row:**

```text
active,title,content,image_url,read_more_url,storage_key
```

**Important:** The script uses **only the first data row** (the first line after the header). Extra rows are ignored.

- **active**: `true` to show the popup, `false` to hide it  
- **title**: Popup headline  
- **content**: Body text  
- **image_url**: Optional image above the text  
- **read_more_url**: If set, the “Read More” button navigates here  
- **storage_key**: Key used with “Don’t show again” in the browser; change this value to reset dismissal for a new announcement  

**Example row:**

```csv
active,title,content,image_url,read_more_url,storage_key
true,"Important Announcement","Short message for the popup.",https://example.org/news.jpg,training.html,nrcga_breaking_news_2026_03
```

### Tips

- **Backup** both CSV files before edits  
- **Test** on `index.html` over HTTP  
- **Carousel**: use `active` 0/1 to hide slides temporarily  
- **Breaking news**: toggle `active` to `false` instead of deleting the row if you want to reuse the copy later  
- Change **storage_key** when you want users who dismissed the old popup to see a new one  

---

## Updating Committee Enrollment

The committee enrollment page (`committee-enrollment.html`) loads **two CSV files** via inline script that calls `loadCSV` from `js/csv-parser.js`.

### Files

1. **`data/committee-members-committees.csv`** — defines each committee’s **id** and display **name**.  
2. **`data/committee-members-members.csv`** — one row per person; columns include contact fields plus **one numeric column per committee id** from the first file.

### `committee-members-committees.csv`

**Header:**

```text
id,name
```

- **id**: Short machine key used as the column name in the members file (e.g. `budget`, `811Day`, `golfTournament`). No spaces.  
- **name**: Human-readable committee name shown on the page.

**Example:**

```csv
id,name
budget,Budget Committee
golfTournament,Golf Tournament Fundraiser Committee
```

When you add a new committee, add a row here and add a **matching new column** on every row of the members CSV (see below).

### `committee-members-members.csv`

**Header row** starts with fixed columns, then **one column per committee id** (same spelling as `id` in the committees file):

```text
name,company,email,budget,811Day,craigRogers,educationTraining,golfTournament,utilityLocateRodeo,operations,silverShovel,techSolutions,embeddedFacilities
```

(Your file may include additional committee columns as you add them—keep header names aligned with `committee-members-committees.csv`.)

**Membership values** (per committee column):

- **0** — not on that committee  
- **1** — member  
- **2** — chair  

**Example row:**

```csv
name,company,email,budget,811Day,...
Jane Doe,ACME Inc.,jane@example.com,1,0,...
```

### Tips

- Edit **committees first**, then add matching columns to **members**  
- Use **0**, **1**, and **2** only (no text) in membership cells  
- **Backup** both files; a mismatched header (wrong id spelling) breaks the view  
- Test on **`committee-enrollment.html`** over HTTP  

---

## Updating Zero at Fault Damages List

The Zero at Fault Damages page uses **`assets/zerodamages.csv`**, loaded by `js/zero-at-fault-damages-loader.js`.

### Location
**`assets/zerodamages.csv`**

### Format

Single column with header:

```text
company
```

Each following row is one company name (one per line in the table).

**Example:**

```csv
company
A&G CONTRACTING LLC
ACME UNDERGROUND INC.
```

### Tips

- Keep the **`company` header**  
- One company per row; avoid extra commas in the name (or wrap the name in quotes if you must include a comma)  
- Test on **`zero-at-fault-damages.html`** over HTTP  

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
   - **Cloudflare R2**: Use the R2 dashboard or upload tool to sync the **site root** (the folder that contains `index.html`, `css/`, `js/`, `data/`, `assets/`)
   - **GCP Cloud Storage**: Use the Google Cloud Console or `gsutil` command to upload files
   - Keep the **same folder layout** as in this project; do not upload only loose files unless your host expects that

4. **Verify deployment**:
   - Visit the live website
   - Check that your changes appear correctly
   - Test on different pages if you made site-wide changes

### Common Deployment Issues

- **Files not updating**: Clear your browser cache (Ctrl+F5) or wait a few minutes for CDN cache to clear
- **Broken images/links**: Check that file paths are correct and files were uploaded to the right location
- **JavaScript or CSV errors**: Check browser console (F12) — bad CSV quoting, a missing column, or a wrong path often shows up as a load or parse error

### Getting Help

If you encounter issues during deployment:
1. Check the browser console (F12) for error messages
2. Verify file paths are correct
3. Make sure all files were uploaded (not just some)

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

