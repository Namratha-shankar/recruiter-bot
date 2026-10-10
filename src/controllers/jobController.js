const jobModel = require('../models/jobModel');
const matchModel = require('../models/matchModel');
const matchingService = require('../services/matchingService');
const { HttpError } = require('../middleware/errorHandler');

const list = (req, res) => res.json(jobModel.findAll());

const get = (req, res) => {
  const job = jobModel.findById(req.id);
  if (!job) throw new HttpError(404, 'Job not found');
  res.json(job);
};

const create = (req, res) => {
  const id = jobModel.create(req.body);
  matchingService.recomputeForJob(id);
  res.status(201).json(jobModel.findById(id));
};

const matches = (req, res) => {
  const job = jobModel.findById(req.id);
  if (!job) throw new HttpError(404, 'Job not found');
  res.json({
    job: { id: job.id, title: job.title },
    matches: matchModel.findForJob(req.id, req.matchOptions),
  });
};

module.exports = { list, get, create, matches };
