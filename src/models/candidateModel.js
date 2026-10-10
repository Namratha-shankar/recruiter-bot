const db = require('../config/db');
const { getOrCreateSkillId } = require('./skillModel');

const SELECT_CANDIDATES = `
  SELECT c.id, c.name, c.experience_years, c.availability, c.quirk,
         (SELECT GROUP_CONCAT(s.name)
            FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id
           WHERE cs.candidate_id = c.id) AS skills,
         (SELECT GROUP_CONCAT(t.trait)
            FROM candidate_traits t
           WHERE t.candidate_id = c.id) AS traits
    FROM candidates c
`;

const toList = (csv) => (csv ? csv.split(',') : []);
const hydrate = (row) => row && { ...row, skills: toList(row.skills), traits: toList(row.traits) };

const insertCandidate = db.prepare(
  'INSERT INTO candidates (name, experience_years, availability, quirk) VALUES (?, ?, ?, ?)'
);
const insertCandidateSkill = db.prepare(
  'INSERT OR IGNORE INTO candidate_skills (candidate_id, skill_id) VALUES (?, ?)'
);
const insertTrait = db.prepare(
  'INSERT OR IGNORE INTO candidate_traits (candidate_id, trait) VALUES (?, ?)'
);

// One transaction => a candidate is never half-inserted.
const create = db.transaction((c) => {
  const { lastInsertRowid } = insertCandidate.run(c.name, c.experience_years, c.availability, c.quirk ?? null);
  const id = Number(lastInsertRowid);
  for (const skill of c.skills) insertCandidateSkill.run(id, getOrCreateSkillId(skill));
  for (const trait of c.traits) insertTrait.run(id, trait);
  return id;
});

const findAll = () => db.prepare(`${SELECT_CANDIDATES} ORDER BY c.id`).all().map(hydrate);
const findById = (id) => hydrate(db.prepare(`${SELECT_CANDIDATES} WHERE c.id = ?`).get(id));

module.exports = { create, findAll, findById };
