const PDFDocument = require('pdfkit');
const { theme } = require('./pdfHelpers');
const { drawReportSheet, drawFooters } = require('./reportSheetRenderer');

function generateReportsBulkPDF(reports, res, { departments = [], photosByReport = new Map() } = {}) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapports-${Date.now()}.pdf"`);
  doc.pipe(res);
  if (!reports.length) {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(theme.colors.steel).text('UNIFOOD TOGO — Rapports journaliers', 40, 60);
    doc.font('Helvetica').fontSize(11).fillColor(theme.colors.gray).text('Aucun rapport ne correspond aux filtres sélectionnés.', 40, 90);
  }
  reports.forEach((report, idx) => {
    if (idx > 0) doc.addPage();
    drawReportSheet(doc, report, { departments, photos: photosByReport.get(String(report._id)) || [] });
  });
  drawFooters(doc, 'UNIFOOD TOGO — Rapports journaliers');
  doc.end();
}

module.exports = generateReportsBulkPDF;
