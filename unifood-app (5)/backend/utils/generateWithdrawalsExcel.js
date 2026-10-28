const ExcelJS = require('exceljs');
const { theme } = require('./pdfHelpers');

async function generateWithdrawalsExcelBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = theme.companyName;
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Sorties magasin');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Technicien', key: 'technicien', width: 24 },
    { header: 'Département', key: 'departement', width: 32 },
    { header: 'Pièce (désignation)', key: 'designation', width: 32 },
    { header: 'Référence', key: 'reference', width: 16 },
    { header: 'Quantité', key: 'quantite', width: 10 },
    { header: 'Unité', key: 'unite', width: 10 },
    { header: 'Machine / destination', key: 'machine', width: 26 },
    { header: 'Note', key: 'note', width: 30 },
    { header: 'Statut', key: 'statut', width: 10 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2E33' } };

  rows.forEach((r) => {
    sheet.addRow({
      ...r,
      date: new Date(r.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
      reference: r.reference || '-',
      machine: r.machine || '-',
      note: r.note || '',
    });
  });
  sheet.autoFilter = { from: 'A1', to: 'J1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
}

module.exports = { generateWithdrawalsExcelBuffer };
