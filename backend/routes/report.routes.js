const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const {
  createReport,
  getReports,
  getStats,
  exportReportsPDF,
  getReportById,
  downloadReportPDF,
  updateReportStatus,
} = require('../controllers/report.controller');

router.use(protect);

router.post('/', allowRoles('technicien'), createReport);
router.get('/', getReports);
router.get('/stats', getStats);
router.get('/export/pdf', allowRoles('responsable'), exportReportsPDF);
router.get('/:id', getReportById);
router.get('/:id/pdf', downloadReportPDF);
router.patch('/:id/statut', allowRoles('responsable'), updateReportStatus);

module.exports = router;
