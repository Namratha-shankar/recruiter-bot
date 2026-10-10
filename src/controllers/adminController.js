const seedService = require('../services/seedService');
const matchingService = require('../services/matchingService');

// POST /seed - wipe and reload the fictional cast, then compute matches.
const seed = (req, res) => res.status(201).json({ message: 'Database seeded', ...seedService.seedAll() });

// POST /recompute - recalculate every match (use after changing weights in matchConfig.js).
const recompute = (req, res) => res.json({ message: 'Matches recomputed', matches: matchingService.recomputeAll() });

module.exports = { seed, recompute };
