const candidateModel = require('../models/candidateModel');
const matchModel = require('../models/matchModel');
const matchingService = require('../services/matchingService');
const { HttpError } = require('../middleware/errorHandler');

const list = (req, res) => res.json(candidateModel.findAll());

const get = (req, res) => {
  const candidate = candidateModel.findById(req.id);
  if (!candidate) throw new HttpError(404, 'Candidate not found');
  res.json(candidate);
};

const create = (req, res) => {
  const id = candidateModel.create(req.body);
  matchingService.recomputeForCandidate(id); // keep matches fresh
  res.status(201).json(candidateModel.findById(id));
};

const matches = (req, res) => {
  const candidate = candidateModel.findById(req.id);
  if (!candidate) throw new HttpError(404, 'Candidate not found');
  res.json({
    candidate: { id: candidate.id, name: candidate.name },
    matches: matchModel.findForCandidate(req.id, req.matchOptions),
  });
};

module.exports = { list, get, create, matches };
