import { render, screen } from '@testing-library/react';
import OpsShell from './OpsShell';

describe('OpsShell', () => {
  it('renders the header title', () => {
    render(<OpsShell />);
    const heading = screen.getByText(/운영 콘솔/i);
    expect(heading).toBeInTheDocument();
  });
});
