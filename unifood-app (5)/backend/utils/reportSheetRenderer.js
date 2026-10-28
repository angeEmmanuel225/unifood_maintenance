const fs = require('fs');
const path = require('path');
const { theme, formatDate } = require('./pdfHelpers');

const LEFT = 40;
const WIDTH = 515;
const PAGE_BOTTOM = 770;

const COLS = [
  { key: 'machineConcernee', label: 'Machine concernée', w: 100 },
  { key: 'descriptionPanne', label: 'Panne ou observations', w: 150 },
  { key: 'actionMenee', label: 'Tâche effectuée', w: 150 },
  { key: 'heureDebut', label: 'Début', w: 57 },
  { key: 'heureFin', label: 'Fin', w: 58 },
];

const HORAIRES = [
  ['06h-14h', '6h'],
  ['14h-22h', '14h'],
  ['22h-06h', '22h'],
  ['Journée 08h-16h', 'Jour'],
];

const ASSETS_DIR = path.join(__dirname, '..', '..', 'technicien', 'assets');

// Ton logo officiel : technicien/assets/logo-unifood.png (sinon l'icône de l'application est utilisée)
function findLogo() {
  for (const name of ['logo-unifood.png', 'logo-unifood.jpg', 'logo-unifood.jpeg']) {
    const p = path.join(ASSETS_DIR, name);
    if (fs.existsSync(p)) return { path: p, custom: true };
  }
  const icon = path.join(ASSETS_DIR, 'icon-192.png');
  return fs.existsSync(icon) ? { path: icon, custom: false } : null;
}

function drawCheckbox(doc, x, y, checked) {
  doc.lineWidth(0.8).strokeColor(theme.colors.steel).rect(x, y, 9, 9).stroke();
  if (checked) {
    doc.lineWidth(1.6).strokeColor(theme.colors.raspberry);
    doc.moveTo(x + 1.8, y + 4.8).lineTo(x + 3.8, y + 7.2).lineTo(x + 8, y + 1.6).stroke();
  }
}

function drawBox(doc, x, y, w, h, title) {
  doc.lineWidth(1).strokeColor(theme.colors.steel).roundedRect(x, y, w, h, 5).stroke();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(theme.colors.steel).text(title.toUpperCase(), x + 8, y + 6, { width: w - 16, lineBreak: false });
  doc.lineWidth(0.5).strokeColor('#d8cdb9').moveTo(x + 6, y + 17).lineTo(x + w - 6, y + 17).stroke();
}

