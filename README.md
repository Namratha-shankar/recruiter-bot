# Recruiter Bot

A backend service that ingests candidate profiles and job openings, scores every candidate against every
job, and exposes ranked matches in both directions: **best candidates for a job** and **best jobs for a
candidate**. Every match comes with a score and a plain-English reason.

The test data is a cast of fictional characters (Sherlock Holmes applying to be a Backend Detective,
Michael Scott applying to be a Sales Engineer, and so on).

**Stack:** Node.js 18+, Express, SQLite via `better-sqlite3`.
**All SQL is hand-written.** There is no ORM and no query builder. `better-sqlite3` is only a driver that
sends my SQL strings to the database.

---

## Table of contents
1. [Quick start](#quick-start)
2. [Project structure](#project-structure)
3. [API reference](#api-reference)
4. [Database schema](#database-schema)
5. [The matching algorithm](#the-matching-algorithm)
6. [Design decisions and trade-offs](#design-decisions-and-trade-offs)
7. [Testing](#testing)
8. [Part 2: SQL Detective](#part-2-sql-detective)
9. [Limitations and next steps](#limitations-and-next-steps)
10. [AI tools](#ai-tools)

---

## Quick start

**Requirements:** Node.js 18 or newer.

```bash
npm install
npm run seed      # loads 15 candidates + 6 jobs and computes all 90 matches
npm start         # http://localhost:3000  (use `npm run dev` for auto-reload)
npm test          # 10 tests: unit tests + HTTP integration tests
```

The database is a single SQLite file created automatically at `data/recruiter-bot.db`. It is git-ignored.
To start fresh, delete the file or call `POST /seed`, which wipes and reloads everything.

| Environment variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data/recruiter-bot.db` | SQLite file (`:memory:` is used by the tests) |

**Windows notes**
- In PowerShell, use `curl.exe` instead of `curl`, or use the Postman collection below.
- If `npm` is blocked by an execution-policy error, run
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.
- If you see `EADDRINUSE`, a server is already running on that port. Stop it or use another `PORT`.

**Postman collection:** import `postman_collection.json` (Postman: Import, then select the file) to try
every endpoint, including the error cases. Start the server first.

---

## Project structure

The project follows MVC with a small service layer for business logic.

```
recruiter-bot/
├── package.json
├── README.md
├── postman_collection.json     Postman requests for every endpoint
├── sql_detective.sql           Part 2 answers (one query per question)
├── sql_detective_setup.sql     Part 2 dataset, loaded as given in the brief
├── src/
│   ├── server.js               starts the HTTP server
│   ├── app.js                  Express setup, routes, error handling
│   ├── routes/                 URL -> controller wiring
│   ├── controllers/            HTTP only: parse request, call model/service, send JSON
│   ├── models/                 ALL raw SQL lives here
│   ├── services/
│   │   ├── matchingService.js  the scoring algorithm (pure function scorePair)
│   │   └── seedService.js      resets and loads the seed data
│   ├── middleware/             input validation + central error handler
│   ├── config/
│   │   ├── db.js               opens SQLite, enables foreign keys, runs schema.sql
│   │   └── matchConfig.js      scoring weights (the tuning knobs)
│   └── db/
│       ├── schema.sql          hand-written DDL
│       ├── seed-data.js        the fictional candidates and jobs
│       └── seed.js             `npm run seed`
└── tests/
    └── matching.test.js
```

**Request flow** for `GET /jobs/1/matches`: route (validates `id` and query params), then
`jobController.matches` (404 if the job is missing), then `matchModel.findForJob` (one SQL query),
then JSON response. Controllers contain no SQL and models contain no HTTP code.

---

## API reference

Base URL: `http://localhost:3000`. All responses are JSON.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/seed` | Wipe and reload the seed data, then compute all matches |
| POST | `/recompute` | Recompute every match (use after changing the weights) |
| GET | `/candidates` | List all candidates (with skills and traits) |
| GET | `/candidates/:id` | One candidate |
| POST | `/candidates` | Create a candidate and compute their matches |
| GET | `/candidates/:id/matches` | **Ranked jobs for a candidate** |
| GET | `/jobs` | List all jobs (with required skills and culture keywords) |
| GET | `/jobs/:id` | One job |
| POST | `/jobs` | Create a job and compute its matches |
| GET | `/jobs/:id/matches` | **Ranked candidates for a job** |

**Query parameters for the two `/matches` endpoints**

| Param | Default | Meaning |
|---|---|---|
| `limit` | `50` | Max rows returned (1 to 500) |
| `include_all` | `false` | `true` also returns pairs with zero skill overlap |

### Examples (curl)

```bash
curl -X POST localhost:3000/seed
curl localhost:3000/jobs
curl localhost:3000/candidates
curl localhost:3000/jobs/1/matches                        # ranked candidates for a job
curl localhost:3000/candidates/1/matches                  # ranked jobs for a candidate
curl "localhost:3000/jobs/2/matches?limit=3"
curl "localhost:3000/jobs/1/matches?include_all=true"

curl -X POST localhost:3000/candidates -H "Content-Type: application/json" -d '{
  "name": "Jessica J.", "experience_years": 6, "availability": "Immediate",
  "skills": ["deduction", "forensics"], "traits": ["analytical"] }'

curl -X POST localhost:3000/jobs -H "Content-Type: application/json" -d '{
  "title": "Security Analyst", "min_experience": 2,
  "required_skills": ["security", "research"], "culture_keywords": ["curious"] }'

curl -X POST localhost:3000/recompute
```

### Example response: `GET /jobs/1/matches`

```json
{
  "job": { "id": 1, "title": "Backend Detective" },
  "matches": [
    {
      "candidate_id": 1,
      "candidate_name": "Sherlock H.",
      "experience_years": 8,
      "availability": "Immediate",
      "score": 95,
      "skill_score": 1,
      "experience_score": 1,
      "culture_score": 0.5,
      "availability_score": 1,
      "reason": "Skills 3/3 (deduction, pattern-recognition, forensics); 8 yrs meets the 3-yr minimum; culture fit: analytical; availability: Immediate."
    },
    {
      "candidate_id": 9,
      "candidate_name": "Sheldon C.",
      "score": 53.33,
      "reason": "Skills 1/3 (pattern-recognition), missing deduction, forensics; 9 yrs meets the 3-yr minimum; no culture keyword overlap; availability: Immediate."
    }
  ]
}
```

### Validation and errors

| Situation | Status |
|---|---|
| `:id` is not a positive integer | `400` |
| `limit` outside 1 to 500 | `400` |
| POST body missing or invalid (name, `experience_years` >= 0, `availability` one of `Immediate` / `2 weeks` / `Not looking`, non-empty skill arrays) | `400` with the list of problems |
| Candidate or job does not exist | `404` |
| Malformed JSON body | `400` |
| Created a candidate or job | `201` |

Skills, traits and culture keywords are trimmed and lower-cased on input so `"Research "` and `"research"`
count as the same skill.

---

## Database schema

Hand-written DDL in [`src/db/schema.sql`](src/db/schema.sql).

```
candidates ──< candidate_skills >── skills ──< job_skills >── jobs
    │                                                            │
    └──< candidate_traits                    job_culture_keywords >──┘
    │                                                            │
    └──────────────────────< matches >───────────────────────────┘
```

| Table | Purpose |
|---|---|
| `candidates` | name, years of experience, availability, quirk |
| `jobs` | title, minimum experience, tagline |
| `skills` | one row per distinct skill, shared by candidates and jobs |
| `candidate_skills`, `job_skills` | many-to-many links to `skills` |
| `candidate_traits`, `job_culture_keywords` | soft-signal tags |
| `matches` | one scored (job, candidate) pair: total score, four sub-scores, reason text |

Details worth noting:
- `CHECK` constraints validate availability and non-negative numbers; foreign keys use `ON DELETE CASCADE`.
- `matches` has a composite primary key `(job_id, candidate_id)`, so there is exactly one row per pair
  and recomputing is an upsert (`INSERT ... ON CONFLICT DO UPDATE`).
- Indexes on `matches(job_id, score DESC)` and `matches(candidate_id, score DESC)` serve the ranking queries.
- All queries use `?` or named parameters. User input is never concatenated into SQL, which prevents SQL
  injection. The only SQL assembled from fragments is a fixed `AND skill_score > 0` clause and a fixed list
  of table names.

---

## The matching algorithm

Implemented in [`src/services/matchingService.js`](src/services/matchingService.js) as a **pure function**,
`scorePair(candidate, job)`, with no database access, so it is trivial to unit test.

```
score = 100 x ( 0.55 x skills + 0.20 x experience + 0.15 x availability + 0.10 x culture )
```

| Factor | Weight | How it is computed |
|---|---|---|
| Skills | 0.55 | matched required skills / total required skills |
| Experience | 0.20 | `1.0` if years >= minimum, otherwise `years / minimum` |
| Availability | 0.15 | Immediate `1.0`, 2 weeks `0.6`, Not looking `0.2` |
| Culture | 0.10 | candidate traits that exactly match job culture keywords / number of keywords |

Weights live in [`src/config/matchConfig.js`](src/config/matchConfig.js).

**Ranking:** score descending, then more experience, then name A to Z, so the order is deterministic.
Pairs with **zero skill overlap** are hidden by default (they are not real matches); `include_all=true`
shows them.

### Worked example: Sherlock H. for "Backend Detective"

| Factor | Calculation | Contribution |
|---|---|---|
| Skills | 3 of 3 required (deduction, pattern-recognition, forensics) = 1.0 | 0.55 |
| Experience | 8 yrs vs 3-yr minimum = 1.0 | 0.20 |
| Availability | Immediate = 1.0 | 0.15 |
| Culture | "analytical" matches 1 of 2 keywords = 0.5 | 0.05 |
| **Total** | | **0.95 -> score 95** |

Sheldon C. has only 1 of 3 required skills, so he scores 53.33 for the same job.

### Why availability can outrank culture
For "Rapid Prototyping Engineer", Rick (90), MacGyver (84) and Tony (83) all have both required skills and
meet the experience bar. Availability separates them: Rick is Immediate, MacGyver is available in 2 weeks,
and Tony is "Not looking" (his culture match is not enough to make up for it).

---

## Design decisions and trade-offs

**1. Skills carry the most weight (0.55).** The first question a recruiter asks is "can this person do the
job?" Experience is second because it is a hard-ish requirement. Availability and culture are practical and
soft signals, so they are weighted lower.

**2. Experience is a shortfall penalty, not a "more is better" bonus.** A candidate with 20 years is not
automatically a better fit for a 2-year role than one with 5, and a bonus would let seniority hide missing
skills. Below the minimum the score scales linearly, so 2 years against a 4-year minimum gets 0.5.

**3. "Not looking" is penalised, not excluded.** A recruiter may still want to approach an excellent passive
candidate. Penalising keeps them visible but ranked below people who are ready to move.

**4. Culture is deliberately small (0.10).** The trait and keyword data is sparse and compared by exact
string, so a strong signal here would be mostly noise. It works as a tie-breaker between otherwise similar
candidates.

**5. Normalised skills table.** Skill overlap becomes a real join, "who has skill X?" is indexable, and
there is no string parsing in SQL.

**6. Matches are stored, not computed per request.** Reads are a single indexed `ORDER BY`, and each row
carries its explanation. The cost is that stored scores can go stale:
- creating a candidate or job recomputes only the affected rows (one candidate against all jobs, or one job
  against all candidates), and
- `POST /recompute` rebuilds everything, which is needed after changing the weights.

**7. Raw SQL confined to `models/`.** Controllers and services never touch SQL, so swapping the database
only touches one layer.

**8. SQLite.** Zero setup, so a reviewer can run the project in two commands, and it supports joins,
transactions, foreign keys, upserts and window functions. The trade-off is a single writer, so for production
I would move to PostgreSQL.

**9. Transactions.** Creating a candidate or job inserts into several tables inside one transaction, and
bulk match writes are batched in one, so a failure never leaves half-written data.

### If the dataset were 1,000,000 candidates
Storing every pair (candidates x jobs) would not scale. I would pre-filter candidates by required skill
using the `candidate_skills` index (only people with at least one required skill can match), score only
those, paginate, and move recomputation into a background queue instead of a synchronous request.

---

## Testing

```bash
npm test
```

Uses Node's built-in test runner (no extra dependencies). 10 tests:

**Unit tests (the scoring function)**
- a perfect candidate scores 100
- half the skills gives `skill_score` 0.5 and names the missing skill in the reason
- experience below the minimum is scaled linearly
- extra experience gives no extra credit
- "Not looking" ranks below "Immediate" when everything else is equal

**Integration tests (HTTP, real SQL, in-memory database)**
- Backend Detective ranks Sherlock first
- Sales Engineer includes Michael and Dwight and excludes Sherlock
- reverse direction: Rick's best match is Rapid Prototyping Engineer
- `404` for an unknown job and `400` for a bad id
- `POST /candidates` rejects invalid input, and a new valid candidate appears in a job's ranking

---

## Part 2: SQL Detective

- [`sql_detective_setup.sql`](sql_detective_setup.sql) loads the hiring-ops dataset exactly as given.
- [`sql_detective.sql`](sql_detective.sql) has one query per question, each preceded by its number.
  It is standard SQL and runs on SQLite, MySQL 8+ and PostgreSQL.

| # | Question | Approach | Result |
|---|---|---|---|
| 1 | Open postings with recruiter name | `JOIN` + `WHERE status = 'open'` | Postings 1, 2, 4, 5 |
| 2 | Applicants reaching Final, per posting | `LEFT JOIN` on Final interviews + `COUNT(DISTINCT applicant_id)`, so postings with none show 0 | 2, 2, 1, 2, 0, 0, 2 for postings 1 to 7 |
| 3 | People who effectively applied to more than one posting | The data is dirty: Ananya Rao exists twice with e-mails that differ only in case. Identity is `LOWER(email)`, counting `DISTINCT` postings | Ananya Rao, Ben Turner, Elena Popescu |
| 4 | Final-stage conversion per recruiter (>= 3 Finals) | `SUM(CASE ...) / COUNT(*)` with `100.0 *` to avoid integer division, and `HAVING COUNT(*) >= 3` | Priya Shah 75%, Daniel Ortiz 50% |
| 5 | (Bonus) Top placement recruiter per department | CTE + `RANK() OVER (PARTITION BY department ORDER BY placements DESC)`; `RANK` rather than `ROW_NUMBER` so ties are kept | Engineering: Priya Shah (3), Data: Fatima Al-Sayed (1) |

In Q4, `no_show` and pending (`NULL`) Finals count in the denominator but not as passed.

---

## Limitations and next steps

- **Trait matching is exact-string.** "calm" does not match "calm-under-pressure". Next: a synonym map or
  embeddings.
- **All required skills are weighted equally.** Next: per-skill importance (must-have vs nice-to-have).
- **No transferable-skill credit.** Related skills (for example `systems-design` and `rapid-prototyping`)
  could earn partial credit.
- **Recomputation is synchronous.** Fine for 15 x 6, but needs a background job at scale.
- **No pagination** beyond `limit`. Next: cursor or offset pagination.
- **No authentication or rate limiting.** Out of scope for a prototype.
- **Candidate and job update/delete endpoints** are not implemented, only create and read.

---

## AI tools

I used an AI assistant (Claude) while working on this project, for scaffolding and drafting the project
structure, the schema, the SQL, the tests and this README.

**What I did myself:** I ran the project on my own machine, fixed
setup problems, tested every endpoint in Postman, changed the weights and watched how the rankings moved,
ran the Part 2 queries against the dataset and checked the answers by hand, and read through every file so I
can explain it.

I am happy to walk through any part of the code, the algorithm or the SQL and to make live changes.