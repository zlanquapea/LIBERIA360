import { render, screen } from '@testing-library/react';
import { MapFallbackBoundary } from './MapFallbackBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('MapFallbackBoundary', () => {
  // React logs the caught error to the console by default — silenced here
  // so this test's own passing output doesn't look like a failure.
  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <MapFallbackBoundary fallback={<p>fallback</p>}>
        <p>the map</p>
      </MapFallbackBoundary>,
    );
    expect(screen.getByText('the map')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback when a child throws during render', () => {
    render(
      <MapFallbackBoundary fallback={<p>fallback</p>}>
        <Boom />
      </MapFallbackBoundary>,
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });
});
