export const COLORS = ['#b2450e', '#f2b04a', '#8b2a3a', '#c87812', '#f77d1e', '#68625d'];

export const fmtPct = (value) => value.toFixed(1).replace('.', ',') + '%';

// Menambahkan persentase (dari total suara masuk) ke tiap kandidat.
export function buildResults(stats) {
  const results = stats?.results || [];
  const totalVotes = results.reduce((sum, r) => sum + Number(r.votes || 0), 0);
  const rows = results.map((r) => {
    const votes = Number(r.votes || 0);
    return { ...r, votes, percent: totalVotes ? (votes / totalVotes) * 100 : 0 };
  });
  return { rows, totalVotes };
}
