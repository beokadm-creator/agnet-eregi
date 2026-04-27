import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FloatingChatWidget from './FloatingChatWidget';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('FloatingChatWidget', () => {
  it('renders the chat widget button initially', () => {
    render(<FloatingChatWidget token="test-token" />);
    const button = screen.getByText('💬');
    expect(button).toBeInTheDocument();
  });
});
