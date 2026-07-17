const PDFDocument = require('pdfkit');
const { theme, formatDate, drawHeader, drawStamp, drawField, drawSignatures, drawFooter } = require('./pdfHelpers');

function urgenceColor(urgence) {
  if (urgence === 'Critique') return theme.colors.raspberry;
  if (urgence === 'Urgente') return theme.colors.yellow;
  return theme.colors.mint; // Normale
}

function generateOrderPDF(order, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `commande-${String(order._id)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  let y = drawHeader(doc, 'Bon de Commande - Pièces & Consommables', order._id);
  drawStamp(doc, order.urgence, urgenceColor(order.urgence));

  y += 25;
  const col1X = 50;
  const col2X = 300;
  const colWidth = 220;
  const rowHeight = 45;

  const fields = [
    ['Date de la commande', formatDate(order.createdAt)],
    ['Statut', order.statutCommande],
    ['Département', order.departement],
    ['Technicien demandeur', order.technicienNom],
    ['Désignation', order.designation],
    ['Référence', order.reference],
    ['Quantité', `${order.quantite} ${order.unite || ''}`.trim()],
    ['Date souhaitée', order.dateSouhaitee ? formatDate(order.dateSouhaitee) : 'Non précisée'],
  ];

  fields.forEach((f, i) => {
    const col = i % 2 === 0 ? col1X : col2X;
    const row = Math.floor(i / 2);
    drawField(doc, col, y + row * rowHeight, colWidth, f[0], f[1]);
  });

  y = y + Math.ceil(fields.length / 2) * rowHeight + 8;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E3D9CC').stroke();
  y += 15;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(theme.colors.gray).text('MOTIF / JUSTIFICATION', 50, y, { width: 495 });
  y += 14;
  doc.font('Helvetica').fontSize(10.5).fillColor('#1a1a1a').text(order.motif || '-', 50, y, { width: 495 });
  y += doc.heightOfString(order.motif || '-', { width: 495 }) + 18;

  if (order.noteResponsable) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(theme.colors.gray).text('NOTE DU RESPONSABLE', 50, y, { width: 495 });
    y += 14;
    doc.font('Helvetica').fontSize(10.5).fillColor('#1a1a1a').text(order.noteResponsable, 50, y, { width: 495 });
    y += doc.heightOfString(order.noteResponsable, { width: 495 }) + 18;
  }

  if (y > 640) {
    doc.addPage();
    y = 60;
  }

  y += 10;
  drawSignatures(doc, y, 'Technicien demandeur', 'Responsable maintenance');
  drawFooter(doc);

  doc.end();
}

module.exports = generateOrderPDF;
