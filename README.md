# First Look Jobs

First Look monitors public company career feeds for 2027 new-grad and early-career jobs. The GitHub Pages dashboard shows current matches, salary and skill details when available, application links, and an application tracker. GitHub Actions runs the scanner every ten minutes, sends immediate Twilio texts, and sends a daily Resend email digest without requiring a terminal or an awake computer.

## How preferences work

The three CSV columns are independent lists:

- **Companies** contains every company to monitor.
- **Roles** contains acceptable position keywords. Every role applies to every company.
- **Locations** contains acceptable locations. Every location applies to every company and role.

Rows have no relationship to one another. A job matches when its company is in the Companies list, its title matches at least one Roles value, and its location matches at least one Locations value. Blank Roles or Locations lists mean “any.” Common aliases such as SWE/software engineer and firmware/embedded software are normalized.

Only titles explicitly signaling new grad, 2027, graduate, entry level, early career, university, campus, associate, or Engineer I are accepted. Internship, senior, staff, principal, lead, manager, director, and head roles are excluded.

## How the hosted website works

1. GitHub Pages publishes the files in `public/` at `https://YOUR-USERNAME.github.io/REPOSITORY/`.
2. `.github/workflows/scan.yml` runs every ten minutes on GitHub's servers.
3. The workflow securely retrieves queued website target changes from Supabase and applies them to `data/preferences.csv`.
4. It rebuilds `public/preferences.json`, scans configured Greenhouse and Lever feeds, and compares listings against the three independent preference lists.
5. New matches are added to `public/jobs.json`; immediate texts are sent through Twilio.
6. At 6:00 PM America/New_York, matches discovered that day are emailed through Resend.
7. The workflow commits the updated CSV and job data to `main`. That commit triggers the Pages deployment workflow, updating the website.

Application statuses are stored in the current browser because GitHub Pages is static. They survive closing the page but do not currently sync between browsers or devices. Target additions and removals do sync after the user signs in through Supabase.

GitHub Actions schedules are not guaranteed to start at the exact scheduled second and may occasionally be delayed. The scanner does not require your computer to be running.

## Initial GitHub Pages setup

Merge `dev` into `main` and push it. Then:

1. Open the repository's **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Settings → Actions → General → Workflow permissions**.
4. Select **Read and write permissions** and save so the scanner can commit updated CSV and job data.
5. Open **Actions → Scan for jobs** and use **Run workflow** after completing the secrets below.

`pages.yml` deploys only from `main`. Scheduled workflows also use the version on the repository's default branch, so the setup is not active until it is merged.

## Website target sync setup

Supabase provides authenticated writes without exposing a repository token in the public website.

1. Create a Supabase project.
2. Open its SQL editor.
3. Open `supabase/schema.sql`, replace `YOUR_EMAIL@example.com` with the only email that should be allowed to change targets, and run the SQL.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the GitHub Pages URL and add the same URL under Redirect URLs.
5. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add:

   ```text
   SUPABASE_URL
   SUPABASE_ANON_KEY
   ```

   The URL and anonymous key are designed to be used by the browser. Row-level security restricts writes to the email configured in the SQL policy.

6. Under **Actions → Secrets**, add:

   ```text
   SUPABASE_SERVICE_ROLE_KEY
   ```

   This secret is available only to the scheduled workflow. Never put the service-role key in frontend code or a repository variable.

7. Deploy Pages, open the website, enter the authorized email under **Alerts**, and click **Email me a sign-in link**.
8. Open the link in that email. The Alerts page will show that cloud sync is connected.

When a signed-in user adds or removes a target, the website records an authenticated change in Supabase immediately. The next scheduled scan applies it to `data/preferences.csv`, clears the processed queue entry, commits the CSV, and scans using the new values. No manual CSV editing is required.

## SMS setup

Create a Twilio account and add these GitHub Actions secrets:

```text
ALERT_PHONE
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

Phone numbers should use international format, such as `+15555555555`.

## Daily email setup

Create a Resend account, verify a sending domain or address, and add:

```text
ALERT_EMAIL
RESEND_API_KEY
EMAIL_FROM
```

`EMAIL_FROM` must be accepted by the configured Resend account, for example `First Look <alerts@yourdomain.com>`.

## Adding career feeds

The scanner supports Greenhouse and Lever. Add sources to `data/sources.json`:

```json
{ "company": "Company name exactly as listed", "type": "greenhouse", "token": "board-token" }
```

```json
{ "company": "Company name exactly as listed", "type": "lever", "token": "site-token" }
```

The token is the final segment of the company's public board URL. Companies using proprietary career systems require dedicated adapters.

## Local development

Node.js 20 or newer is required. No package installation is needed.

```bash
cp .env.example .env
npm run dev
```

Open `http://localhost:4173`. Local mode uses `data/state.json`; cloud target sync is enabled only in the static GitHub Pages build.

Useful checks:

```bash
npm run build
npm test
npm run scan:github
```

Never commit `.env`, Supabase service-role keys, Twilio credentials, or Resend credentials.
