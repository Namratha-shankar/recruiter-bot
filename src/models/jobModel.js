const db = require('../config/db');
const { getOrCreateSkillId } = require('./skillModel');

const SELECT_JOBS = `
  SELECT j.id, j.title, j.min_experience, j.tagline,
         (SELECT GROUP_CONCAT(s.name)
            FROM job_skills js JOIN skills s ON s.id = js.skill_id
           WHERE js.job_id = j.id) AS required_skills,
         (SELECT GROUP_CONCAT(k.keyword)
            FROM job_culture_keywords k
           WHERE k.job_id = j.id) AS culture_keywords
    FROM jobs j
`;

const toList = (csv) => (csv ? csv.split(',') : []);
const hydrate = (row) =>
  row && { ...row, required_skills: toList(row.required_skills), culture_keywords: toList(row.culture_keywords) };

const insertJob = db.prepare('INSERT INTO jobs (title, min_experience, tagline) VALUES (?, ?, ?)');
const insertJobSkill = db.prepare('INSERT OR IGNORE INTO job_skills (job_id, skill_id) VALUES (?, ?)');
const insertKeyword = db.prepare('INSERT OR IGNORE INTO job_culture_keywords (job_id, keyword) VALUES (?, ?)');

const create = db.transaction((j) => {
  const { lastInsertRowid } = insertJob.run(j.title, j.min_experience, j.tagline ?? null);
  const id = Number(lastInsertRowid);
  for (const skill of j.required_skills) insertJobSkill.run(id, getOrCreateSkillId(skill));
  for (const kw of j.culture_keywords) insertKeyword.run(id, kw);
  return id;
});

const findAll = () => db.prepare(`${SELECT_JOBS} ORDER BY j.id`).all().map(hydrate);
const findById = (id) => hydrate(db.prepare(`${SELECT_JOBS} WHERE j.id = ?`).get(id));

module.exports = { create, findAll, findById };
