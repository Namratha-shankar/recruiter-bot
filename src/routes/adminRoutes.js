const router = require('express').Router();
const a = require('../controllers/adminController');

router.post('/seed', a.seed);
router.post('/recompute', a.recompute);

module.exports = router;
