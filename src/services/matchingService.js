const { WEIGHTS, AVAILABILITY_SCORE } = require('../config/matchConfig');
const candidateModel = require('../models/candidateModel');
const jobModel = require('../models/jobModel');
const matchModel = require('../models/matchModel');

const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * Pure function: score one candidate against one job. No DB access, easy to unit test.
 *
 *  skill_score        = matched required skills / total required skills
 *  experience_score   = 1 if years >= min, else years / min (linear shortfall)
 *  culture_score      = overlap(candidate traits, job culture keywords) / job keywords
 *  availability_score = lookup table (Immediate 1.0, 2 weeks 0.6, Not looking 0.2)
 *  score              = 100 * weighted sum
 */
function scorePair(candidate, job) {
  const required = job.required_skills;
  const matchedSkills = required.filter((s) => candidate.skills.includes(s));
  const missingSkills = required.filter((s) => !candidate.skills.includes(s));
  const skillScore = required.length ? matchedSkills.length / required.length : 0;

  const experienceScore =
    job.min_experience === 0 || candidate.experience_years >= job.min_experience
      ? 1
      : candidate.experience_years / job.min_experience;

  const keywords = job.culture_keywords;
  const matchedCulture = keywords.filter((k) => candidate.traits.includes(k));
  const cultureScore = keywords.length ? matchedCulture.length / keywords.length : 0;

  const availabilityScore = AVAILABILITY_SCORE[candidate.availability] ?? 0;

  const total =
    WEIGHTS.skills * skillScore +
    WEIGHTS.experience * experienceScore +
    WEIGHTS.culture * cultureScore +
    WEIGHTS.availability * availabilityScore;

  const expText =
    candidate.experience_years >= job.min_experience
      ? `${candidate.experience_years} yrs meets the ${job.min_experience}-yr minimum`
      : `${candidate.experience_years} yrs is below the ${job.min_experience}-yr minimum`;

  const parts = [
    `Skills ${matchedSkills.length}/${required.length}` +
      (matchedSkills.length ? ` (${matchedSkills.join(', ')})` : '') +
      (missingSkills.length ? `, missing ${missingSkills.join(', ')}` : ''),
    expText,
    matchedCulture.length ? `culture fit: ${matchedCulture.join(', ')}` : 'no culture keyword overlap',
    `availability: ${candidate.availability}`,
  ];

  return {
    score: round(total * 100),
    skill_score: round(skillScore),
    experience_score: round(experienceScore),
    culture_score: round(cultureScore),
    availability_score: round(availabilityScore),
    reason: parts.join('; ') + '.',
  };
}

const toRow = (job, candidate) => ({ job_id: job.id, candidate_id: candidate.id, ...scorePair(candidate, job) });

/** Recompute every (job, candidate) pair. Fine for a prototype-sized dataset. */
function recomputeAll() {
  const candidates = candidateModel.findAll();
  const jobs = jobModel.findAll();
  const rows = jobs.flatMap((job) => candidates.map((c) => toRow(job, c)));
  matchModel.saveMany(rows);
  return rows.length;
}

/** Incremental: a new/changed candidate only affects its own row per job. */
function recomputeForCandidate(candidateId) {
  const candidate = candidateModel.findById(candidateId);
  const rows = jobModel.findAll().map((job) => toRow(job, candidate));
  matchModel.saveMany(rows);
  return rows.length;
}

/** Incremental: a new/changed job only affects its own row per candidate. */
function recomputeForJob(jobId) {
  const job = jobModel.findById(jobId);
  const rows = candidateModel.findAll().map((c) => toRow(job, c));
  matchModel.saveMany(rows);
  return rows.length;
}

module.exports = { scorePair, recomputeAll, recomputeForCandidate, recomputeForJob };
