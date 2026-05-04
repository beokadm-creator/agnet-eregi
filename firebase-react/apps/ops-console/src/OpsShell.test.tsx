import { render, screen } from '@testing-library/react';
import OpsShell from './OpsShell';

describe('OpsShell', () => {
  it('renders the header title', () => {
    render(<OpsShell />);
    const loading = screen.getByText(/불러오는 중/i);
    expect(loading).toBeInTheDocument();
  });
});
