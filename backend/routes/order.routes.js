const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getStats,
  exportOrdersExcel,
  bulkDeleteOrders,
  getOrderById,
  downloadOrderPDF,
  downloadOrderWord,
  downloadOrderExcel,
  updateOrderItemStatus,
  deleteOrder,
} = require('../controllers/order.controller');

router.use(protect);

router.post('/', allowRoles('technicien'), createOrder);
router.get('/', getOrders);
router.get('/stats', getStats);
router.get('/export/excel', allowRoles('responsable'), exportOrdersExcel);
router.delete('/bulk', allowRoles('responsable'), bulkDeleteOrders);
router.get('/:id', getOrderById);
router.get('/:id/pdf', downloadOrderPDF);
router.get('/:id/word', downloadOrderWord);
router.get('/:id/excel', downloadOrderExcel);
router.patch('/:orderId/items/:itemId/statut', allowRoles('responsable'), updateOrderItemStatus);
router.delete('/:id', allowRoles('responsable'), deleteOrder);

module.exports = router;
