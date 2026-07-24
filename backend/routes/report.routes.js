const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const {
  createReport,
  getReports,
  getStats,
  exportReportsPDF,
  bulkDeleteReports,
  getReportById,
  downloadReportPDF,
  updateReportStatus,
  deleteReport,
} = require('../controllers/report.controller');

router.use(protect);

router.post('/', allowRoles('technicien'), createReport);
router.get('/', getReports);
router.get('/stats', getStats);
router.get('/export/pdf', allowRoles('responsable'), exportReportsPDF);
router.delete('/bulk', allowRoles('responsable'), bulkDeleteReports);
router.get('/:id', getReportById);
router.get('/:id/pdf', downloadReportPDF);
router.patch('/:id/statut', allowRoles('responsable'), updateReportStatus);
router.delete('/:id', allowRoles('responsable'), deleteReport);

module.exports = router;
