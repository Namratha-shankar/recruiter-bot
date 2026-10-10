const router = require('express').Router();
const c = require('../controllers/candidateController');
const { parseId, parseMatchQuery, validateCandidate } = require('../middleware/validate');

router.get('/', c.list);
router.post('/', validateCandidate, c.create);
router.get('/:id', parseId, c.get);
router.get('/:id/matches', parseId, parseMatchQuery, c.matches);

module.exports = router;
