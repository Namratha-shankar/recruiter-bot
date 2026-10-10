const router = require('express').Router();
const j = require('../controllers/jobController');
const { parseId, parseMatchQuery, validateJob } = require('../middleware/validate');

router.get('/', j.list);
router.post('/', validateJob, j.create);
router.get('/:id', parseId, j.get);
router.get('/:id/matches', parseId, parseMatchQuery, j.matches);

module.exports = router;
