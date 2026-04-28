/* eslint-disable */
// Design tokens — "Hodu" system. Friendly, consumer-grade, B2B-property metaphor.
window.AR_TOKENS = {
  // Type — single family with weight ladder for variety
  fontUI: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",

  // Neutrals — warm paper + ink (slight cream tint, not stark white)
  paper: "#FAF8F4",          // App background
  paperAlt: "#F4F1EA",       // Subtle band
  canvas: "#FFFFFF",         // Card / surface
  ink: "#0A0A0A",            // Primary text
  ink2: "#2C2C2E",           // Headlines
  graphite: "#46474C",       // Body / secondary
  slate: "#76767E",          // Tertiary / meta
  fog: "#A6A6AC",            // Disabled / placeholders
  hairline: "#E9E5DC",       // 1px dividers (warm)
  hairlineStrong: "#D9D3C5",
  surfaceMuted: "#F1ECE0",   // Tinted band

  // Accent — Cognac (호두/walnut). Warm, friendly, non-corporate.
  accent: "#D87242",          // ~oklch(64% 0.16 55)
  accentHover: "#BC5C30",
  accentSoft: "#FDEDE2",
  accentInk: "#5C2A12",
  accentDeep: "#923D1B",

  // Semantic
  success: "#1F9D55",
  successSoft: "#E5F5EC",
  warning: "#E0A019",
  warningSoft: "#FBF1D9",
  danger: "#D1372B",
  dangerSoft: "#FBE8E5",
  info: "#2F6FE0",
  infoSoft: "#E6EEFB",

  // Radii — friendly, larger
  r1: "8px",
  r2: "14px",
  r3: "20px",
  r4: "28px",

  shadowSm: "0 1px 0 0 rgba(10,10,10,0.04), 0 1px 2px 0 rgba(10,10,10,0.04)",
  shadowMd: "0 1px 0 0 rgba(10,10,10,0.04), 0 6px 20px -4px rgba(10,10,10,0.08)",
  shadowLg: "0 1px 0 0 rgba(10,10,10,0.04), 0 18px 40px -10px rgba(10,10,10,0.14)",
};

// Inject fonts once
(function injectFonts() {
  if (document.getElementById('ar-fonts')) return;
  const a = document.createElement('link');
  a.id = 'ar-fonts';
  a.rel = 'stylesheet';
  a.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css';
  document.head.appendChild(a);
  const b = document.createElement('link');
  b.rel = 'stylesheet';
  b.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(b);
})();

window.AR_applyTokens = function applyTokens(overrides = {}) {
  const t = { ...window.AR_TOKENS, ...overrides };
  const r = document.documentElement;
  Object.entries({
    paper: t.paper, 'paper-alt': t.paperAlt, canvas: t.canvas,
    ink: t.ink, ink2: t.ink2, graphite: t.graphite, slate: t.slate, fog: t.fog,
    hairline: t.hairline, 'hairline-strong': t.hairlineStrong, 'surface-muted': t.surfaceMuted,
    accent: t.accent, 'accent-hover': t.accentHover, 'accent-soft': t.accentSoft, 'accent-ink': t.accentInk, 'accent-deep': t.accentDeep,
    success: t.success, 'success-soft': t.successSoft,
    warning: t.warning, 'warning-soft': t.warningSoft,
    danger: t.danger, 'danger-soft': t.dangerSoft,
    info: t.info, 'info-soft': t.infoSoft,
    'font-ui': t.fontUI, 'font-mono': t.fontMono,
  }).forEach(([k, v]) => r.style.setProperty(`--ar-${k}`, v));
};
window.AR_applyTokens();
