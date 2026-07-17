const PDFDocument = require('pdfkit');
const { theme, formatDate, drawHeader, drawStamp, drawField, drawFooter } = require('./pdfHelpers');

function statusColor(statut) {
  if (statut === 'Résolue') return theme.colors.mint;
  if (statut === 'En cours') return theme.colors.yellow;
  return theme.colors.raspberry;
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

    let y = drawHeader(doc, 'Rapport Journalier de Maintenance', report._id);
    drawStamp(doc, report.statutPanne, statusColor(report.statutPanne));
    y += 25;

    const col1X = 50;
    const col2X = 300;
    const colWidth = 220;
    const rowHeight = 45;

    const fields = [
      ['Date du rapport', formatDate(report.dateRapport)],
      ['Horaire de travail', report.horaire],
      ['Département', report.departement],
      ['Responsable de département', report.responsableDepartement],
      ['Technicien', report.technicienNom],
      ['Machine concernée', report.machineConcernee],
      ['Heure de début', report.heureDebut],
      ['Heure de fin', report.heureFin],
    ];

    fields.forEach((f, i) => {
      const col = i % 2 === 0 ? col1X : col2X;
      const row = Math.floor(i / 2);
      drawField(doc, col, y + row * rowHeight, colWidth, f[0], f[1]);
    });

    y = y + Math.ceil(fields.length / 2) * rowHeight + 8;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E3D9CC').stroke();
    y += 15;

    const drawBlock = (label, value) => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(theme.colors.gray).text(label.toUpperCase(), 50, y, { width: 495 });
      y += 14;
      doc.font('Helvetica').fontSize(10.5).fillColor('#1a1a1a').text(value || '-', 50, y, { width: 495 });
      y += doc.heightOfString(value || '-', { width: 495 }) + 18;
    };

    drawBlock('Description de la panne', report.descriptionPanne);
    drawBlock('Action menée', report.actionMenee);
    if (report.observations) drawBlock('Observations', report.observations);

    drawFooter(doc);
  });

  doc.end();
}

module.exports = generateReportsBulkPDF;
