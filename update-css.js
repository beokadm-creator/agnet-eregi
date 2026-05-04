const fs = require('fs');
const path = './firebase-react/apps/user-web/src/index.css';
let css = fs.readFileSync(path, 'utf8');

const newCSS = `
@layer components {
  .dash-root {
    min-height: 100dvh;
    background-color: var(--bg);
    color: var(--text-primary);
    padding: 0;
    font-family: 'Gothic A1', sans-serif;
  }

  .dash-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 4rem 1.5rem 8rem;
  }

  .dash-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .dash-title {
    font-family: 'Hahmlet', serif;
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--brand);
    margin: 0;
  }

  .dash-nav {
    display: flex;
    gap: 1rem;
    font-size: 0.8125rem;
  }

  .dash-nav-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    transition: color 0.2s ease;
  }

  .dash-nav-btn:hover {
    color: var(--text-primary);
  }

  .dash-section {
    margin-bottom: 5rem;
  }

  .dash-section-title {
    font-family: 'Hahmlet', serif;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 2rem;
  }

  .dash-item {
    border-top: 1px solid var(--border);
    padding: 1.5rem 0;
  }

  .dash-item:last-child {
    border-bottom: 1px solid var(--border);
  }

  .dash-item-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }

  .dash-item-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .dash-item-status {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    color: var(--brand);
    text-transform: uppercase;
  }

  .dash-item-meta {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin-top: 0.25rem;
  }

  .dash-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    background-color: var(--brand);
    color: oklch(98% 0.005 88);
    border: none;
    border-radius: 2px;
    font-family: 'Gothic A1', sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .dash-button:hover:not(:disabled) {
    background-color: var(--brand-hover);
  }

  .dash-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dash-button--outline {
    background-color: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border-strong);
  }

  .dash-button--outline:hover:not(:disabled) {
    background-color: var(--surface);
    border-color: var(--text-primary);
  }

  .dash-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    font-family: 'Gothic A1', sans-serif;
    font-size: 0.875rem;
    color: var(--text-primary);
    transition: border-color 0.2s ease;
  }

  .dash-input:focus {
    outline: none;
    border-color: var(--brand);
  }

  .dash-card {
    background-color: var(--surface);
    padding: 2rem;
    border: 1px solid var(--border);
    border-radius: 2px;
    margin-bottom: 1.5rem;
  }

  .dash-card-title {
    font-family: 'Hahmlet', serif;
    font-size: 1.125rem;
    color: var(--text-primary);
    margin: 0 0 1rem;
  }

  .dash-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-tertiary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dash-value {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }
}
`;

if (!css.includes('.dash-root')) {
  css = css.replace('}', '}\n' + newCSS);
  fs.writeFileSync(path, css);
}
