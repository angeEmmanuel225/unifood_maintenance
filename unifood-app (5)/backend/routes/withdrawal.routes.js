const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const c = require('../controllers/withdrawal.controller');

router.use(protect);

router.post('/', allowRoles('technicien'), c.createWithdrawal);
router.get('/', c.getWithdrawals);
router.get('/stats', c.getStats);
router.get('/export/excel', allowRoles('responsable'), c.exportExcel);
router.post('/mark-all-seen', allowRoles('responsable'), c.markAllSeen);
router.delete('/bulk', allowRoles('responsable'), c.bulkDelete);
router.patch('/:id/vu', allowRoles('responsable'), c.markSeen);
router.delete('/:id', allowRoles('responsable'), c.deleteWithdrawal);

module.exports = router;
