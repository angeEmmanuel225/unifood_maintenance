const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const c = require('../controllers/report.controller');

router.use(protect);

// --- routes fixes (avant les routes avec :id) ---
router.get('/draft/me', allowRoles('technicien'), c.getDraft);
router.put('/draft/me', allowRoles('technicien'), c.saveDraft);
router.delete('/draft/me', allowRoles('technicien'), c.deleteDraft);
router.get('/stats', c.getStats);
router.get('/export/pdf', allowRoles('responsable'), c.exportReportsPDF);
router.get('/backup-status', allowRoles('responsable'), c.getBackupStatus);
router.get('/photo/:photoId', c.getPhoto);
router.delete('/bulk', allowRoles('responsable'), c.bulkDeleteReports);

router.post('/', allowRoles('technicien'), c.createReport);
router.get('/', c.getReports);
router.get('/:id', c.getReportById);
router.get('/:id/pdf', c.downloadReportPDF);
router.patch('/:id/statut', allowRoles('responsable'), c.updateReportStatus);
router.delete('/:id', allowRoles('responsable'), c.deleteReport);

module.exports = router;
