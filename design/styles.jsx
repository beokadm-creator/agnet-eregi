/* eslint-disable */
(function injectStyles() {
  const old = document.getElementById('ar-styles');
  if (old) old.remove();
  const css = `
    .ar-root { font-family: var(--ar-font-ui); color: var(--ar-ink); -webkit-font-smoothing: antialiased; }
    .ar-mono { font-family: var(--ar-font-mono); }

    /* Surfaces */
    .ar-paper { background: var(--ar-paper); }
    .ar-canvas { background: var(--ar-canvas); }
    .ar-muted { background: var(--ar-surface-muted); }
    .ar-card { background: var(--ar-canvas); border: 1px solid var(--ar-hairline); border-radius: 16px; }
    .ar-card-soft { background: var(--ar-canvas); border-radius: 16px; box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 8px 24px -8px rgba(10,10,10,0.06); }
    .ar-divider { height: 1px; background: var(--ar-hairline); }

    /* Buttons - Toss-style: rounded, weighty */
    .ar-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 12px; font-family: var(--ar-font-ui); font-size: 15px; font-weight: 600; line-height: 1; cursor: pointer; transition: all 0.12s ease; border: 1px solid transparent; white-space: nowrap; }
    .ar-btn-accent { background: var(--ar-accent); color: white; }
    .ar-btn-accent:hover { background: var(--ar-accent-hover); }
    .ar-btn-ink { background: var(--ar-ink); color: white; }
    .ar-btn-ink:hover { background: #1a1a1a; }
    .ar-btn-ghost { background: var(--ar-canvas); color: var(--ar-ink); border-color: var(--ar-hairline-strong); }
    .ar-btn-ghost:hover { background: var(--ar-paper-alt); }
    .ar-btn-quiet { background: transparent; color: var(--ar-graphite); }
    .ar-btn-quiet:hover { color: var(--ar-ink); background: var(--ar-paper-alt); }
    .ar-btn-soft { background: var(--ar-accent-soft); color: var(--ar-accent-ink); }
    .ar-btn-soft:hover { background: color-mix(in oklab, var(--ar-accent-soft), var(--ar-accent) 6%); }
    .ar-btn-sm { height: 34px; padding: 0 12px; font-size: 13px; border-radius: 9px; }
    .ar-btn-lg { height: 56px; padding: 0 24px; font-size: 17px; border-radius: 14px; }
    .ar-btn-xl { height: 64px; padding: 0 28px; font-size: 18px; border-radius: 16px; font-weight: 700; }

    /* Inputs */
    .ar-input { width: 100%; height: 48px; padding: 0 16px; background: var(--ar-canvas); border: 1.5px solid var(--ar-hairline-strong); border-radius: 12px; font-family: inherit; font-size: 15px; color: var(--ar-ink); transition: all 0.12s ease; outline: none; }
    .ar-input:focus { border-color: var(--ar-accent); }
    .ar-input::placeholder { color: var(--ar-fog); }
    .ar-input-sm { height: 36px; font-size: 13px; border-radius: 9px; padding: 0 12px; }

    /* Labels */
    .ar-label { font-size: 13px; font-weight: 600; color: var(--ar-graphite); }
    .ar-eyebrow { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ar-slate); font-weight: 700; }

    /* Badges */
    .ar-badge { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .ar-badge-dot { width: 6px; height: 6px; border-radius: 50%; }
    .ar-badge-neutral { background: var(--ar-surface-muted); color: var(--ar-graphite); }
    .ar-badge-accent { background: var(--ar-accent-soft); color: var(--ar-accent-ink); }
    .ar-badge-success { background: var(--ar-success-soft); color: var(--ar-success); }
    .ar-badge-warning { background: var(--ar-warning-soft); color: oklch(45% 0.13 75); }
    .ar-badge-danger { background: var(--ar-danger-soft); color: var(--ar-danger); }
    .ar-badge-info { background: var(--ar-info-soft); color: var(--ar-info); }
    .ar-badge-square { border-radius: 6px; height: 24px; }

    /* Tables */
    .ar-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .ar-table th { text-align: left; font-weight: 600; font-size: 12px; color: var(--ar-slate); padding: 14px 16px; border-bottom: 1px solid var(--ar-hairline); background: var(--ar-paper); }
    .ar-table td { padding: 16px; border-bottom: 1px solid var(--ar-hairline); color: var(--ar-graphite); vertical-align: middle; }
    .ar-table tbody tr:hover { background: var(--ar-paper); }
    .ar-table td.ink { color: var(--ar-ink); font-weight: 600; }

    /* Sidebar */
    .ar-nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; font-size: 14px; font-weight: 500; color: var(--ar-graphite); cursor: pointer; }
    .ar-nav-item:hover { background: var(--ar-paper-alt); color: var(--ar-ink); }
    .ar-nav-item.active { background: var(--ar-ink); color: white; }
    .ar-nav-section { font-size: 11px; letter-spacing: 0.10em; text-transform: uppercase; color: var(--ar-slate); padding: 18px 14px 8px; font-weight: 700; }

    /* Tabular */
    .ar-tabular { font-variant-numeric: tabular-nums; }

    /* Chip selectable (for funnel) */
    .ar-chip { display: inline-flex; align-items: center; gap: 8px; height: 52px; padding: 0 20px; border-radius: 14px; background: var(--ar-canvas); border: 1.5px solid var(--ar-hairline-strong); font-size: 15px; font-weight: 600; color: var(--ar-ink2); cursor: pointer; transition: all 0.12s ease; }
    .ar-chip:hover { border-color: var(--ar-ink); }
    .ar-chip.selected { background: var(--ar-ink); color: white; border-color: var(--ar-ink); }

    /* Decorative noise overlay (reusable) */
    .ar-grain { position: relative; }
    .ar-grain::after { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>"); opacity: 0.4; mix-blend-mode: multiply; pointer-events: none; border-radius: inherit; }

    /* Placeholder image */
    .ar-photo { background: linear-gradient(135deg, var(--ar-paper-alt), var(--ar-surface-muted)); display: flex; align-items: center; justify-content: center; color: var(--ar-slate); font-family: var(--ar-font-mono); font-size: 11px; border-radius: 12px; position: relative; overflow: hidden; }
    .ar-photo::before { content: ''; position: absolute; inset: 0; background-image: repeating-linear-gradient(45deg, transparent 0 12px, rgba(0,0,0,0.025) 12px 13px); }
  `;
  const s = document.createElement('style');
  s.id = 'ar-styles';
  s.textContent = css;
  document.head.appendChild(s);
})();
