const db = require('../config/db');

const upsert = db.prepare(`
  INSERT INTO matches
    (job_id, candidate_id, score, skill_score, experience_score, culture_score, availability_score, reason, computed_at)
  VALUES
    (@job_id, @candidate_id, @score, @skill_score, @experience_score, @culture_score, @availability_score, @reason, datetime('now'))
  ON CONFLICT (job_id, candidate_id) DO UPDATE SET
    score              = excluded.score,
    skill_score        = excluded.skill_score,
    experience_score   = excluded.experience_score,
    culture_score      = excluded.culture_score,
    availability_score = excluded.availability_score,
    reason             = excluded.reason,
    computed_at        = excluded.computed_at
`);

const saveMany = db.transaction((rows) => {
  for (const row of rows) upsert.run(row);
});

// Ranking: highest score first. Ties -> more experience first -> name A-Z (deterministic).
// By default pairs with zero skill overlap are hidden (they are not real matches).
const forJobSql = (includeAll) => `
  SELECT m.candidate_id, c.name AS candidate_name, c.experience_years, c.availability,
         m.score, m.skill_score, m.experience_score, m.culture_score, m.availability_score, m.reason
    FROM matches m
    JOIN candidates c ON c.id = m.candidate_id
   WHERE m.job_id = ? ${includeAll ? '' : 'AND m.skill_score > 0'}
   ORDER BY m.score DESC, c.experience_years DESC, c.name ASC
   LIMIT ?
`;

const forCandidateSql = (includeAll) => `
  SELECT m.job_id, j.title AS job_title, j.min_experience,
         m.score, m.skill_score, m.experience_score, m.culture_score, m.availability_score, m.reason
    FROM matches m
    JOIN jobs j ON j.id = m.job_id
   WHERE m.candidate_id = ? ${includeAll ? '' : 'AND m.skill_score > 0'}
   ORDER BY m.score DESC, j.min_experience DESC, j.title ASC
   LIMIT ?
`;

const findForJob = (jobId, { includeAll = false, limit = 50 } = {}) =>
  db.prepare(forJobSql(includeAll)).all(jobId, limit);

const findForCandidate = (candidateId, { includeAll = false, limit = 50 } = {}) =>
  db.prepare(forCandidateSql(includeAll)).all(candidateId, limit);

const clearAll = () => db.exec('DELETE FROM matches');

module.exports = { saveMany, findForJob, findForCandidate, clearAll };
