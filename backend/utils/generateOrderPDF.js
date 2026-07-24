const PDFDocument = require('pdfkit');
const { theme, formatDate, drawHeader, drawStamp, drawField, drawSignatures, drawFooter } = require('./pdfHelpers');

function urgenceColor(urgence) {
  if (urgence === 'Critique') return theme.colors.raspberry;
  if (urgence === 'Urgente') return theme.colors.yellow;
  return theme.colors.mint;
}

function drawItem(doc, y, item, index) {
  if (y > 620) {
    doc.addPage();
    y = 60;
  }

  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E3D9CC').stroke();
  y += 12;

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(theme.colors.praline).text(`Article ${index + 1} — ${item.designation}`, 50, y, { width: 380 });
  drawStamp(doc, item.urgence, urgenceColor(item.urgence), 400, y - 4, 145);
  y += 18;

  doc.font('Helvetica').fontSize(9).fillColor(theme.colors.gray)
    .text(`Quantité : ${item.quantite} ${item.unite || ''}    Statut : ${item.statutCommande}    Réf. : ${item.reference || '-'}`, 50, y, { width: 495 });
  y += 16;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(theme.colors.gray).text('MOTIF / JUSTIFICATION', 50, y);
  y += 12;
  doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(item.motif || '-', 50, y, { width: 495 });
  y += doc.heightOfString(item.motif || '-', { width: 495 }) + 10;

  if (item.noteResponsable) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(theme.colors.gray).text('NOTE DU RESPONSABLE', 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(item.noteResponsable, 50, y, { width: 495 });
    y += doc.heightOfString(item.noteResponsable, { width: 495 }) + 10;
  }

  return y + 6;
}

function generateOrderPDF(order, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `commande-${String(order._id)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  let y = drawHeader(doc, 'Bon de Commande - Pièces & Consommables', order._id);
  y += 20;

  const col1X = 50;
  const col2X = 300;
  const colWidth = 220;
  const rowHeight = 40;

  const fields = [
    ['Date de la commande', formatDate(order.dateCommande)],
    ['Département', order.departement],
    ['Technicien demandeur', order.technicienNom],
    ['Nombre d\u2019articles', String(order.items.length)],
  ];

  fields.forEach((f, i) => {
    const col = i % 2 === 0 ? col1X : col2X;
    const row = Math.floor(i / 2);
    drawField(doc, col, y + row * rowHeight, colWidth, f[0], f[1]);
  });

  y += Math.ceil(fields.length / 2) * rowHeight + 10;

  if (!order.items.length) {
    doc.font('Helvetica').fontSize(10).fillColor(theme.colors.gray).text('Aucun article sur cette commande.', 50, y);
  } else {
    order.items.forEach((item, i) => {
      y = drawItem(doc, y, item, i);
    });
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
