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

## Production notes

For always-on alerts, deploy this Node process to an always-on host, add persistent storage for `data/state.json`, set the environment variables, and keep `SCAN_INTERVAL_MINUTES` at the desired cadence. A database-backed store and authenticated user accounts are the natural next step for a multi-user deployment.