function drawHeader(doc, report, departments) {
  const y0 = 40;
  const logo = findLogo();
  const textLogo = (x) => {
    doc.font('Helvetica-Bold').fontSize(15).fillColor(theme.colors.steel).text('UNIFOOD', x, y0 + 16, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(theme.colors.gray).text('TOGO — Confiserie', x, y0 + 35, { lineBreak: false });
  };
  try {
    if (logo && logo.custom) {
      doc.image(logo.path, LEFT, y0, { fit: [125, 62] });
    } else if (logo) {
      doc.image(logo.path, LEFT, y0 + 4, { fit: [52, 52] });
      textLogo(LEFT + 58);
    } else {
      textLogo(LEFT);
    }
  } catch (e) {
    textLogo(LEFT);
  }

  // Responsables de département : on coche celui de la fiche
  const list = departments && departments.length ? departments.slice() : [];
  if (!list.some((d) => d.responsable === report.responsableDepartement)) {
    list.push({ responsable: report.responsableDepartement, nom: report.departement });
  }
  const boxX = 180;
  const boxW = 215;
  const rowH = 14;
  const boxH = 24 + list.length * rowH;
  drawBox(doc, boxX, y0, boxW, boxH, 'Responsable de département');
  list.forEach((d, i) => {
    const ry = y0 + 22 + i * rowH;
    drawCheckbox(doc, boxX + 9, ry, d.responsable === report.responsableDepartement);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1a1a1a');
    const nameW = doc.widthOfString(d.responsable);
    doc.text(d.responsable, boxX + 24, ry + 0.5, { lineBreak: false });
    doc.font('Helvetica').fontSize(6.5).fillColor(theme.colors.gray);
    const remaining = boxW - 24 - nameW - 14;
    if (remaining > 20) doc.text(d.nom || '', boxX + 24 + nameW + 6, ry + 2, { width: remaining, height: 9, ellipsis: true, lineBreak: false });
  });

  // Horaire de travail, juste à côté
  const hX = boxX + boxW + 10;
  const hW = LEFT + WIDTH - hX;
  drawBox(doc, hX, y0, hW, boxH, 'Horaire de travail');
  HORAIRES.forEach(([value, label], i) => {
    const ry = y0 + 22 + i * rowH;
    drawCheckbox(doc, hX + 9, ry, report.horaire === value);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a').text(label, hX + 24, ry + 0.5, { lineBreak: false });
  });

  let y = y0 + Math.max(boxH, 62) + 10;
  doc.rect(LEFT, y, WIDTH, 22).fill(theme.colors.steel);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('RAPPORT JOURNALIER DES TECHNICIENS', LEFT, y + 6, { width: WIDTH, align: 'center', lineBreak: false });
  y += 30;

  doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
  doc.font('Helvetica-Bold').text('Technicien : ', LEFT, y, { continued: true }).font('Helvetica').text(`${report.technicienNom}     `, { continued: true });
  doc.font('Helvetica-Bold').text('Département : ', { continued: true }).font('Helvetica').text(`${report.departement}     `, { continued: true });
  doc.font('Helvetica-Bold').text('Date : ', { continued: true }).font('Helvetica').text(formatDate(report.dateRapport));
  return y + 22;
}

function drawTableHeader(doc, y) {
  doc.rect(LEFT, y, WIDTH, 17).fill(theme.colors.praline);
  let x = LEFT;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
  COLS.forEach((c) => {
    doc.text(c.label.toUpperCase(), x + 4, y + 5, { width: c.w - 8, lineBreak: false });
    x += c.w;
  });
  return y + 17;
}

function measureRow(doc, entry) {
  doc.font('Helvetica').fontSize(8.5);
  let h = 0;
  COLS.forEach((c) => {
    h = Math.max(h, doc.heightOfString(String(entry[c.key] || '') || ' ', { width: c.w - 8 }));
  });
  return Math.max(26, h + 10);
}

function drawRow(doc, y, h, entry, shade) {
  if (shade) doc.rect(LEFT, y, WIDTH, h).fill('#faf5ec');
  let x = LEFT;
  COLS.forEach((c) => {
    doc.lineWidth(0.5).strokeColor('#cfc6b8').rect(x, y, c.w, h).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor('#1a1a1a').text(String(entry[c.key] || ''), x + 4, y + 5, { width: c.w - 8 });
    x += c.w;
  });
}

function drawSignature(doc, y, report) {
  if (y > 660) {
    doc.addPage();
    y = 50;
  }
  y += 14;
  doc.lineWidth(0.6).strokeColor('#d8cdb9').moveTo(LEFT, y).lineTo(LEFT + WIDTH, y).stroke();
  y += 10;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(theme.colors.gray).text('SIGNATURE DU TECHNICIEN', LEFT, y, { lineBreak: false });
  doc.text('DATE', LEFT + 330, y, { lineBreak: false });
  y += 12;
  doc.lineWidth(0.8).strokeColor(theme.colors.steel).roundedRect(LEFT, y, 250, 72, 6).stroke();
  const sig = report.signature && /^data:image\/png;base64,/.test(report.signature) ? Buffer.from(report.signature.split(',')[1], 'base64') : null;
  if (sig) {
    try {
      doc.image(sig, LEFT + 8, y + 6, { fit: [234, 60], align: 'center', valign: 'center' });
    } catch (e) {
      /* signature illisible : cadre laissé vide */
    }
  }
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a1a').text(formatDate(report.dateRapport), LEFT + 330, y + 26, { lineBreak: false });
  return y + 80;
}

function drawPhotos(doc, photos) {
  photos.forEach((p, i) => {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(theme.colors.steel).text(`Photo du rapport papier (${i + 1}/${photos.length})`, LEFT, 40, { lineBreak: false });
    try {
      doc.image(p.data, LEFT, 62, { fit: [WIDTH, 700], align: 'center' });
    } catch (e) {
      doc.font('Helvetica').fontSize(9).fillColor(theme.colors.gray).text('Photo illisible.', LEFT, 70);
    }
  });
}

// Dessine une fiche complète (peut s'étendre sur plusieurs pages)
function drawReportSheet(doc, report, { departments = [], photos = [] } = {}) {
  let y = drawHeader(doc, report, departments);
  y = drawTableHeader(doc, y);
  const entries = report.entries || [];
  if (!entries.length) {
    doc.font('Helvetica').fontSize(9).fillColor(theme.colors.gray).text(photos.length || report.nbPhotos ? 'Rapport écrit joint en photo (voir pages suivantes).' : 'Aucune ligne dans cette fiche.', LEFT + 4, y + 8);
    y += 30;
  }
  entries.forEach((entry, i) => {
    const h = measureRow(doc, entry);
    if (y + h > PAGE_BOTTOM) {
      doc.addPage();
      y = drawTableHeader(doc, 40);
    }
    drawRow(doc, y, h, entry, i % 2 === 1);
    y += h;
  });
  drawSignature(doc, y, report);
  if (photos.length) drawPhotos(doc, photos);
}

// Pieds de page (à appeler une fois, avec bufferPages: true)
function drawFooters(doc, label) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(theme.colors.gray);
    doc.text(`${label} — généré le ${new Date().toLocaleString('fr-FR')} — Page ${i + 1}/${range.count}`, LEFT, 812, { width: WIDTH, align: 'center', lineBreak: false });
  }
}

module.exports = { drawReportSheet, drawFooters };
