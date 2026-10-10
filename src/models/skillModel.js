const db = require('../config/db');

// Raw SQL only. Prepared statements are compiled once and reused.
const insertSkill = db.prepare('INSERT OR IGNORE INTO skills (name) VALUES (?)');
const findSkill = db.prepare('SELECT id FROM skills WHERE name = ?');

function getOrCreateSkillId(name) {
  insertSkill.run(name);
  return findSkill.get(name).id;
}

module.exports = { getOrCreateSkillId };
