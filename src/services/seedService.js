const db = require('../config/db');
const candidateModel = require('../models/candidateModel');
const jobModel = require('../models/jobModel');
const matchingService = require('./matchingService');
const { candidates, jobs } = require('../db/seed-data');

const wipe = () => {
  // Children first; with ON DELETE CASCADE deleting parents would also work.
  for (const t of ['matches', 'candidate_skills', 'candidate_traits', 'job_skills', 'job_culture_keywords', 'candidates', 'jobs', 'skills']) {
    db.exec(`DELETE FROM ${t}`);
  }
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('candidates','jobs','skills')"); // restart ids at 1
};

/** Reset to the known seed data (idempotent) and compute all matches. */
function seedAll() {
  db.transaction(() => {
    wipe();
    candidates.forEach((c) => candidateModel.create(c));
    jobs.forEach((j) => jobModel.create(j));
  })();
  const matches = matchingService.recomputeAll();
  return { candidates: candidates.length, jobs: jobs.length, matches };
}

module.exports = { seedAll };
