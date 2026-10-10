-- Recruiter Bot schema (hand-written DDL, SQLite dialect)

CREATE TABLE IF NOT EXISTS candidates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  experience_years INTEGER NOT NULL CHECK (experience_years >= 0),
  availability     TEXT    NOT NULL CHECK (availability IN ('Immediate', '2 weeks', 'Not looking')),
  quirk            TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT    NOT NULL,
  min_experience INTEGER NOT NULL CHECK (min_experience >= 0),
  tagline        TEXT
);

-- Skills are normalised: one row per distinct skill, shared by candidates & jobs.
CREATE TABLE IF NOT EXISTS skills (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS candidate_skills (
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill_id     INTEGER NOT NULL REFERENCES skills(id)     ON DELETE CASCADE,
  PRIMARY KEY (candidate_id, skill_id)
);

CREATE TABLE IF NOT EXISTS job_skills (
  job_id   INTEGER NOT NULL REFERENCES jobs(id)   ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS candidate_traits (
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  trait        TEXT    NOT NULL,
  PRIMARY KEY (candidate_id, trait)
);

CREATE TABLE IF NOT EXISTS job_culture_keywords (
  job_id  INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  keyword TEXT    NOT NULL,
  PRIMARY KEY (job_id, keyword)
);

-- A "match" = one scored (job, candidate) pair, with the score breakdown stored
-- so we can explain it and rank it with a plain ORDER BY.
CREATE TABLE IF NOT EXISTS matches (
  job_id             INTEGER NOT NULL REFERENCES jobs(id)       ON DELETE CASCADE,
  candidate_id       INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  score              REAL    NOT NULL,   -- 0..100
  skill_score        REAL    NOT NULL,   -- 0..1
  experience_score   REAL    NOT NULL,   -- 0..1
  culture_score      REAL    NOT NULL,   -- 0..1
  availability_score REAL    NOT NULL,   -- 0..1
  reason             TEXT    NOT NULL,
  computed_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_job_score       ON matches (job_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_candidate_score ON matches (candidate_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_skill  ON candidate_skills (skill_id);
CREATE INDEX IF NOT EXISTS idx_job_skills_skill        ON job_skills (skill_id);
