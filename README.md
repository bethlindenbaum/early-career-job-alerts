# First Look Jobs

First Look is a self-hosted early-career job monitor. It imports the supplied company, role, and location preferences; checks supported public career feeds for matching 2027/new-grad roles; sends an immediate SMS for each new match; creates a daily email recap; and tracks whether a job is under review, saved, applied to, or dismissed.

## Run locally

Requires Node.js 20 or newer and no package installation.

```bash
cp .env.example .env
node --env-file=.env server.js
```

Then open `http://localhost:4173`. On first launch, the app confirms the imported preferences and offers to scan currently live roles before beginning continuous monitoring.

## Connect notifications

Fill in `.env` with a Twilio account SID, auth token, and sending number for immediate SMS alerts. Add a Resend API key and verified `EMAIL_FROM` address for the 6:00 PM local-time digest. Without these values, the dashboard and scanner remain fully usable and clearly show that delivery credentials are needed.

## Add job sources

The scanner supports public Greenhouse and Lever feeds. Add a row to `data/sources.json`:

```json
{ "company": "Company name exactly as in preferences", "type": "greenhouse", "token": "board-token" }
```

or:

```json
{ "company": "Company name exactly as in preferences", "type": "lever", "token": "site-token" }
```

The token is the final segment of the company's Greenhouse board or Lever jobs URL. The starter configuration includes several target companies. Companies using proprietary career sites need a dedicated adapter; keeping these explicit avoids brittle scraping and respects sites that prohibit automated access.

## Matching behavior

- Only titles/descriptions signaling 2027, new grad, graduate, entry-level, early-career, university, campus, associate, or Engineer I are considered.
- Senior, staff, principal, lead, manager, and director titles are excluded.
- Blank spreadsheet role or location values act as “any.”
- Common role aliases such as SWE/software engineer and firmware/embedded software are normalized.
- Duplicate jobs are stored only once.

State is stored locally in `data/state.json` and excluded from git. Run `npm test` to verify the matching rules.

## GitHub Pages + automatic scanner

The repository includes two GitHub Actions workflows:

- `pages.yml` publishes `public/` to GitHub Pages whenever `main` changes.
- `scan.yml` runs on GitHub's infrastructure every ten minutes, checks configured job feeds, sends alerts, and commits updated matches to `public/jobs.json`.

After merging the `dev` branch into `main` and pushing it:

1. Open the repository on GitHub and go to **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Go to **Settings → Actions → General → Workflow permissions**, select **Read and write permissions**, and save. This lets the scanner commit new matches.
4. Go to **Settings → Secrets and variables → Actions** and add the notification secrets below.
5. Open **Actions → Scan for jobs → Run workflow** once to verify the scanner. The scheduled runs use the workflow on the default branch (`main`).

Required secrets for texts:

```text
ALERT_PHONE
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

Required secrets for the daily email:

```text
ALERT_EMAIL
RESEND_API_KEY
EMAIL_FROM
```

`EMAIL_FROM` must be a sender accepted by the configured Resend account. Never put these values in frontend code or commit a `.env` file.

The scanner does not require a terminal or an awake computer after the branch is merged and workflows are enabled. GitHub schedules are not a continuously running server: scans are requested every ten minutes and GitHub may occasionally delay a scheduled run. The five-minute schedule is GitHub's shortest supported interval, but ten minutes is used here to reduce Actions usage.

On GitHub Pages, application statuses and site-added preferences are saved in that browser's local storage. They survive closing the page but do not sync between devices. The scheduled scanner reads `data/preferences.csv`, so add permanent scanner targets there and push the change. Supporting synchronized edits directly from the site requires an authenticated cloud database; a static Pages site cannot safely write to the repository or expose a write credential.

For local development, the original Node server remains available with `npm run dev`.
