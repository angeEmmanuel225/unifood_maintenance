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
  const children = [
    new Paragraph({ children: [new TextRun({ text: theme.companyName, bold: true, size: 32, color: '2B2E33' })] }),
    new Paragraph({
      children: [new TextRun({ text: theme.companySubtitle, italics: true, size: 18, color: '6b7280' })],
      spacing: { after: 300 },
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Bon de commande — Pièces & consommables', bold: true, color: 'C9722A' })],
      spacing: { after: 150 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        fieldRow('Référence fiche', String(order._id)),
        fieldRow('Date de la commande', formatDate(order.dateCommande)),
        fieldRow('Département', order.departement),
        fieldRow('Technicien demandeur', order.technicienNom),
        fieldRow("Nombre d'articles", String(order.items.length)),
      ],
    }),
  ];

  order.items.forEach((item, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: `Article ${i + 1} — ${item.designation}`, bold: true, color: '6B3F2A' })],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          fieldRow('Référence pièce', item.reference || '-'),
          fieldRow('Quantité', `${item.quantite} ${item.unite || ''}`.trim()),
          fieldRow('Urgence', item.urgence),
          fieldRow('Statut', item.statutCommande),
          fieldRow('Date souhaitée', item.dateSouhaitee ? formatDate(item.dateSouhaitee) : 'Non précisée'),
          fieldRow('Motif / justification', item.motif),
          ...(item.noteResponsable ? [fieldRow('Note du responsable', item.noteResponsable)] : []),
        ],
      })
    );
  });

  children.push(
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: `Document généré le ${new Date().toLocaleString('fr-FR')}`, italics: true, size: 16, color: '6b7280' })],
    })
  );

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}

module.exports = generateOrderWordBuffer;
