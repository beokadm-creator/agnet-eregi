const fs = require('fs');
const path = './firebase-react/apps/user-web/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

// Disabled states
code = code.replace(/disabled:bg-(indigo|blue|emerald|orange|purple|cyan|yellow|red|lime)-[0-9]{3}/g, 'disabled:bg-[var(--border-strong)] disabled:text-[var(--text-tertiary)] disabled:opacity-50');

// Primary / Action buttons
code = code.replace(/bg-(emerald|orange|blue|cyan|purple|yellow|lime)-[56]00 hover:bg-(emerald|orange|blue|cyan|purple|yellow|lime)-[67]00/g, 'bg-[var(--brand)] text-[var(--bg)] hover:opacity-90');

// Text colors
code = code.replace(/text-(emerald|orange|blue|cyan|purple|lime|yellow)-[89]00/g, 'text-[var(--text-primary)] font-medium');
code = code.replace(/text-(emerald|orange|blue|cyan|purple|lime|yellow)-[67]00/g, 'text-[var(--text-secondary)]');
code = code.replace(/text-(emerald|orange|blue|cyan|purple|lime|yellow)-500/g, 'text-[var(--text-tertiary)]');

// Background and border colors
code = code.replace(/bg-(emerald|orange|blue|cyan|purple|lime|yellow)-50/g, 'bg-[var(--surface-alt)]');
code = code.replace(/bg-(emerald|orange|blue|cyan|purple|lime|yellow)-100/g, 'bg-[var(--surface-alt)]');
code = code.replace(/border-(emerald|orange|blue|cyan|purple|lime|yellow)-[12]00/g, 'border-[var(--border)]');

// Specific red colors (keep red for errors but mute it)
code = code.replace(/bg-red-50/g, 'bg-red-50/50');
code = code.replace(/bg-red-100/g, 'bg-red-100/50');
code = code.replace(/border-red-100|border-red-200/g, 'border-red-200/50');

fs.writeFileSync(path, code);
