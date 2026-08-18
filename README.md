# First Look Jobs

First Look finds 2027 new-grad and early-career jobs, displays them on a GitHub Pages website, sends immediate SMS alerts through Twilio, and sends a daily email digest through Resend. GitHub Actions runs the scanner every ten minutes, so your terminal and computer do not need to remain on.

## Complete hosted setup — follow in this order

The order matters because you need to publish the site once to learn its final GitHub Pages URL before configuring Supabase authentication.

### 1. Push the development branch

Confirm that you are on `dev`, then push it:

```bash
git branch --show-current
git push -u origin dev
```

On GitHub, open the repository and create a pull request from `dev` into `main`. Merge the pull request. The Pages and scanner workflows only become active after they are on the repository's default branch, normally `main`.

### 2. Configure GitHub Actions permissions

In the GitHub repository:

1. Open **Settings**.
2. In the left sidebar, select **Actions → General**.
3. Under **Actions permissions**, select **Allow all actions and reusable workflows**. If your account already allows the actions used by this repository, that existing setting can remain.
4. Scroll to **Workflow permissions**.
5. Select **Read and write permissions**.
6. Leave **Allow GitHub Actions to create and approve pull requests** unchecked; this project does not need it.
7. Click **Save**.

Write permission is necessary because the scanner commits synchronized CSV changes and new job matches back to `main`.

### 3. Enable GitHub Pages and create the website URL

In the same repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Do not select a branch or `/docs` folder. Those options belong to branch-based publishing and are not used by this project.
4. Leave **Custom domain** blank unless you already own and want to configure a separate domain.
5. Keep **Enforce HTTPS** enabled if the option is shown. GitHub's `github.io` address uses HTTPS automatically.

Now publish the first copy:

1. Open the repository's **Actions** tab.
2. Select **Deploy GitHub Pages** in the left sidebar.
3. Click **Run workflow**.
4. Choose the `main` branch and confirm **Run workflow**.
5. Wait for the workflow to finish with a green check.
6. Return to **Settings → Pages**. GitHub will display **Your site is live at** followed by the URL.

For a normal project repository, the URL is:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

For example, if the username is `beth` and the repository is `early-career-job-alerts`, the URL is:

```text
https://beth.github.io/early-career-job-alerts/
```

Copy the exact URL, including the repository path and trailing `/`. You will use it in Supabase.

GitHub Pages sites are publicly accessible. Do not place API secrets, private phone numbers, or `.env` files in `public/` or commit them to the repository.

### 4. Create the Supabase project

Supabase lets the public Pages website accept authenticated target changes without exposing a GitHub write token.

