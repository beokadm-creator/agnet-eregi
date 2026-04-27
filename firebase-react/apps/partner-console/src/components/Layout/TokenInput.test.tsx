import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TokenInput from './TokenInput';
import { AppProvider } from '../../context/AppContext';

describe('TokenInput', () => {
  it('renders token input field', () => {
    render(
      <AppProvider>
        <TokenInput />
      </AppProvider>
    );
    
    // There should be a placeholder matching "Token"
    const input = screen.getByPlaceholderText(/Token/i);
    expect(input).toBeInTheDocument();
  });
});
