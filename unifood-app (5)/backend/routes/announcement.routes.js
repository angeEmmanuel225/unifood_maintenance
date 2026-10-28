const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect, allowRoles } = require('../middleware/auth');
const c = require('../controllers/announcement.controller');

// Fichiers gardés en mémoire puis stockés dans MongoDB (collection séparée, avec expiration automatique)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: c.MAX_FILE_SIZE, files: c.MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (!c.ALLOWED_MIMES.includes(file.mimetype)) return cb(new Error('Formats acceptés : photos (JPG, PNG, WebP) et PDF.'));
    cb(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.array('fichiers', c.MAX_FILES)(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Un fichier dépasse 5 Mo.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Maximum ${c.MAX_FILES} fichiers par annonce.`
            : err.message || "Erreur lors de l'envoi des fichiers.";
      return res.status(400).json({ message });
    }
    next();
  });
}

router.use(protect);

router.get('/files/:fileId', c.downloadFile);
router.get('/', c.getAnnouncements);
router.post('/', allowRoles('responsable'), handleUpload, c.createAnnouncement);
router.patch('/:id', allowRoles('responsable'), handleUpload, c.updateAnnouncement);
router.delete('/:id/files/:fileId', allowRoles('responsable'), c.removeFile);
router.delete('/:id', allowRoles('responsable'), c.deleteAnnouncement);

module.exports = router;