1. Sign in at [Supabase](https://supabase.com/dashboard).
2. Click **New project**.
3. Select or create an organization.
4. Enter a project name such as `first-look-jobs`.
5. Generate and safely store the database password. This application does not put that password in GitHub.
6. Choose the region closest to you.
7. Select the free or paid plan you want and click **Create new project**.
8. Wait until the project reports that it is ready.

You do not need to change database networking, connection-pooler, storage, realtime, or Edge Function settings.

### 5. Create the Supabase table and security policy

Before running the SQL, open [supabase/schema.sql](supabase/schema.sql) locally and replace:

```text
YOUR_EMAIL@example.com
```

with the exact email address that will be allowed to change job targets. Do not remove the surrounding single quotes.

Then, in Supabase:

1. Open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Paste the complete contents of `supabase/schema.sql`.
4. Click **Run**.
5. Open **Table Editor** and confirm that `target_changes` appears under the `public` schema.

The SQL enables Row Level Security. Do not disable RLS. The policy permits only an authenticated user whose email matches the address placed in the SQL file.

### 6. Configure Supabase email authentication

In the Supabase project:

1. Open **Authentication → Sign In / Providers**.
2. Select **Email**.
3. Make sure the **Email** provider is enabled.
4. Keep passwordless email/OTP sign-in available. The website uses an emailed magic link, not a password.
5. Save if you changed anything.

For a personal single-user site, the Row Level Security policy is what restricts target changes to your email. Other authenticated emails cannot insert changes even if someone discovers the public website.

### 7. Configure Supabase URLs

In Supabase:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to the exact GitHub Pages URL copied in step 3.
3. Under **Redirect URLs**, click **Add URL** and add that same exact Pages URL.
4. Save the settings.

The URL must use your exact GitHub username and repository name and should end in `/`. For this repository it should be:

```text
https://bethlindenbaum.github.io/early-career-job-alerts/
```

If an emailed sign-in link opens a GitHub Pages 404, recheck both fields for an old username, the GitHub repository URL instead of the `github.io` URL, or a missing repository path.

Example:

```text
Site URL:      https://bethlindenbaum.github.io/early-career-job-alerts/
Redirect URL:  https://bethlindenbaum.github.io/early-career-job-alerts/
```

Do not use the repository URL such as `https://github.com/...`; use the published `github.io` website URL. Supabase requires the magic-link destination to match an allowed redirect URL. [Supabase redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls)

Optional local testing can be allowed by adding this additional Redirect URL:

```text
http://localhost:4173/
```

The production **Site URL** should still remain the GitHub Pages URL.

### 8. Copy the Supabase URL and API keys

In Supabase, open the project's **Connect** dialog or **Project Settings → API Keys**.

Collect these three values:

1. **Project URL**, similar to `https://abcdefgh.supabase.co`.
2. **Publishable key**, beginning with `sb_publishable_`. This is the low-privilege browser key.
3. **Secret key**, beginning with `sb_secret_`. This is the privileged server key.

If the project only shows legacy keys, the legacy `anon` key can replace the publishable key and the legacy `service_role` key can replace the secret key. New Supabase projects should use publishable and secret keys. Publishable keys are safe to expose to a browser when RLS is enabled; secret keys bypass RLS and must never be exposed publicly. [Supabase API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys)

### 9. Add Supabase values to GitHub

Open the GitHub repository's **Settings → Secrets and variables → Actions**.

First select the **Variables** tab and create these repository variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | The Supabase Project URL, such as `https://abcdefgh.supabase.co` (do not include `/rest/v1`) |
| `SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_...` key |

Then select the **Secrets** tab and create this repository secret:

| Secret | Value |
|---|---|
| `SUPABASE_SECRET_KEY` | The `sb_secret_...` key |

Use **New repository variable** and **New repository secret**, not environment-level entries. The variable names must match exactly, including capitalization.

The publishable key is intentionally available to the Pages build. The secret key is available only to GitHub Actions and must never be placed in `public/config.json`, source code, a GitHub variable, or `.env` committed to git.

### 10. Redeploy Pages with cloud sync enabled

The first deployment occurred before the Supabase variables existed, so deploy again:

1. Open **Actions → Deploy GitHub Pages**.
2. Click **Run workflow**.
3. Select `main` and run it.
4. Wait for a green check.
5. Open the Pages URL and perform a hard refresh.

Open **Alerts** on the website. **Cloud target sync** should now say **Not signed in**, rather than **Setup required**.

### 11. Configure SMS alerts with Twilio

Create or use a Twilio account and obtain a sending number. In GitHub, open **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Value |
|---|---|
| `ALERT_PHONE` | Your receiving number, such as `+15555555555` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | Twilio sending number in international format |

Twilio trial accounts may require the receiving number to be verified in Twilio. Do not put these values in GitHub variables; use secrets.

This step is optional if you do not want SMS alerts. The scanner and website still work without it.

### 12. Configure the daily email with Resend

Create or use a Resend account, then verify a sending domain or use an allowed test sender. In GitHub Actions **Secrets**, add:

| Secret | Value |
|---|---|
| `ALERT_EMAIL` | The email address that receives the digest |
| `RESEND_API_KEY` | The Resend API key |
| `EMAIL_FROM` | An approved sender, such as `First Look <alerts@yourdomain.com>` |

This step is optional if you do not want email digests. The daily digest is scheduled for 6:00 PM `America/New_York`.

### 13. Run and verify the first hosted scan

1. Open the GitHub repository's **Actions** tab.
2. Select **Scan for jobs**.
3. Click **Run workflow**.
4. Choose `main` and run it.
5. Open the running job and inspect its steps.

A successful run should show:

- **Sync website targets** or the equivalent `npm run sync:targets` step succeeding.
- The scan completing without a fatal error.
- **Publish new matches** either committing changes or reporting that there were no changes.
- **Clear synchronized website changes** succeeding.

After the run completes, GitHub may automatically start **Deploy GitHub Pages** if the scanner committed new data. Wait for that deployment, then refresh the website.

The scheduled scanner now runs every ten minutes without your terminal or computer. GitHub can occasionally delay scheduled jobs, so “every ten minutes” is the requested schedule rather than a guarantee that every run starts at the exact second.

The separate **Discover company job feeds** workflow runs every Monday and can also be run manually. It probes Greenhouse, Lever, Ashby, and SmartRecruiters public APIs for companies that do not yet have a direct source. It also learns Greenhouse, Lever, Ashby, SmartRecruiters, and Workday configurations from official links in the fallback feeds. Every candidate is validated by loading actual listings before it is committed.

Discovery is intentionally recurring: a company that cannot be monitored directly today may move to a supported recruiting platform or publish a recognizable official listing later. Sites with CAPTCHAs, login requirements, private APIs, or custom JavaScript search systems remain marked as fallback coverage until a reliable connector is available.

After a hosted scan, **Preferences → Official source health** shows whether each configured source succeeded, its recruiting platform, and how many listings it returned. A failing company source does not stop other companies from being scanned or prevent alerts from being sent.

### 14. Sign in and test website-to-CSV synchronization

1. Open the GitHub Pages website.
2. Open **Alerts**.
3. Enter the same email address used in `supabase/schema.sql`.
4. Click **Save alert settings**.
5. Click **Email me a sign-in link**.
6. Open the email and click its link.
7. Confirm that the website returns to the Pages URL and **Cloud target sync** says **Signed in as ...**.
8. Open **Preferences → Add target**.
9. Add a test company, position, or location.
10. Wait for the next scheduled scan, or manually run **Actions → Scan for jobs**.
11. In GitHub, open `data/preferences.csv` on `main` and confirm the target was added to the appropriate independent column.

Removing a target from the signed-in website works the same way: the next scanner run removes it from the CSV and commits the updated file.

## How the current website works

### Independent preference lists

The CSV columns are not row relationships:

- **Companies** is the complete company watchlist.
- **Roles** is the complete acceptable-position list. Every role applies to every company.
- **Locations** is the complete acceptable-location list. Every location applies to every company and role.

A job matches when:

1. Its company is in Companies.
2. Its title matches at least one Roles entry.
3. Its location matches at least one Locations entry.
4. Its title signals new grad, 2027, graduate, entry level, early career, university, campus, associate, or Engineer I.

Internship, senior, staff, principal, lead, manager, director, and head roles are excluded. Common aliases such as SWE/software engineer and firmware/embedded software are normalized. An empty Roles or Locations list means “any.”

### Scanner and publication flow

```text
Signed-in website change
        ↓
Supabase target_changes queue
        ↓
GitHub scanner runs every 10 minutes
        ↓
data/preferences.csv is updated automatically
        ↓
Greenhouse and Lever feeds are checked
        ↓
New matches are written to public/jobs.json
        ↓
SMS is sent immediately; daily matches are emailed at 6 PM
        ↓
GitHub Pages redeploys the updated dashboard
```

The website itself is static. Supabase handles authenticated preference changes, while GitHub Actions performs privileged scanning, notification, CSV-writing, and deployment work.

### Dashboard and application tracking

- **Matches** displays company, title, salary when available, extracted skills, city/location, and an application link.
- **Tracker** groups jobs marked Review, Saved, or Applied.
- **Preferences** displays the three independent target lists and lets a signed-in user add or remove entries.
- **Alerts** stores the displayed contact settings in the current browser and provides Supabase sign-in.

Application statuses are stored in the current browser's local storage. They survive closing the tab but do not currently synchronize across browsers or devices. SMS and email destinations come from protected GitHub secrets, not from the values typed into the public website.

## Job-source coverage

The scanner uses two coverage layers:

1. **Verified direct feeds** for 22 target companies using Greenhouse, Lever, Ashby, or SmartRecruiters. These provide the richest descriptions, skill extraction, and compensation when the employer publishes it.
2. Three curated fallback sources: **ApplyGuy 2027 New Grad Jobs**, **Vansh New Grad 2027**, and the **Hardware & Systems Engineering** section of **Zapply New Grad Jobs 2027**. Every listing is filtered against all target-company names, the independent role list, the location list, and the early-career exclusions. Application buttons use the original employer listing URL.

`public/source-coverage.json` records which companies have direct feeds and which rely on the all-company fallback. A monitored company will not appear in Matches unless it currently has a published job that passes every preference rule. “No current match” is different from “not monitored.”

The fallbacks are curated externally and can find jobs on Workday and proprietary career systems that this project cannot query directly. They are broader than the direct adapters, but may have less detail or a short delay compared with an employer's own feed. The project therefore checks direct feeds first and suppresses duplicate company/title/location combinations across all sources.

When a fallback source is added for the first time, its existing listings are imported to the website without sending a bulk SMS or email flood. Jobs discovered from that source on later scans use the normal immediate-SMS and daily-digest behavior.

### Add or update a direct feed

For Greenhouse or Lever, add an entry to `data/sources.json`:

```json
{ "company": "Company name exactly as listed", "type": "greenhouse", "token": "board-token" }
```

or:

```json
{ "company": "Company name exactly as listed", "type": "lever", "token": "site-token" }
```

Ashby is also supported:

```json
{ "company": "Company name exactly as listed", "type": "ashby", "token": "job-board-name" }
```

SmartRecruiters is supported with:

```json
{ "company": "Company name exactly as listed", "type": "smartrecruiters", "token": "company-identifier" }
```

The token is normally the employer identifier in its public job-board URL. Validate a board before adding it because short identifiers can belong to an unrelated organization or test board. Companies using unsupported proprietary systems continue to receive fallback coverage when they appear in the curated 2027 feed.

## Local development

Node.js 20 or newer is required. No package installation is needed.

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:4173`. Local mode uses `data/state.json`. The hosted Supabase change queue is used by the GitHub Pages build.

Useful checks:

```bash
npm run build
npm test
npm run scan:github
```

Never commit `.env`, database passwords, Supabase secret keys, Twilio credentials, or Resend credentials.
