require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const departmentRoutes = require('./routes/department.routes');
const reportRoutes = require('./routes/report.routes');
const orderRoutes = require('./routes/order.routes');

const app = express();

connectDB();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ----- API -----
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'UNIFOOD TOGO - Maintenance API', time: new Date().toISOString() });
});

// ----- Sites statiques -----
// Site 1 : Espace Technicien  -> http://localhost:4000/technicien
// Site 2 : Espace Responsable -> http://localhost:4000/responsable
app.use('/technicien', express.static(path.join(__dirname, '..', 'technicien')));
app.use('/responsable', express.static(path.join(__dirname, '..', 'responsable')));

app.get('/', (req, res) => {
  res.redirect('/technicien');
});

// 404 pour les routes API inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route API introuvable.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serveur UNIFOOD TOGO démarré sur le port ${PORT}`);
  console.log(`  -> Espace Technicien  : http://localhost:${PORT}/technicien`);
  console.log(`  -> Espace Responsable : http://localhost:${PORT}/responsable`);
  console.log(`  -> API                : http://localhost:${PORT}/api`);
});
