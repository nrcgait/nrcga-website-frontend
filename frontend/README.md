# NRCGA Website Frontend

This is the frontend for the NRCGA website. It's a static site that fetches events and handles registrations through the backend API. Most content is managed through simple configuration files.

## What's Included

- **All HTML pages** - 27 pages with navigation and footer embedded
- **CSS styles** - All styling from `css/styles.css`
- **JavaScript** - Static versions of UI functionality (navigation, theme toggle, etc.)
- **Assets** - All images, PDFs, and other media files
- **Data** - Static data files (calendar.js, etc.)

## Dynamic Content

The site includes both static and dynamic content:

- **Events/Calendar** - Fetched from backend API at runtime (see `data/api-config.js`)
- **Event Registrations** - Handled through backend API
- **Carousel Images** - Configured in `data/front-page.js`
- **Programs** - Configured in `data/programs.js`
- **Breaking News** - Configured in `data/front-page.js`
- **Members** - Configured in `data/members.js`
- **Archive Links** - Configured in `data/archive.js`

## How to Use

1. **Local Development**: Simply open `index.html` in your browser, or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (http-server)
   npx http-server -p 8000
   
   # Using PHP
   php -S localhost:8000
   ```

2. **Deployment**: See [Deployment Instructions](#deployment) below for detailed setup.

   The site can be deployed to:
   - Cloudflare Pages (recommended - see instructions below)
   - GitHub Pages
   - Netlify
   - Vercel
   - AWS S3 + CloudFront
   - Any static web server

## Deployment

### Deploying to Cloudflare Pages via GitHub

Cloudflare Pages provides free hosting with automatic deployments from GitHub. Follow these steps:

#### Prerequisites

1. **GitHub Account**: You'll need a GitHub account (if you're seeing this you likely are already logged into it.)
2. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com) See google drive doc for this.
3. **Repository**: Push frontend code to a GitHub repository

#### Step-by-Step Instructions

1. **Upload code to GitHub** (using GitHub web interface):
   - Go to [GitHub.com](https://github.com) and sign in
   - Click the **+** icon in the top right, then select **New repository**
   - Name your repository (e.g., `nrcga-website`)
   - Choose **Public** or **Private** (your choice)
   - **Do NOT** initialize with README, .gitignore, or license (we're uploading existing files)
   - Click **Create repository**
   - On the next page, you'll see "uploading an existing file" - click **uploading an existing file**
   - Drag and drop your entire `frontend` folder contents into the upload area
   - Or click **choose your files** and select all files from the frontend folder
   - Scroll down and click **Commit changes**
   - Your code is now on GitHub!

2. **Connect to Cloudflare Pages** (using Cloudflare Dashboard):
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) and log in
   - In the left sidebar, click **Pages** (under "Workers & Pages")
   - Click the **Create a project** button
   - Click **Connect to Git** button
   - You'll see a list of Git providers - click **GitHub**
   - Authorize Cloudflare to access your GitHub account (click **Authorize Cloudflare**)
   - Select the repository you just created from the list
   - Click **Begin setup**

3. **Configure Build Settings** (in Cloudflare setup form):
   - **Project name**: Enter a name (e.g., `nrcga-website`) - this will be part of your URL
   - **Build command**: Leave this field **completely empty** (this is a static site, no build needed)
   - **Deploy command**: If the field is required and won't let you leave it empty, you can enter `echo "Static site - no deploy needed"` (this is just a placeholder that does nothing)
   - **Non-production branch deploy command**: Leave this **empty** (or use the same placeholder if required)
   - **Path**: Enter `/` (just a forward slash - this means use the root directory)
   - **API token**: Leave this section **empty** - not needed for static site deployment
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
   - Enter your domain name (e.g., `nrcga.org`)
   - Follow the on-screen instructions to configure DNS
   - Cloudflare will provide DNS records to add (usually done automatically if your domain is already on Cloudflare)

#### Automatic Deployments

- **Automatic**: Every push to the `main` branch triggers a new deployment
- **Preview deployments**: Pull requests get preview URLs automatically
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
- **API not working**: Verify `data/api-config.js` has the correct backend URL
- **Custom domain not working**: Check DNS settings in Cloudflare
- **Deploy command errors**: If you used a placeholder command and get errors, try leaving it completely empty or contact support

### Alternative Deployment Methods

#### GitHub Pages

1. Push code to GitHub repository
2. Go to repository **Settings** → **Pages**
3. Select source branch (usually `main`)
4. Select root directory (or `/frontend` if in subdirectory)
5. Save - site will be available at `username.github.io/repo-name`

#### Manual Upload to Cloud Storage

If using Cloudflare R2 or GCP Cloud Storage:
1. Upload the entire `frontend` folder to your bucket
2. Configure bucket for static website hosting
3. Set up CDN if needed
4. Update DNS to point to your storage bucket

See `MANAGEMENT.md` for more details on deployment workflows.

## Regenerating the Static Site

To regenerate the static site with fresh data from the API:

```bash
node generate-static-site.js
```

Make sure the API is running at `http://localhost:8787/api` (or set `API_URL` environment variable).

## What Was Removed

- API configuration scripts
- Calendar enhanced JavaScript (events are embedded)
- Carousel loader JavaScript (carousel is embedded)
- Programs loader JavaScript (programs are embedded)
- Breaking news loader JavaScript (breaking news is embedded if available)

## What Still Works

- Navigation and dropdowns
- Theme toggle (dark/light mode)
- Mobile menu
- Smooth scrolling
- Form styling
- All CSS animations and effects
- Carousel navigation (if carousel images exist)

## Notes

- **Dynamic Content**: The site fetches events from the backend API (configured in `data/api-config.js`)
- **Static Assets**: HTML, CSS, JavaScript, and data files are static and served directly
- **Content Updates**: Most content can be updated by editing data files (see `MANAGEMENT.md` for details)
- **Events**: Events are fetched from the backend API at runtime, so they stay current automatically
- **Relative Links**: All internal links are relative and work when served from any web server
- **External Links**: External links (like usanorth811.org) will still work
- **No Build Required**: This is a static site - no build process needed for deployment

