const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const {
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcement.controller');

router.use(protect);

router.post('/', allowRoles('responsable'), createAnnouncement);
router.get('/', getAnnouncements);
router.patch('/:id', allowRoles('responsable'), updateAnnouncement);
router.delete('/:id', allowRoles('responsable'), deleteAnnouncement);

module.exports = router;
