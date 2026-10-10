const { HttpError } = require('./errorHandler');

const AVAILABILITY = ['Immediate', '2 weeks', 'Not looking'];
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isStringArray = (v) => Array.isArray(v) && v.every(isNonEmptyString);
const clean = (arr) => [...new Set(arr.map((s) => s.trim().toLowerCase()))];

function parseId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return next(new HttpError(400, 'id must be a positive integer'));
  req.id = id;
  next();
}

function parseMatchQuery(req, res, next) {
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return next(new HttpError(400, 'limit must be an integer between 1 and 500'));
  req.matchOptions = { limit, includeAll: req.query.include_all === 'true' };
  next();
}

function validateCandidate(req, res, next) {
  const b = req.body || {};
  const errors = [];
  if (!isNonEmptyString(b.name)) errors.push('name is required');
  if (!Number.isInteger(b.experience_years) || b.experience_years < 0) errors.push('experience_years must be an integer >= 0');
  if (!AVAILABILITY.includes(b.availability)) errors.push(`availability must be one of: ${AVAILABILITY.join(', ')}`);
  if (!isStringArray(b.skills)) errors.push('skills must be an array of strings');
  if (b.traits !== undefined && !isStringArray(b.traits)) errors.push('traits must be an array of strings');
  if (errors.length) return next(new HttpError(400, errors.join('; ')));
  req.body = {
    name: b.name.trim(), experience_years: b.experience_years, availability: b.availability,
    quirk: b.quirk, skills: clean(b.skills), traits: clean(b.traits || []),
  };
  next();
}

function validateJob(req, res, next) {
  const b = req.body || {};
  const errors = [];
  if (!isNonEmptyString(b.title)) errors.push('title is required');
  if (!Number.isInteger(b.min_experience) || b.min_experience < 0) errors.push('min_experience must be an integer >= 0');
  if (!isStringArray(b.required_skills) || b.required_skills.length === 0) errors.push('required_skills must be a non-empty array of strings');
  if (b.culture_keywords !== undefined && !isStringArray(b.culture_keywords)) errors.push('culture_keywords must be an array of strings');
  if (errors.length) return next(new HttpError(400, errors.join('; ')));
  req.body = {
    title: b.title.trim(), min_experience: b.min_experience, tagline: b.tagline,
    required_skills: clean(b.required_skills), culture_keywords: clean(b.culture_keywords || []),
  };
  next();
}

module.exports = { parseId, parseMatchQuery, validateCandidate, validateJob };
