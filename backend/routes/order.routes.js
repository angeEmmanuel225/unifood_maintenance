const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getStats,
  exportOrdersExcel,
  getOrderById,
  downloadOrderPDF,
  downloadOrderWord,
  downloadOrderExcel,
  updateOrderStatus,
} = require('../controllers/order.controller');

router.use(protect);

router.post('/', allowRoles('technicien'), createOrder);
router.get('/', getOrders);
router.get('/stats', getStats);
router.get('/export/excel', allowRoles('responsable'), exportOrdersExcel);
router.get('/:id', getOrderById);
router.get('/:id/pdf', downloadOrderPDF);
router.get('/:id/word', downloadOrderWord);
router.get('/:id/excel', downloadOrderExcel);
router.patch('/:id/statut', allowRoles('responsable'), updateOrderStatus);

module.exports = router;
