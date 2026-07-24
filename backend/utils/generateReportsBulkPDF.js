const PDFDocument = require('pdfkit');
const { theme, formatDate, drawHeader, drawStamp, drawField, drawFooter } = require('./pdfHelpers');

function statusColor(statut) {
  if (statut === 'Résolue') return theme.colors.mint;
  if (statut === 'En cours') return theme.colors.yellow;
  return theme.colors.raspberry;
}

function drawSheetHeader(doc, report) {
  let y = drawHeader(doc, 'Rapport Journalier de Maintenance', report._id);
  y += 20;

  const col1X = 50;
  const col2X = 300;
  const colWidth = 220;
  const rowHeight = 40;

  const fields = [
    ['Date du rapport', formatDate(report.dateRapport)],
    ['Horaire de travail', report.horaire],
    ['Département', report.departement],
    ['Responsable de département', report.responsableDepartement],
    ['Technicien', report.technicienNom],
    ['Nombre de pannes déclarées', String(report.entries.length)],
  ];

  fields.forEach((f, i) => {
    const col = i % 2 === 0 ? col1X : col2X;
    const row = Math.floor(i / 2);
    drawField(doc, col, y + row * rowHeight, colWidth, f[0], f[1]);
  });

  return y + Math.ceil(fields.length / 2) * rowHeight + 10;
}

function drawEntry(doc, y, entry, index) {
  if (y > 640) {
    doc.addPage();
    y = 60;
  }

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E3D9CC').stroke();
  y += 12;

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(theme.colors.praline).text(`Panne ${index + 1} — ${entry.machineConcernee}`, 50, y, { width: 380 });
  drawStamp(doc, entry.statutPanne, statusColor(entry.statutPanne), 400, y - 4, 145);
  y += 18;

  doc.font('Helvetica').fontSize(9).fillColor(theme.colors.gray).text(`Heure de début : ${entry.heureDebut}    Heure de fin : ${entry.heureFin}`, 50, y);
  y += 16;

  const drawBlock = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(theme.colors.gray).text(label.toUpperCase(), 50, y, { width: 495 });
    y += 12;
    doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(value || '-', 50, y, { width: 495 });
    y += doc.heightOfString(value || '-', { width: 495 }) + 12;
  };

  drawBlock('Description de la panne', entry.descriptionPanne);
  drawBlock('Action menée', entry.actionMenee);
  if (entry.observations) drawBlock('Observations', entry.observations);

  return y + 6;
}

function generateReportsBulkPDF(reports, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapports-${Date.now()}.pdf"`);
  doc.pipe(res);

  if (!reports.length) {
    drawHeader(doc, 'Rapports Journaliers de Maintenance');
    doc.font('Helvetica').fontSize(11).fillColor(theme.colors.gray)
      .text('Aucun rapport ne correspond aux filtres sélectionnés.', 50, 160);
    drawFooter(doc);
    doc.end();
    return;
  }

  reports.forEach((report, idx) => {
    if (idx > 0) doc.addPage();

    let y = drawSheetHeader(doc, report);

    if (!report.entries.length) {
      doc.font('Helvetica').fontSize(10).fillColor(theme.colors.gray).text('Aucune panne enregistrée sur cette fiche.', 50, y);
    } else {
      report.entries.forEach((entry, i) => {
        y = drawEntry(doc, y, entry, i);
      });
    }

    drawFooter(doc);
  });

  doc.end();
}

module.exports = generateReportsBulkPDF;
