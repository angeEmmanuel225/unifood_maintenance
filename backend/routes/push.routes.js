const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/push.controller');

router.use(protect);
router.get('/public-key', c.publicKey);
router.post('/subscribe', c.subscribe);
router.post('/unsubscribe', c.unsubscribe);
router.post('/test', c.test);

module.exports = router;
