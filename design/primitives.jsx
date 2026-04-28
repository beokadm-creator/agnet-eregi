/* eslint-disable */

const Ic = {
  search: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>,
  bell: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  plus: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  arrow: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  check: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  doc: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>,
  upload: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
  user: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  shield: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  layers: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>,
  card: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  bolt: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  alert: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>,
  chev: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>,
  flag: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 22V4a1 1 0 0 1 1-1h13l-3 5 3 5H5"/></svg>,
  inbox: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  building: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 13v.01M9 17v.01"/></svg>,
  star: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0" {...p}><path d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
  pin: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  chat: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  filter: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M6 12h12M10 18h4"/></svg>,
  more: (p={}) => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>,
  download: (p={}) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
};
window.Ic = Ic;

// Friendly walnut/acorn logo mark — simple geometry, not detailed SVG
const ARLogo = ({ size = 28, mono }) => {
  const s = size;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: s, height: s }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '52% 52% 50% 50% / 60% 60% 40% 40%',
          background: mono ? 'var(--ar-ink)' : 'var(--ar-accent)'
        }} />
        <div style={{
          position: 'absolute', top: 0, left: '8%', right: '8%', height: '34%',
          borderRadius: '50% 50% 40% 40%',
          background: mono ? '#000' : 'var(--ar-accent-deep)'
        }} />
      </div>
      <span style={{ fontFamily: 'var(--ar-font-ui)', fontWeight: 800, fontSize: s * 0.65, letterSpacing: '-0.025em', color: 'var(--ar-ink)' }}>
        AgentRegi
      </span>
    </div>
  );
};
window.ARLogo = ARLogo;

// Stat tile for dashboards
const StatTile = ({ label, value, delta, hint, accent }) => (
  <div className="ar-card" style={{ padding: 22 }}>
    <div style={{ fontSize: 13, color: 'var(--ar-slate)', fontWeight: 500 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
      <div className="ar-tabular" style={{ fontSize: 32, fontWeight: 700, color: accent ? 'var(--ar-accent)' : 'var(--ar-ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {delta != null && (
        <div className="ar-tabular" style={{
          fontSize: 12, fontWeight: 700,
          color: delta >= 0 ? 'var(--ar-success)' : 'var(--ar-danger)'
        }}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%</div>
      )}
    </div>
    {hint && <div style={{ fontSize: 12, color: 'var(--ar-slate)', marginTop: 8 }}>{hint}</div>}
  </div>
);
window.StatTile = StatTile;

// Tiny avatar
const Avatar = ({ name, size = 32, hue = 0 }) => {
  const init = (name || '?').slice(0, 1);
  const bg = `oklch(85% 0.04 ${hue})`;
  const fg = `oklch(35% 0.10 ${hue})`;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'grid', placeItems: 'center', fontSize: size * 0.42, fontWeight: 700 }}>{init}</div>;
};
window.Avatar = Avatar;

// Bar chart (small)
const Bars = ({ data, height = 80, color = 'var(--ar-accent)' }) => {
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, background: color, borderRadius: '4px 4px 2px 2px', opacity: i === data.length - 1 ? 1 : 0.7 }} />
      ))}
    </div>
  );
};
window.Bars = Bars;

// Sparkline
const Spark = ({ data, color = 'var(--ar-accent)', height = 36, width = 120 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (data.length - 1)) * width} ${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
window.Spark = Spark;
