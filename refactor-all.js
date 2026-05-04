const fs = require('fs');
const path = require('path');

const apps = ['partner-console', 'ops-console'];

const cssVars = `
:root {
  --brand:          oklch(36% 0.092 155);
  --brand-hover:    oklch(32% 0.088 155);
  --brand-faint:    oklch(95% 0.018 155);
  --bg:             oklch(97.5% 0.007 88);
  --surface:        oklch(99% 0.004 88);
  --surface-alt:    oklch(96% 0.008 88);
  --text-primary:   oklch(16% 0.012 230);
  --text-secondary: oklch(48% 0.014 230);
  --text-tertiary:  oklch(68% 0.010 230);
  --border:         oklch(87% 0.010 88);
  --border-strong:  oklch(77% 0.012 88);
  --error:          oklch(42% 0.14 25);
  --error-light:    oklch(94% 0.038 25);
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Gothic A1', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--bg);
  color: var(--text-primary);
}
`;

function injectCss(app) {
  const cssPath = `./firebase-react/apps/${app}/src/index.css`;
  if (!fs.existsSync(cssPath)) return;
  let css = fs.readFileSync(cssPath, 'utf8');
  if (!css.includes('--brand:')) {
    css = css.replace(/body\s*{[^}]*}/, cssVars);
    fs.writeFileSync(cssPath, css);
  }
}

function refactorTsx(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      refactorTsx(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let code = fs.readFileSync(fullPath, 'utf8');
      
      // Basic background/surface
      code = code.replace(/bg-slate-50|bg-gray-50/g, 'bg-[var(--bg)]');
      code = code.replace(/bg-white/g, 'bg-[var(--surface)]');
      
      // Text colors
      code = code.replace(/text-slate-900|text-slate-800|text-gray-900|text-gray-800/g, 'text-[var(--text-primary)]');
      code = code.replace(/text-slate-700|text-slate-600|text-gray-700|text-gray-600/g, 'text-[var(--text-secondary)]');
      code = code.replace(/text-slate-500|text-slate-400|text-gray-500|text-gray-400/g, 'text-[var(--text-tertiary)]');
      
      // Brand Colors
      code = code.replace(/bg-indigo-600|bg-blue-600/g, 'bg-[var(--brand)] text-[var(--bg)]');
      code = code.replace(/hover:bg-indigo-700|hover:bg-blue-700/g, 'hover:opacity-90');
      code = code.replace(/text-indigo-700|text-indigo-900|text-indigo-800|text-blue-700|text-blue-800|text-blue-900/g, 'text-[var(--brand)]');
      code = code.replace(/text-indigo-600|text-blue-600/g, 'text-[var(--brand)]');
      code = code.replace(/border-indigo-500|border-indigo-600|border-indigo-200|border-indigo-100|border-blue-500|border-blue-600|border-blue-200|border-blue-100/g, 'border-[var(--brand)]');
      code = code.replace(/bg-indigo-50|bg-indigo-100|bg-blue-50|bg-blue-100/g, 'bg-[var(--brand)]/10');
      code = code.replace(/focus:ring-indigo-500|focus:ring-blue-500/g, 'focus:ring-[var(--brand)]');
      code = code.replace(/selection:bg-indigo-100|selection:bg-blue-100/g, 'selection:bg-[var(--brand)]/20');
      code = code.replace(/selection:text-indigo-900|selection:text-blue-900/g, 'selection:text-[var(--brand)]');

      // Borders
      code = code.replace(/border-slate-200|border-slate-100|border-gray-200|border-gray-100/g, 'border-[var(--border)]');
      code = code.replace(/border-slate-300|border-gray-300/g, 'border-[var(--border-strong)]');

      // Rounding & Shadows
      code = code.replace(/rounded-2xl|rounded-xl|rounded-lg/g, 'rounded-sm');
      code = code.replace(/shadow-sm|shadow-md|shadow-lg|shadow/g, 'shadow-none');

      // Fonts
      code = code.replace(/font-sans/g, "font-['Gothic_A1']");
      // Replace h1-h4 tags to add Hahmlet font
      code = code.replace(/<(h[1-4])([^>]*)className="([^"]*)"/g, (match, tag, attr, classes) => {
        if (!classes.includes('Hahmlet')) {
          return `<${tag}${attr}className="${classes} font-['Hahmlet']"`;
        }
        return match;
      });

      fs.writeFileSync(fullPath, code);
    }
  }
}

for (const app of apps) {
  injectCss(app);
  refactorTsx(`./firebase-react/apps/${app}/src`);
}

console.log('Refactoring all apps complete');
