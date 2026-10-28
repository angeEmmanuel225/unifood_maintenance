const express = require('express');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const c = require('../controllers/user.controller');

// Toute la gestion des comptes est réservée à l'administrateur
router.use(protect, allowRoles('responsable'));

router.get('/', c.listUsers);
router.post('/', c.createUser);
router.post('/bulk', c.createUsersBulk);
router.patch('/:id', c.updateUser);
router.post('/:id/reset-password', c.resetPassword);
router.delete('/:id', c.deleteUser);

module.exports = router;
