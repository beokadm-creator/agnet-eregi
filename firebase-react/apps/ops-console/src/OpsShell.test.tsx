import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OpsShell from './OpsShell';

describe('OpsShell', () => {
  it('renders the header title', () => {
    render(<OpsShell />);
    const heading = screen.getByText(/Ops Control Panel/i);
    expect(heading).toBeInTheDocument();
  });
});
