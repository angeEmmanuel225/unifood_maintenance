const theme = {
  colors: {
    steel: '#2B2E33',
    caramel: '#C9722A',
    praline: '#6B3F2A',
    cream: '#FBF3E7',
    raspberry: '#D6335C',
    yellow: '#B9860A',
    mint: '#2F8F57',
    gray: '#6b7280',
  },
  companyName: process.env.COMPANY_NAME || 'UNIFOOD TOGO',
  companySubtitle: process.env.COMPANY_SUBTITLE || 'Usine de fabrication de bonbons - Confiserie',
};

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function drawHeader(doc, title, reference) {
  const { colors, companyName, companySubtitle } = theme;
  doc.rect(0, 0, doc.page.width, 90).fill(colors.steel);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(companyName, 50, 24);
  doc.font('Helvetica').fontSize(9).fillColor('#D8D8D8').text(companySubtitle, 50, 46);
  doc.rect(0, 90, doc.page.width, 6).fill(colors.caramel);

  doc.fillColor(colors.steel).font('Helvetica-Bold').fontSize(15).text(title, 50, 112);

  if (reference) {
    doc.font('Helvetica').fontSize(9).fillColor(colors.gray).text(`Réf. ${reference}`, 50, 132);
  }

  return 150;
}

function drawStamp(doc, text, color, x = 400, y = 105, width = 145) {
  doc.roundedRect(x, y, width, 26, 13).lineWidth(1.5).strokeColor(color).stroke();
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(color)
    .text(String(text || '').toUpperCase(), x, y + 8, { width, align: 'center' });
}

function drawField(doc, x, y, width, label, value) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(theme.colors.gray).text(label.toUpperCase(), x, y, { width });
  doc.font('Helvetica').fontSize(11).fillColor('#1a1a1a').text(value === undefined || value === null || value === '' ? '-' : String(value), x, y + 13, { width });
}

function drawSignatures(doc, y, leftLabel = 'Technicien', rightLabel = 'Responsable de département') {
  const { colors } = theme;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#E3D9CC').stroke();
  doc.fontSize(9).fillColor(colors.gray).text('Signatures', 50, y + 10);

  const colWidth = 220;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(colors.steel)
    .text(leftLabel, 50, y + 35)
    .text(rightLabel, 545 - colWidth, y + 35, { width: colWidth, align: 'right' });

  doc.moveTo(50, y + 75).lineTo(50 + colWidth, y + 75).strokeColor('#B8B8B8').stroke();
  doc.moveTo(545 - colWidth, y + 75).lineTo(545, y + 75).strokeColor('#B8B8B8').stroke();
}

function drawFooter(doc) {
  doc
    .fontSize(8)
    .fillColor(theme.colors.gray)
    .text(`Document généré le ${new Date().toLocaleString('fr-FR')} — ${theme.companyName}`, 50, 770, {
      width: 495,
      align: 'center',
    });
}

module.exports = { theme, formatDate, drawHeader, drawStamp, drawField, drawSignatures, drawFooter };
