const Order = require('../models/Order');
const generateOrderPDF = require('../utils/generateOrderPDF');
const generateOrderWordBuffer = require('../utils/generateOrderWord');
const { generateOrdersListExcelBuffer } = require('../utils/generateOrderExcel');

function toDayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildFilters(req) {
  const { departement, statutCommande, urgence, dateDebut, dateFin, technicien, q } = req.query;
  const filters = {};

  if (req.user.role === 'technicien') {
    filters.technicien = req.user._id;
  } else if (technicien) {
    filters.technicien = technicien;
  }

  if (departement) filters.departement = departement;
  if (statutCommande) filters['items.statutCommande'] = statutCommande;
  if (urgence) filters['items.urgence'] = urgence;

  if (dateDebut || dateFin) {
    filters.dateCommande = {};
    if (dateDebut) filters.dateCommande.$gte = toDayStart(dateDebut);
    if (dateFin) {
      const end = new Date(dateFin);
      end.setHours(23, 59, 59, 999);
      filters.dateCommande.$lte = end;
    }
  }

  if (q) {
    filters.$or = [
      { 'items.designation': { $regex: q, $options: 'i' } },
      { 'items.reference': { $regex: q, $options: 'i' } },
      { technicienNom: { $regex: q, $options: 'i' } },
    ];
  }

  return filters;
}

async function findAccessibleOrder(req, res) {
  const order = await Order.findById(req.params.id || req.params.orderId);
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

// POST /api/orders — ajoute un article à la fiche commande du jour (la crée si besoin)
exports.createOrder = async (req, res) => {
  try {
    const { departement, designation, reference, quantite, unite, urgence, motif, dateSouhaitee } = req.body;

    if (!departement || !designation || !quantite || !motif) {
      return res.status(400).json({ message: 'Merci de renseigner tous les champs obligatoires de la commande.' });
    }

    const day = toDayStart(new Date());
    const item = {
      designation,
      reference,
      quantite,
      unite: unite || 'pièce',
      urgence: urgence || 'Normale',
      motif,
      dateSouhaitee: dateSouhaitee || undefined,
    };

    const order = await Order.findOneAndUpdate(
      { technicien: req.user._id, dateCommande: day },
      {
        $push: { items: item },
        $set: { departement, exporte: false, technicienNom: `${req.user.prenom} ${req.user.nom}` },
        $setOnInsert: { technicien: req.user._id, dateCommande: day },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la création de la commande.', error: err.message });
  }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const orders = await Order.find(filters).sort({ dateCommande: -1 }).limit(500);
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
      Order.countDocuments({ ...baseFilter, 'items.statutCommande': 'En attente' }),
      Order.countDocuments({ ...baseFilter, 'items.urgence': { $in: ['Urgente', 'Critique'] }, 'items.statutCommande': 'En attente' }),
      Order.countDocuments(baseFilter),
    ]);

    res.json({ enAttente, urgentes, totalCommandes });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques.', error: err.message });
  }
};

// GET /api/orders/export/excel (export groupé, responsable) — une ligne par article
exports.exportOrdersExcel = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const orders = await Order.find(filters).sort({ dateCommande: -1 }).limit(1000);
    await Order.updateMany({ _id: { $in: orders.map((o) => o._id) } }, { $set: { exporte: true } });

    const flatRows = [];
    orders.forEach((o) => {
      o.items.forEach((item) => {
        flatRows.push({
          createdAt: o.dateCommande,
          departement: o.departement,
          technicienNom: o.technicienNom,
          designation: item.designation,
          reference: item.reference,
          quantite: item.quantite,
          unite: item.unite,
          urgence: item.urgence,
          statutCommande: item.statutCommande,
          motif: item.motif,
        });
      });
    });

    const buffer = await generateOrdersListExcelBuffer(flatRows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="commandes-${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: "Erreur lors de l'export Excel des commandes.", error: err.message });
  }
};

// DELETE /api/orders/bulk?dateDebut=&dateFin=&departement=... (responsable) — nécessite au moins une date
exports.bulkDeleteOrders = async (req, res) => {
  try {
    if (!req.query.dateDebut && !req.query.dateFin) {
      return res.status(400).json({ message: 'Précise au moins une date (début ou fin) avant une suppression groupée.' });
    }
    const filters = buildFilters(req);
    const result = await Order.deleteMany(filters);
    res.json({ message: `${result.deletedCount} fiche(s) commande supprimée(s).`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression groupée.', error: err.message });
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
    order.exporte = true;
    await order.save();
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
    order.exporte = true;
    await order.save();
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
    order.exporte = true;
    await order.save();

    const flatRows = order.items.map((item) => ({
      createdAt: order.dateCommande,
      departement: order.departement,
      technicienNom: order.technicienNom,
      designation: item.designation,
      reference: item.reference,
      quantite: item.quantite,
      unite: item.unite,
      urgence: item.urgence,
      statutCommande: item.statutCommande,
      motif: item.motif,
    }));

    const buffer = await generateOrdersListExcelBuffer(flatRows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="commande-${order._id}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la génération du fichier Excel.', error: err.message });
  }
};

// PATCH /api/orders/:orderId/items/:itemId/statut (responsable uniquement)
exports.updateOrderItemStatus = async (req, res) => {
  try {
    const { statutCommande, noteResponsable } = req.body;
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });

    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Article introuvable dans cette commande.' });

    if (statutCommande) item.statutCommande = statutCommande;
    if (noteResponsable !== undefined) item.noteResponsable = noteResponsable;

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la commande.', error: err.message });
  }
};

// DELETE /api/orders/:id (responsable uniquement)
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
    res.json({ message: 'Commande supprimée.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la suppression.', error: err.message });
  }
};
