const Order = require('../models/Order');
const generateOrderPDF = require('../utils/generateOrderPDF');
const generateOrderWordBuffer = require('../utils/generateOrderWord');
const { generateOrderExcelBuffer, generateOrdersListExcelBuffer } = require('../utils/generateOrderExcel');

function buildFilters(req) {
  const { departement, statutCommande, urgence, dateDebut, dateFin, technicien, q } = req.query;
  const filters = {};

  if (req.user.role === 'technicien') {
    filters.technicien = req.user._id;
  } else if (technicien) {
    filters.technicien = technicien;
  }

  if (departement) filters.departement = departement;
  if (statutCommande) filters.statutCommande = statutCommande;
  if (urgence) filters.urgence = urgence;

  if (dateDebut || dateFin) {
    filters.createdAt = {};
    if (dateDebut) filters.createdAt.$gte = new Date(dateDebut);
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      filters.createdAt.$lte = end;
    }
  }

  if (q) {
    filters.$or = [
      { designation: { $regex: q, $options: 'i' } },
      { reference: { $regex: q, $options: 'i' } },
      { technicienNom: { $regex: q, $options: 'i' } },
    ];
  }

  return filters;
}

async function findAccessibleOrder(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable.' });
    return null;
  }
  if (req.user.role === 'technicien' && String(order.technicien) !== String(req.user._id)) {
    res.status(403).json({ message: 'Accès refusé à cette commande.' });
    return null;
  }
  return order;
}

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { departement, designation, reference, quantite, unite, urgence, motif, dateSouhaitee } = req.body;

    if (!departement || !designation || !quantite || !motif) {
      return res.status(400).json({ message: 'Merci de renseigner tous les champs obligatoires de la commande.' });
    }

    const order = await Order.create({
      technicien: req.user._id,
      technicienNom: `${req.user.prenom} ${req.user.nom}`,
      departement,
      designation,
      reference,
      quantite,
      unite: unite || 'pièce',
      urgence: urgence || 'Normale',
      motif,
      dateSouhaitee: dateSouhaitee || undefined,
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création de la commande.', error: err.message });
  }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const orders = await Order.find(filters).sort({ createdAt: -1 }).limit(500);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des commandes.', error: err.message });
  }
};

// GET /api/orders/stats
exports.getStats = async (req, res) => {
  try {
    const baseFilter = req.user.role === 'technicien' ? { technicien: req.user._id } : {};

    const [enAttente, urgentes, totalCommandes] = await Promise.all([
      Order.countDocuments({ ...baseFilter, statutCommande: 'En attente' }),
      Order.countDocuments({ ...baseFilter, urgence: { $in: ['Urgente', 'Critique'] }, statutCommande: 'En attente' }),
      Order.countDocuments(baseFilter),
    ]);

    res.json({ enAttente, urgentes, totalCommandes });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: err.message });
  }
};

// GET /api/orders/export/excel  (export groupé — responsable uniquement)
exports.exportOrdersExcel = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const orders = await Order.find(filters).sort({ createdAt: -1 }).limit(1000);
    const buffer = await generateOrdersListExcelBuffer(orders);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="commandes-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'export Excel des commandes.", error: err.message });
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la commande.', error: err.message });
  }
};

// GET /api/orders/:id/pdf
exports.downloadOrderPDF = async (req, res) => {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;
    generateOrderPDF(order, res);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du PDF.', error: err.message });
  }
};

// GET /api/orders/:id/word
exports.downloadOrderWord = async (req, res) => {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;
    const buffer = await generateOrderWordBuffer(order);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="commande-${order._id}.docx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du document Word.', error: err.message });
  }
};

// GET /api/orders/:id/excel
exports.downloadOrderExcel = async (req, res) => {
  try {
    const order = await findAccessibleOrder(req, res);
    if (!order) return;
    const buffer = await generateOrderExcelBuffer(order);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="commande-${order._id}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du fichier Excel.', error: err.message });
  }
};

// PATCH /api/orders/:id/statut  (responsable uniquement)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { statutCommande, noteResponsable } = req.body;
    const update = {};
    if (statutCommande) update.statutCommande = statutCommande;
    if (noteResponsable !== undefined) update.noteResponsable = noteResponsable;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande.', error: err.message });
  }
};
