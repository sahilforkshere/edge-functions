# Job Aggregator — Supabase Edge Functions

A collection of Deno-based Supabase Edge Functions that scrape job listings from multiple sources, normalize the data, and insert it into a PostgreSQL `job_alerts` table. A PostgreSQL matching function then finds users whose saved preferences match each incoming job.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Edge Functions](#edge-functions)
  - [ashby-jobs.ts](#ashby-jobsts)
  - [green-house.ts](#green-housets)
  - [hackernews.ts](#hackernewsts)
  - [jobicy.ts](#jobicyts)
  - [remoteok.ts](#remoteokts)
  - [the-muse.ts](#the-musets)
  - [yc-jobs.ts](#yc-jobsts)
- [Shared Location Helper (V7)](#shared-location-helper-v7)
- [Database Schema](#database-schema)
  - [job\_alerts Table](#job_alerts-table)
  - [jobs\_preferences Table](#jobs_preferences-table)
- [Database Queries](#database-queries)
  - [Matching Function](#matching-function)
  - [GIN Indexes](#gin-indexes)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Data Flow](#data-flow)

---

## Architecture Overview

```text
External Job APIs
      │
      ▼
┌─────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno)          │
│                                                       │
│  ashby-jobs  │  greenhouse  │  hackernews  │  ...    │
│                                                       │
│         processLocation() — V7 Helper                │
│   (VALID_COUNTRIES + COUNTRY_ALIASES + TECH_HUBS)    │
└────────────────────────┬────────────────────────────┘
                         │ INSERT
                         ▼
              ┌──────────────────┐
              │   job_alerts     │  ← PostgreSQL (Supabase)
              └────────┬─────────┘
                       │ TRIGGER / CALL
                       ▼
         ┌─────────────────────────────┐
         │  find_matching_users()      │
         │  (PL/pgSQL matching func)   │
         └─────────────┬───────────────┘
                       │ RETURNS
                       ▼
              matched user emails
```

---

## Edge Functions

### ashby-jobs.ts

Fetches jobs from the **Ashby HQ** public job board API for a curated list of companies.

| Detail | Value |
| --- | --- |
| API | `https://api.ashbyhq.com/posting-api/job-board/{token}` |
| Companies | OpenAI, Anthropic, Notion, Linear, Ashby, Perplexity AI, Cohere, Vercel, Supabase, Replit, Retool, Ramp, Deel, 1Password, and more (22 total) |
| Jobs per company | Up to 5 |
| Location parsing | Multi-location aware — reads `address.postalAddress` + `secondaryLocations` |
| Work mode mapping | `workplaceType` → REMOTE / HYBRID / ONSITE |

**Response:**

```json
{
  "success": true,
  "boards_scanned": 22,
  "jobs_inserted": 87
}
```

---

### green-house.ts

Fetches jobs from the **Greenhouse** public job board API for a curated list of companies.

| Detail | Value |
| --- | --- |
| API | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` |
| Companies | Twitch, Discord, Figma, Stripe, Airbnb, Reddit, Coinbase, Databricks, OpenAI, Cloudflare, Hugging Face, Scale AI, GitLab, Unity, and more (25 total) |
| Jobs per company | Up to 5 |
| Location parsing | Passes raw `location.name` string directly to V7 helper |
| HTML content | Unescapes HTML entities before stripping tags |

**Response:**

```json
{
  "success": true,
  "boards_scanned": 25,
  "jobs_inserted": 112
}
```

---

### hackernews.ts

Fetches recent job posts from the **HackerNews Algolia API**.

| Detail | Value |
| --- | --- |
| API | `https://hn.algolia.com/api/v1/search_by_date?tags=job&hitsPerPage=20` |
| Jobs fetched | Up to 20 |
| Title parsing | Splits on `is hiring`, `\|`, ` - `, `:` to extract company + role |
| Company cleanup | Strips YC batch tags e.g. `(YC W24)` |
| Location | Defaults to San Francisco (US); pattern-matched from title for NYC, London, Berlin, Toronto, Paris, Amsterdam, Sydney, Austin, Boston, Seattle |
| Industry | Hardcoded `Enterprise Software` (HN skews heavily tech) |

**Response:**

```json
{
  "success": true,
  "jobs_inserted": 20
}
```

---

### jobicy.ts

Fetches exclusively **remote jobs** from the Jobicy public API.

| Detail | Value |
| --- | --- |
| API | `https://jobicy.com/api/v2/remote-jobs?count=50` |
| Jobs fetched | Up to 50 |
| Work mode | Always `REMOTE` |
| Industry mapping | Mapped from `jobIndustry` field → normalized categories (Crypto & Web3, E-commerce, Business Intelligence, EdTech, CRM & Sales Tech, Cybersecurity, etc.) |
| Experience mapping | Mapped from `jobLevel` field |

**Response:**

```json
{
  "success": true,
  "jobs_inserted": 50
}
```

---

### remoteok.ts

Fetches **remote jobs** from RemoteOK. Uses an `allorigins.win` proxy to bypass CORS restrictions.

| Detail | Value |
| --- | --- |
| API | `https://remoteok.com/api` (via `https://api.allorigins.win/raw?url=...`) |
| Jobs fetched | Up to 20 valid jobs (filters out entries without `company` and `position`) |
| Work mode | Always `REMOTE` |
| Industry | First tag from the job's `tags` array (e.g., `react`, `python`) |
| Keywords | Built from title + company name + all tags |
| User-Agent | Spoofed Chrome UA to avoid blocks |

**Response:**

```json
{
  "success": true,
  "jobs_inserted": 20
}
```

---

### the-muse.ts

Fetches jobs from **The Muse** public API with pagination.

| Detail | Value |
| --- | --- |
| API | `https://www.themuse.com/api/public/jobs?page={n}&descending=true` |
| Pages fetched | 2 pages |
| Work mode | Detected from title, location string, or first 500 chars of description (`remote` → REMOTE, `hybrid` → HYBRID) |
| Experience mapping | Mapped from `levels[0].short_name` (`senior`, `mid`, `management`) |
| Industry mapping | Mapped from `categories[0].name` (software/engineering, marketing, data/analytics, design, sales, education) |

**Response:**

```json
{
  "success": true,
  "jobs_inserted": 60
}
```

---

### yc-jobs.ts

Fetches active job listings from **Y Combinator startups** via the RapidAPI YC Jobs endpoint.

| Detail | Value |
| --- | --- |
| API | `https://free-y-combinator-jobs-api.p.rapidapi.com/active-jb-7d` |
| Auth | `RAPIDAPI_KEY` environment variable |
| Pagination | 2 pages × 10 jobs = up to 20 jobs |
| Location | `cities_derived[0]` + `countries_derived[0]` |
| Work mode | `remote_derived` boolean → REMOTE / ONSITE |
| Fallback description | Auto-generates if `description` is empty |

**Response:**

```json
{
  "success": true,
  "jobs_inserted": 20
}
```

---

## Shared Location Helper (V7)

All 7 edge functions share an identical `processLocation()` helper. It resolves a raw location string into a normalized `{ finalCity, finalCountry }` pair.

### Resolution Priority

```text
1. Direct country name match against VALID_COUNTRIES set (195 countries)
2. Country alias lookup — e.g. "US" → "United States", "UK" → "United Kingdom"
3. Tech hub override map — e.g. "san francisco" → "United States", "bangalore" → "India"
4. City library lookup — uses npm:country-state-city to resolve unknown city names
5. Fallback → returns 'NULL' for city and/or country
```

### Country Aliases

| Input | Resolved |
| --- | --- |
| US, USA, AMERICA | United States |
| UK, ENGLAND, GREAT BRITAIN | United Kingdom |
| UAE | United Arab Emirates |
| KOREA | South Korea |
| FR | France |
| DE | Germany |

### Tech Hub Overrides (sample)

| City | Country |
| --- | --- |
| san francisco, sf, bay area, silicon valley | United States |
| new york, nyc | United States |
| london, cambridge | United Kingdom |
| berlin | Germany |
| paris | France |
| toronto | Canada |
| sydney | Australia |
| bangalore, bengaluru | India |
| amsterdam | Netherlands |
| dublin | Ireland |

---

## Database Schema

### job\_alerts Table

Every edge function inserts rows with this shape:

| Column | Type | Description |
| --- | --- | --- |
| `job_title` | TEXT | Max 200 chars |
| `company_name` | TEXT | Max 100 chars |
| `job_description` | TEXT | HTML-stripped plain text |
| `source_urls` | TEXT[] | Array of application/listing URLs |
| `location_city` | TEXT | Normalized city name or `'NULL'` |
| `location_country` | TEXT | Normalized country name(s) or `'NULL'` |
| `work_mode` | TEXT | `REMOTE`, `HYBRID`, or `ONSITE` |
| `job_type` | TEXT | `FULLTIME`, `CONTRACT`, `INTERNSHIP`, or `PARTTIME` |
| `industry` | TEXT | Normalized sector string |
| `experience` | TEXT | `ENTRY`, `MIDLEVEL`, `SENIOR`, or `EXECUTIVE` |
| `event_date` | DATE | Publication date (ISO 8601) |
| `webhook_event_id` | TEXT | Reserved, always `null` |
| `keywords` | TEXT[] | Auto-extracted keyword array for GIN index matching |

### jobs\_preferences Table

Stores per-user job alert preferences. Matched against incoming jobs by `find_matching_users()`.

| Column | Type | Description |
| --- | --- | --- |
| `user_id` | UUID | Foreign key → `profiles.id` |
| `job_title_keywords` | TEXT[] | Keywords user wants in job title |
| `experience_levels` | TEXT[] | e.g. `['Entry level', 'Mid-career']` |
| `target_locations` | TEXT[] | e.g. `['London, United Kingdom', 'All Cities, United States', 'Remote']` |
| `target_sectors` | TEXT[] | e.g. `['Enterprise Software', 'Sector Agnostic']` |
| `work_mode` | TEXT[] | e.g. `['Remote', 'Hybrid']` |
| `job_types` | TEXT[] | e.g. `['Full time', 'Contract']` |

---

## Database Queries

### Matching Function

Located in [database-queries/](database-queries/). Three versions exist, tracking the evolution of the function:

| File | Description |
| --- | --- |
| [matching-fun.sql](database-queries/matching-fun.sql) | **Current (production).** Accepts an extra `input_keywords TEXT[]` parameter for semantic keyword overlap matching on title and sector. |
| [matching-fun-bef-keyword.sql](database-queries/matching-fun-bef-keyword.sql) | Pre-keywords version with enhanced location logic and word-overlap industry matching but without the `keywords` array param. |
| [matching-fun-bef-bef-key.sql](database-queries/matching-fun-bef-bef-key.sql) | Earlier baseline version. |

#### Signature (current)

```sql
find_matching_users(
  input_job_title        TEXT,
  input_industry         TEXT,
  input_experience       TEXT,
  input_location_city    TEXT,
  input_location_country TEXT,
  input_work_mode        TEXT,
  input_job_type         TEXT,
  input_keywords         TEXT[] DEFAULT NULL
) RETURNS TABLE (user_id UUID, email TEXT)
```

#### Matching Logic

The function applies **6 independent filters** — a user must pass all to be returned:

1. **Title** — At least one of the user's `job_title_keywords` must appear as a substring in `input_job_title`, OR match via word overlap against `input_keywords` (ignoring noise words like `engineer`, `developer`, `lead`).

2. **Experience** — `input_experience` is mapped to canonical values (`Entry level`, `Mid-career`, `Senior`, `Executive`) and checked against the user's `experience_levels` array.

3. **Location** — Handles four cases:
   - Global remote (no country) → matches users who accept Remote work mode
   - Remote with country restriction → matches Remote acceptors OR country-specific matches
   - Onsite with city + country → matches users with that exact location or country-level preference
   - Onsite with country only → country-level match

4. **Industry / Sector** — Substring match OR word-overlap between `input_industry` and `target_sectors`. `'Sector Agnostic'` acts as a wildcard.

5. **Work Mode** — `REMOTE` / `HYBRID` / `ONSITE` mapped to canonical UI strings and checked against `work_mode` preferences.

6. **Job Type** — `FULLTIME` / `CONTRACT` / `INTERNSHIP` / `PARTTIME` mapped and checked against `job_types` preferences.

Any preference array left NULL or empty by the user acts as a **wildcard** (matches all values).

---

### GIN Indexes

[database-queries/gin-idx.sql](database-queries/gin-idx.sql) creates GIN indexes on all array columns of `jobs_preferences` for fast `@>` (contains) operator queries:

```sql
CREATE INDEX idx_pref_titles      ON jobs_preferences USING GIN (job_title_keywords);
CREATE INDEX idx_pref_locations   ON jobs_preferences USING GIN (target_locations);
CREATE INDEX idx_pref_sectors     ON jobs_preferences USING GIN (target_sectors);
CREATE INDEX idx_pref_experience  ON jobs_preferences USING GIN (experience_levels);
CREATE INDEX idx_pref_work_mode   ON jobs_preferences USING GIN (work_mode);
CREATE INDEX idx_pref_job_types   ON jobs_preferences USING GIN (job_types);
```

Run this script once after creating the `jobs_preferences` table.

---

## Environment Variables

| Variable | Required By | Description |
| --- | --- | --- |
| `SUPABASE_URL` | All functions | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions | Service role key (bypasses RLS) |
| `RAPIDAPI_KEY` | `yc-jobs.ts` only | RapidAPI key for the YC Jobs endpoint |

Set these in your Supabase project under **Settings → Edge Functions → Secrets**, or in a local `.env` file for development.

---

## Deployment

These are standard **Supabase Edge Functions** built on Deno.

```bash
# Deploy all functions
supabase functions deploy ashby-jobs
supabase functions deploy green-house
supabase functions deploy hackernews
supabase functions deploy jobicy
supabase functions deploy remoteok
supabase functions deploy the-muse
supabase functions deploy yc-jobs

# Set secrets
supabase secrets set RAPIDAPI_KEY=your_key_here
```

To invoke a function manually:

```bash
supabase functions invoke ashby-jobs
```

You can also schedule them using Supabase's built-in **pg_cron** extension or any external CRON scheduler to run on a recurring interval (e.g., every hour).

---

## Data Flow

```text
1. Edge function is invoked (HTTP GET / scheduled CRON)
         │
2. Fetch raw jobs from external API
         │
3. For each job:
   ├── Strip HTML from description
   ├── Map work_mode → REMOTE / HYBRID / ONSITE
   ├── Map job_type  → FULLTIME / CONTRACT / INTERNSHIP / PARTTIME
   ├── Infer experience from title keywords (senior, lead, head, director...)
   ├── processLocation() → normalised city + country
   └── Extract keywords[] from title + dept + type + mode
         │
4. INSERT batch into job_alerts table (Supabase)
         │
5. Downstream trigger / call invokes find_matching_users()
   for each new row → returns matched user emails for notification
```
