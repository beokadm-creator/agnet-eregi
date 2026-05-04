const fs = require('fs');
const path = './firebase-react/apps/user-web/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

// Backgrounds
code = code.replace(/bg-slate-50/g, 'bg-[var(--bg)]');
code = code.replace(/bg-white/g, 'bg-[var(--surface)]');

// Text Colors
code = code.replace(/text-slate-900|text-slate-800/g, 'text-[var(--text-primary)]');
code = code.replace(/text-slate-700|text-slate-600/g, 'text-[var(--text-secondary)]');
code = code.replace(/text-slate-500|text-slate-400/g, 'text-[var(--text-tertiary)]');

// Brand Colors
code = code.replace(/bg-indigo-600/g, 'bg-[var(--brand)]');
code = code.replace(/hover:bg-indigo-700/g, 'hover:opacity-90');
code = code.replace(/text-indigo-700|text-indigo-900|text-indigo-800/g, 'text-[var(--brand)]');
code = code.replace(/text-indigo-600/g, 'text-[var(--brand)]');
code = code.replace(/border-indigo-500|border-indigo-600|border-indigo-200|border-indigo-100/g, 'border-[var(--brand)]');
code = code.replace(/bg-indigo-50|bg-indigo-100/g, 'bg-[var(--brand)]/10');
code = code.replace(/focus:ring-indigo-500/g, 'focus:ring-[var(--brand)]');
code = code.replace(/selection:bg-indigo-100/g, 'selection:bg-[var(--brand)]/20');
code = code.replace(/selection:text-indigo-900/g, 'selection:text-[var(--brand)]');

// Borders
code = code.replace(/border-slate-200|border-slate-100/g, 'border-[var(--border)]');
code = code.replace(/border-slate-300/g, 'border-[var(--border-strong)]');

// Rounding - make it more elegant/sharp
code = code.replace(/rounded-2xl|rounded-xl/g, 'rounded-sm');
code = code.replace(/rounded-lg/g, 'rounded-sm');

// Shadows - flatter, more editorial
code = code.replace(/shadow-sm|shadow-md/g, 'shadow-none');

// Fonts
code = code.replace(/font-sans/g, 'font-[\'Gothic_A1\']');
// Add Hahmlet to h1, h2, h3
code = code.replace(/<h([1-3])(.*?)className="(.*?)"/g, '<h$1$2className="$3 font-[\'Hahmlet\']"');

// Fix button text colors
code = code.replace(/text-white/g, 'text-[var(--bg)]');

fs.writeFileSync(path, code);
console.log('Refactoring complete');
