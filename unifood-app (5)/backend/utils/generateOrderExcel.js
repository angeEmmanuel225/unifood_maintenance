const ExcelJS = require('exceljs');
const { theme, formatDate } = require('./pdfHelpers');

async function generateOrderExcelBuffer(order) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = theme.companyName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Commande');
  sheet.columns = [
    { header: 'Champ', key: 'label', width: 28 },
    { header: 'Valeur', key: 'value', width: 55 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2E33' } };

  const rows = [
    ['Référence', String(order._id)],
    ['Date de la commande', formatDate(order.createdAt)],
    ['Statut', order.statutCommande],
    ['Département', order.departement],
    ['Technicien demandeur', order.technicienNom],
    ['Désignation', order.designation],
    ['Référence pièce', order.reference || '-'],
    ['Quantité', order.quantite],
    ['Unité', order.unite],
    ['Urgence', order.urgence],
    ['Date souhaitée', order.dateSouhaitee ? formatDate(order.dateSouhaitee) : 'Non précisée'],
    ['Motif / justification', order.motif],
    ['Note du responsable', order.noteResponsable || '-'],
  ];

  rows.forEach((r) => sheet.addRow({ label: r[0], value: r[1] }));
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.getCell(1).font = { bold: true, color: { argb: 'FF6B3F2A' } };
    row.alignment = { vertical: 'top', wrapText: true };
  });

  return workbook.xlsx.writeBuffer();
}

async function generateOrdersListExcelBuffer(orders) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = theme.companyName;
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Commandes');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Département', key: 'departement', width: 20 },
    { header: 'Technicien', key: 'technicien', width: 22 },
    { header: 'Désignation', key: 'designation', width: 28 },
    { header: 'Référence', key: 'reference', width: 16 },
    { header: 'Quantité', key: 'quantite', width: 10 },
    { header: 'Unité', key: 'unite', width: 10 },
    { header: 'Urgence', key: 'urgence', width: 12 },
    { header: 'Statut', key: 'statut', width: 14 },
    { header: 'Motif', key: 'motif', width: 40 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2E33' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };

  orders.forEach((o) => {
    sheet.addRow({
      date: formatDate(o.createdAt),
      departement: o.departement,
      technicien: o.technicienNom,
      designation: o.designation,
      reference: o.reference || '-',
      quantite: o.quantite,
      unite: o.unite,
      urgence: o.urgence,
      statut: o.statutCommande,
      motif: o.motif,
    });
  });

  sheet.autoFilter = { from: 'A1', to: 'J1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateOrderExcelBuffer, generateOrdersListExcelBuffer };
