const Department = require('../models/Department');

// GET /api/departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ nom: 1 });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des départements.', error: err.message });
  }
};
