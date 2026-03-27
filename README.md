# NRCGA Website README

Static, multi-page site for NRCGA. This repository has **no backend API** and **no build step**: HTML, CSS, client-side JavaScript, CSV data under `data/`, and `assets/` are deployed as-is to any static host.

Calendars, forms, and similar flows rely on **embedded third-party widgets** (iframes)—for example **Luma** for public calendars and **Microsoft Forms** for contact and training-related submissions—so scheduling and form handling live on those services, not on custom API code in this repo.

## What's Included

- **HTML pages** — 27 pages with shared navigation and footer (`js/components.js`, `js/nav-config.js`)
- **CSS** — `css/styles.css`
- **JavaScript** — Navigation, theme toggle, mobile menu, smooth scrolling, and loaders that read local CSV files where applicable
- **Assets** — Images, PDFs, and other media in `assets/`
- **Data** — CSV sources in `data/` (carousel, breaking news, programs, members, archive, committee lists, etc.)

## Embedded content (iframes)

These embeds were consolidated and updated to use current Luma, Office Forms, PDF, and video URLs:

- **Luma event calendars** — `calendar.html` (general NRCGA events) and `training.html` (training schedule)
- **Microsoft Forms** — Contact, training, and other flows embedded on the relevant HTML pages (e.g. `index.html`, `contact.html`, `training.html`, `excavator-training-signin.html`)
- **PDFs in-page** — `bylaws.html` embeds bylaws and standing rules from `assets/pdfs/`
- **YouTube** — e.g. `craig-rogers-award.html`

## Content updates

Most list-style content is updated by editing the **CSV files** in `data/` and redeploying. See `MANAGEMENT.md` for operational detail.

## How to Use

