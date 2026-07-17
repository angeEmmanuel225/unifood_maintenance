const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel } = require('docx');
const { theme, formatDate } = require('./pdfHelpers');

function fieldRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { fill: 'F5EDE1' },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, color: '6B3F2A' })] })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: value ? String(value) : '-', size: 20 })] })],
      }),
    ],
  });
}

async function generateOrderWordBuffer(order) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: theme.companyName, bold: true, size: 32, color: '2B2E33' })],
          }),
          new Paragraph({
            children: [new TextRun({ text: theme.companySubtitle, italics: true, size: 18, color: '6b7280' })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Bon de commande — Pièces & consommables', bold: true, color: 'C9722A' })],
            spacing: { after: 250 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              fieldRow('Référence', String(order._id)),
              fieldRow('Date de la commande', formatDate(order.createdAt)),
              fieldRow('Statut', order.statutCommande),
              fieldRow('Département', order.departement),
              fieldRow('Technicien demandeur', order.technicienNom),
              fieldRow('Désignation', order.designation),
              fieldRow('Référence pièce', order.reference || '-'),
              fieldRow('Quantité', `${order.quantite} ${order.unite || ''}`.trim()),
              fieldRow('Urgence', order.urgence),
              fieldRow('Date souhaitée', order.dateSouhaitee ? formatDate(order.dateSouhaitee) : 'Non précisée'),
              fieldRow('Motif / justification', order.motif),
              ...(order.noteResponsable ? [fieldRow('Note du responsable', order.noteResponsable)] : []),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 400 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Document généré le ${new Date().toLocaleString('fr-FR')}`,
                italics: true,
                size: 16,
                color: '6b7280',
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = generateOrderWordBuffer;
