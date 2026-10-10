# Recruiter Bot

Backend service that ingests candidates and jobs and ranks the best matches in both directions.
**Stack:** Node.js 18+, Express, SQLite via `better-sqlite3`. **All SQL is hand-written** (no ORM / query builder).

## Run locally
```bash
npm install
npm run seed      # optional: loads the fictional cast (or call POST /seed)
npm start         # http://localhost:3000   (npm run dev = auto-reload)
npm test          # 10 tests (unit + HTTP integration, in-memory DB)
```

## Structure (MVC + service layer)
```
src/
  routes/        URL -> controller wiring                         (the "V": JSON responses)
  controllers/   HTTP in/out only, no SQL, no scoring maths       (the "C")
  models/        ALL raw SQL lives here                           (the "M")
  services/      matchingService (scoring), seedService
  middleware/    validation, error handling
  config/        db connection, matching weights
  db/            schema.sql (hand-written DDL), seed data
sql_detective.sql   Part 2 answers
```

## API (curl)
```bash
curl -X POST localhost:3000/seed
curl localhost:3000/jobs
curl localhost:3000/candidates
curl localhost:3000/jobs/1/matches               # ranked candidates for a job
curl localhost:3000/candidates/1/matches         # ranked jobs for a candidate
curl "localhost:3000/jobs/1/matches?limit=3"
curl "localhost:3000/jobs/1/matches?include_all=true"   # also show zero-skill-overlap pairs
curl -X POST localhost:3000/candidates -H "Content-Type: application/json" -d '{
  "name":"Jessica J.","experience_years":6,"availability":"Immediate",
  "skills":["deduction","forensics"],"traits":["analytical"]}'
curl -X POST localhost:3000/jobs -H "Content-Type: application/json" -d '{
  "title":"Security Analyst","min_experience":2,"required_skills":["security","research"],
  "culture_keywords":["curious"]}'
curl -X POST localhost:3000/recompute            # after changing weights
```

## Schema decisions
- `skills` is normalised (one row per skill) and linked through `candidate_skills` / `job_skills`, so
  skill overlap is a real join and "who has skill X?" is indexable.
- `matches` is a stored, scored (job, candidate) pair with the full score breakdown + a human-readable
  `reason`. Ranking is a plain `ORDER BY score DESC` served by an index.
- Trade-off: stored matches can go stale, so creating a candidate/job recomputes only the affected
  rows, and `POST /recompute` rebuilds everything. For a much bigger dataset I'd compute lazily or in a queue.

## Matching algorithm
`score = 100 x (0.55 skills + 0.20 experience + 0.15 availability + 0.10 culture)`
- **Skills (0.55):** matched required skills / total required. Heaviest weight, since it answers "can they do the job?".
- **Experience (0.20):** 1.0 if years >= minimum, else years / minimum. No bonus for being over-qualified
  (more years is not automatically a better fit, and it keeps scores comparable).
- **Availability (0.15):** Immediate 1.0, 2 weeks 0.6, Not looking 0.2. Penalised rather than excluded:
  a recruiter may still want to approach a great passive candidate.
- **Culture (0.10):** candidate traits that exactly match job culture keywords / keyword count. Kept small
  because the data is sparse and exact-string matching is crude.
- **Zero skill overlap** pairs are hidden by default (`include_all=true` shows them).
- **Tie-break:** higher score, then more experience, then name A-Z, so output is deterministic.
- Weights live in `src/config/matchConfig.js`.

Known limitations / what I'd do next: synonym matching for traits (calm vs calm-under-pressure), weighting
skills by importance, a "stretch" bonus for transferable skills, pagination.

## AI tools
(Write your own honest note here: which tools you used, for what, and what you changed or verified yourself.)
