import { render, screen } from '@testing-library/react';
import OpsShell from './OpsShell';

describe('OpsShell', () => {
  it('renders the header title', () => {
    render(<OpsShell />);
    const heading = screen.getByText(/Ops Console/i);
    expect(heading).toBeInTheDocument();
  });
});
