import { COLORS, buildResults, fmtPct } from './results';

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

async function loadLogo() {
  try {
    const res = await fetch('/logo-sman55.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const size = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, ...size };
  } catch {
    return null;
  }
}

// Irisan lingkaran digambar sebagai poligon vektor agar tajam di PDF.
function drawSlice(doc, cx, cy, r, from, to, rgb) {
  const steps = Math.max(2, Math.ceil(((to - from) / (Math.PI * 2)) * 90));
  const pts = [[cx, cy]];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const deltas = [];
  for (let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  deltas.push([pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]]);
  doc.setFillColor(...rgb);
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'FD', true);
}

export async function exportResultsPdf(stats) {
  const [{ jsPDF }, autoTableModule, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ]);
  const autoTable = [autoTableModule.default?.default, autoTableModule.default, autoTableModule.autoTable]
    .find((fn) => typeof fn === 'function');
  const { rows, totalVotes } = buildResults(stats);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  let y = 14;

  // Kop
  let textX = M;
  if (logo) {
    const lh = 20;
    const lw = (logo.w / logo.h) * lh;
    doc.addImage(logo.dataUrl, 'PNG', M, y - 2, lw, lh);
    textX = M + lw + 5;
  }
  doc.setTextColor(40, 30, 25);
  doc.setFont('helvetica', 'bold').setFontSize(17);
  doc.text('Hasil Pemilihan Ketua OSIS', textX, y + 5);
  doc.setFont('helvetica', 'normal').setFontSize(11);
  doc.text('SMA Negeri 55 Jakarta', textX, y + 11);
  doc.setFontSize(9).setTextColor(110, 100, 95);
  const printed = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
  doc.text(`Dicetak: ${printed} WIB`, textX, y + 16);
  y += 26;
  doc.setDrawColor(178, 69, 14).setLineWidth(0.6).line(M, y, W - M, y);
  y += 7;

  // Ringkasan partisipasi
  const participation = stats.total ? (stats.voted / stats.total) * 100 : 0;
  const boxes = [
    ['Pemilih terdaftar', String(stats.total)],
    ['Sudah memilih', String(stats.voted)],
    ['Partisipasi', fmtPct(participation)],
    ['Terblokir', String(stats.blocked)],
  ];
  const gap = 4;
  const bw = (W - 2 * M - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value], i) => {
    const x = M + i * (bw + gap);
    doc.setFillColor(251, 244, 235).setDrawColor(230, 215, 195).setLineWidth(0.3);
    doc.roundedRect(x, y, bw, 19, 2, 2, 'FD');
    doc.setTextColor(178, 69, 14).setFont('helvetica', 'bold').setFontSize(16);
    doc.text(value, x + bw / 2, y + 9, { align: 'center' });
    doc.setTextColor(90, 80, 75).setFont('helvetica', 'normal').setFontSize(8.5);
    doc.text(label, x + bw / 2, y + 15, { align: 'center' });
  });
  y += 27;

  // Diagram batang
  doc.setTextColor(40, 30, 25).setFont('helvetica', 'bold').setFontSize(12);
  doc.text('Perolehan suara per kandidat', M, y);
  y += 6;
  const labelW = 58;
  const barX = M + labelW + 2;
  const barMax = W - M - barX - 40; // sisakan ruang untuk teks angka
  const maxVotes = Math.max(1, ...rows.map((r) => r.votes));
  rows.forEach((r, i) => {
    const lines = doc.splitTextToSize(`${r.number}. ${r.name}`, labelW).slice(0, 2);
    const rowH = 13;
    if (y + rowH > H - 20) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(40, 30, 25);
    doc.text(lines, M, y + 5.5 - (lines.length - 1) * 2);
    const len = (r.votes / maxVotes) * barMax;
    doc.setFillColor(...hexToRgb(COLORS[i % COLORS.length]));
    if (len > 0) doc.roundedRect(barX, y, Math.max(len, 1.5), 8.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9.5);
    doc.text(`${r.votes} suara (${fmtPct(r.percent)})`, barX + Math.max(len, 1.5) + 2.5, y + 5.7);
    y += rowH;
  });
  y += 4;

  // Diagram lingkaran
  const pieR = 26;
  const legendRows = Math.max(rows.length, 1);
  const pieBlock = Math.max(pieR * 2 + 10, legendRows * 7 + 14);
  if (y + pieBlock > H - 20) { doc.addPage(); y = 18; }
  doc.setTextColor(40, 30, 25).setFont('helvetica', 'bold').setFontSize(12);
  doc.text('Persentase suara', M, y);
  y += 5;
  const cx = M + pieR + 4;
  const cy = y + pieR + 2;
  if (totalVotes === 0) {
    doc.setFillColor(225, 220, 215).circle(cx, cy, pieR, 'F');
  } else if (rows.filter((r) => r.votes > 0).length === 1) {
    const idx = rows.findIndex((r) => r.votes > 0);
    doc.setFillColor(...hexToRgb(COLORS[idx % COLORS.length])).circle(cx, cy, pieR, 'F');
  } else {
    let angle = -Math.PI / 2;
    rows.forEach((r, i) => {
      if (!r.votes) return;
      const sweep = (r.votes / totalVotes) * Math.PI * 2;
      drawSlice(doc, cx, cy, pieR, angle, angle + sweep, hexToRgb(COLORS[i % COLORS.length]));
      angle += sweep;
    });
  }
  doc.setFillColor(255, 255, 255).circle(cx, cy, pieR * 0.45, 'F'); // lubang donat
  doc.setTextColor(40, 30, 25).setFont('helvetica', 'bold').setFontSize(13);
  doc.text(String(totalVotes), cx, cy + 1, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(100, 90, 85);
  doc.text('total suara', cx, cy + 5, { align: 'center' });

  let ly = y + 4;
  const lx = cx + pieR + 14;
  rows.forEach((r, i) => {
    doc.setFillColor(...hexToRgb(COLORS[i % COLORS.length])).roundedRect(lx, ly - 3.2, 4.5, 4.5, 1, 1, 'F');
    doc.setTextColor(40, 30, 25).setFont('helvetica', 'normal').setFontSize(9.5);
    const name = doc.splitTextToSize(`${r.number}. ${r.name}`, W - M - lx - 50)[0];
    doc.text(name, lx + 7, ly);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fmtPct(r.percent)}  (${r.votes})`, W - M, ly, { align: 'right' });
    ly += 7;
  });
  y += pieBlock;

  // Tabel rekap
  if (y + 30 > H - 20) { doc.addPage(); y = 18; }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 18 },
    head: [['No. Urut', 'Nama Kandidat', 'Jumlah Suara', 'Persentase']],
    body: [
      ...rows.map((r) => [r.number, r.name, r.votes, fmtPct(r.percent)]),
    ],
    foot: [[
      '',
      'Total suara masuk',
      { content: String(totalVotes), styles: { halign: 'right' } },
      { content: totalVotes ? '100,0%' : '0,0%', styles: { halign: 'right' } },
    ]],
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.6, textColor: [40, 30, 25] },
    headStyles: { fillColor: [178, 69, 14], textColor: 255 },
    footStyles: { fillColor: [251, 244, 235], textColor: [40, 30, 25], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 34 },
      3: { halign: 'right', cellWidth: 32 },
    },
    showFoot: 'lastPage',
  });
  y = doc.lastAutoTable.finalY + 6;

  // Catatan pemenang / seri
  const top = rows.length ? Math.max(...rows.map((r) => r.votes)) : 0;
  const leaders = rows.filter((r) => r.votes === top);
  if (y + 14 > H - 18) { doc.addPage(); y = 18; }
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(40, 30, 25);
  if (totalVotes === 0) doc.text('Belum ada suara yang masuk.', M, y);
  else if (leaders.length === 1) {
    const l = leaders[0];
    doc.text(`Perolehan suara terbanyak: ${l.number}. ${l.name} dengan ${l.votes} suara (${fmtPct(l.percent)}).`, M, y);
  } else {
    doc.text(`Perolehan suara seri antara: ${leaders.map((l) => `${l.number}. ${l.name}`).join(', ')} (masing-masing ${top} suara).`, M, y, { maxWidth: W - 2 * M });
  }

  // Footer tiap halaman
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(130, 120, 115);
    doc.text('Persentase dihitung dari total suara yang masuk. Dokumen ini hanya memuat jumlah suara per kandidat, tanpa data siapa memilih siapa.', M, H - 10, { maxWidth: W - 2 * M - 22 });
    doc.text(`Halaman ${p} dari ${pages}`, W - M, H - 10, { align: 'right' });
  }

  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  doc.save(`hasil-pemilihan-osis-${stamp}.pdf`);
}
