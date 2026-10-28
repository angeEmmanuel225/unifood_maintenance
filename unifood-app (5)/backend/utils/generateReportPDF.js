const PDFDocument = require('pdfkit');
const { drawReportSheet, drawFooters } = require('./reportSheetRenderer');

function generateReportPDF(report, res, { departments = [], photos = [] } = {}) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-${String(report._id)}.pdf"`);
  doc.pipe(res);
  drawReportSheet(doc, report, { departments, photos });
  drawFooters(doc, 'UNIFOOD TOGO — Rapport journalier');
  doc.end();
}

module.exports = generateReportPDF;
