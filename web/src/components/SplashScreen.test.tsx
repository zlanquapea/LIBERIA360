import { act, render, screen } from '@testing-library/react';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows the branded splash on the first visit and dismisses it after the reveal', () => {
    render(<SplashScreen />);

    expect(screen.getByRole('status', { name: 'Loading LIBERIA360' })).toBeInTheDocument();
    expect(screen.getByAltText('LIBERIA360')).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1450));
    expect(screen.queryByRole('status', { name: 'Loading LIBERIA360' })).not.toBeInTheDocument();
  });

  it('does not show again during the same session', () => {
    sessionStorage.setItem('liberia360:splash-seen', '1');

    render(<SplashScreen />);

    expect(screen.queryByRole('status', { name: 'Loading LIBERIA360' })).not.toBeInTheDocument();
  });

  it('uses the shorter reduced-motion handoff', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    render(<SplashScreen />);
    expect(screen.getByRole('status', { name: 'Loading LIBERIA360' })).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(500));
    expect(screen.queryByRole('status', { name: 'Loading LIBERIA360' })).not.toBeInTheDocument();
  });
});
