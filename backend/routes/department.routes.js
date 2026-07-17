const express = require('express');
const router = express.Router();
const { getDepartments } = require('../controllers/department.controller');
const { protect } = require('../middleware/auth');

router.get('/', protect, getDepartments);

module.exports = router;