1. **Local development**: Open `index.html` in a browser, or use a local static server (some loaders use `fetch()` for CSV files, which works more reliably over HTTP than with `file://`):

   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js (http-server)
   npx http-server -p 8000

   # Using PHP
   php -S localhost:8000
   ```

2. **Deployment**: See [Deployment](#deployment) below. **Cloudflare Pages** (GitHub → automatic deploys) is the recommended path; the README includes full step-by-step Cloudflare notes there.

   The site can also be deployed to GitHub Pages, Netlify, Vercel, AWS S3 + CloudFront, or any static web server.

## Deployment

### Cloudflare Pages — quick reference

Use **Cloudflare Pages** when you want the site on Cloudflare with HTTPS, a `*.pages.dev` URL, and deploys on every push to your production branch.

| Setting | Use this |
|--------|----------|
| **Production branch** | `main` (or whatever branch you use as default) |
| **Framework preset** | None |
| **Build command** | *(empty — no build for this repo)* |
| **Build output directory** | `/` or `.` — publish from the **repository root** (where `index.html` lives) |
| **Root directory** (if the UI shows it) | `/` when the repo root *is* the site (not a monorepo subfolder) |

**What you get:** Automatic TLS, deployment history and rollbacks in the Pages project, and preview URLs for non-production branches or pull requests when Git integration is enabled.

**Other Cloudflare paths:** If your team uses **Cloudflare R2** (or another bucket) instead of Pages, upload the same folder structure as this project; see `MANAGEMENT.md` under “Deploying Files to the Website.”

---

### Deploying to Cloudflare Pages via GitHub

Cloudflare Pages provides free hosting with automatic deployments from GitHub. Follow these steps:

#### Prerequisites

1. **GitHub Account**: You'll need a GitHub account (if you're seeing this you likely are already logged into it.)
2. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com) See google drive doc for this.
3. **Repository**: Push this frontend code to a GitHub repository

#### Step-by-Step Instructions

1. **Upload code to GitHub** (using GitHub web interface):

   - Go to [GitHub.com](https://github.com) and sign in
   - Click the **+** icon in the top right, then select **New repository**
   - Name your repository (e.g., `nrcga-website`)
   - Choose **Public** or **Private** (your choice)
   - **Do NOT** initialize with README, .gitignore, or license (we're uploading existing files)
   - Click **Create repository**
   - On the next page, you'll see "uploading an existing file" - click **uploading an existing file**
   - Drag and drop the **site root** (this folder: files like `index.html`, `css/`, `js/`, `data/`, `assets/`) into the upload area
   - Or click **choose your files** and select those files and folders
   - Scroll down and click **Commit changes**
   - Your code is now on GitHub!

2. **Connect to Cloudflare Pages** (using Cloudflare Dashboard):

   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) and log in
   - In the left sidebar, click **Compute** then **"Workers & Pages"**
   - Click the **Create application** button
   - You will see "Looking to deploy Pages" at the bottom. Click **Get started**.
   - Click **Import an existing Git repository** button
   - You'll see a list of Git providers - click **GitHub** and login to the nrcga github account.
   - Authorize Cloudflare to access your GitHub account (click **Authorize Cloudflare**)
   - Select the repository you just created from the list
   - Click **Begin setup**

3. **Configure Build Settings** (in Cloudflare setup form):

   - **Project name**: Enter a name (e.g., `nrcga-website`) - this will be part of your development url. It's not really important what this is named.
   - **Production branch**: select **main**
   - **Framework preset**: Leave this as **None**
   - **Build command**: Leave this blank. It should not require any commands, but if the field is requiring a command and won't let you leave it empty, try `echo "Static site - no deploy needed"` (this is just a placeholder that does nothing)
   - **Build output directory**: Leave this blank
   - **Root Directory**: Leave this blank.
   - **Environment variables**: Leave this section empty.
   - Scroll down and click **Save and Deploy** (or **Deploy site**)

   **Note**: If the deploy command field allows you to leave it empty, do so. Only use the placeholder command if the form requires a value.

4. **Wait for Deployment**:

   - Cloudflare will start deploying your site automatically
   - You'll see a progress indicator
   - This usually takes 1-2 minutes
   - When complete, you'll see a success message with your site URL (e.g., `nrcga-website.pages.dev`)

5. **Set Up Custom Domain** (optional - using Cloudflare Dashboard):

   - After deployment completes, click on your project name
   - Click the **Custom domains** tab
   - Click **Set up a custom domain**
   - Enter the site domain name (e.g., `nrcga.org`)
   - Click **Activate domain**

#### Automatic Deployments

- **Automatic**: Every change made to the `main` branch will automatically update the website. updates typically take a minute to reflect.
- **Build logs**: View build and deployment logs in the Cloudflare dashboard

#### Updating the Site (using GitHub web interface)

1. **Make changes to files**:

   - Go to your GitHub repository
   - Navigate to the file you want to edit
   - Click the **pencil icon** (✏️) to edit the file
   - Make your changes in the editor
   - Scroll down and click **Commit changes**
   - Add a commit message (e.g., "Update events" or "Fix typo")
   - Click **Commit changes** button

2. **Automatic Deployment**:

   - Cloudflare Pages automatically detects the change
   - A new deployment will start automatically (you'll see it in Cloudflare dashboard)
   - Deployment typically takes 1-2 minutes
   - Your changes will be live once deployment completes

**Alternative: Uploading multiple files**

- If you need to upload new files or update multiple files:
  - Go to your GitHub repository
  - Click **Add file** → **Upload files**
  - Drag and drop files or click **choose your files**
  - Click **Commit changes** when done

  **NOTE** On the current free plan with Cloudflare, the website can be rebuilt 500 times. If you are planning on editing multiple website files multiple times a week. It may be more prudent to do a multifile upload all at once. This does not apply to changes made in the NRCGA MS365 account or Luma.com calendar platform as those are separate platforms that site is pulling from.

#### Troubleshooting

**Repository Cloning Errors:**

- **"Failed: error occurred while fetching repository"**:
  - Go back to the setup and verify you selected the correct repository
  - Make sure the repository is **Public** (or that Cloudflare has access if it's Private)
  - Try disconnecting and reconnecting GitHub: In Cloudflare Pages, go to your account settings and disconnect/reconnect GitHub
  - Verify the repository exists and has files in it (check on GitHub)
  - Make sure you authorized Cloudflare to access your GitHub account during setup

**Other Common Issues:**

- **Build fails**: Check that the Path is set to `/` (root directory)
- **Files not found**: Ensure file paths are relative (not absolute) and Path is set correctly
- **Embedded calendars or forms not loading**: Confirm iframe `src` URLs are still correct; check that the third-party service (Luma, Microsoft 365/Forms, etc.) allows embedding and is not blocking your domain
- **Custom domain not working**: Check DNS settings in Cloudflare
- **Deploy command errors**: If you used a placeholder command and get errors, try leaving it completely empty or contact support

### Cloudflare Pages — direct upload with Wrangler


```

Replace `YOUR_PROJECT_NAME` with your Pages project name (create the project in the [Cloudflare dashboard](https://dash.cloudflare.com) under **Workers & Pages** if needed). Each run uploads the current directory as a new production deployment unless you configure previews or CI separately.

### Alternative Deployment Methods

#### GitHub Static File Upload

- It is unlikely Github will fail, but should it fail and you still have access to Cloudflare, create a zip file of all of the website files and choose **Drag and drop your files** instead of **Import an existing Git repository**.




See `MANAGEMENT.md` for more details on deployment workflows.

## Site behavior

- **Navigation and dropdowns**, **theme toggle** (dark/light), **mobile menu**, **smooth scrolling**, **form styling**, and **CSS animations** work as static UI
- **Carousel** on the home page is driven from `data/front-page-carousel.csv` via `js/carousel-loader.js`
- **Relative links**: Internal links are relative and work when served from any path on a static host
- **External links**: External links (e.g. usanorth811.org) open as normal
- **No compile step**: Deploy the files you see in the repo; no `npm run build` required

## Notes

- **No API server in-repo**: There is no NRCGA REST API or `generate-static-site.js` pipeline here; content is HTML, JS, and CSV, plus third-party embeds
- **Third-party embeds**: Calendars and forms load inside iframes from Luma, Microsoft, YouTube, etc.; keep those URLs updated when services or form IDs change
- **CSV over HTTP**: When developing locally, deploy a simple HTTP server so `fetch()` can load files under `data/`
