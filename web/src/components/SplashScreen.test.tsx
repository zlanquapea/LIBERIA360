import { act, render, screen } from '@testing-library/react';
import { SplashScreen } from './SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders visible (opacity-100, not yet fading) immediately on mount', () => {
    const { container } = render(<SplashScreen />);
    const overlay = container.firstElementChild;
    expect(overlay).toHaveClass('opacity-100');
    expect(overlay).not.toHaveClass('opacity-0');
    expect(screen.getByText('LIBERIA360')).toBeInTheDocument();
  });

  it('starts fading (opacity-0, pointer-events-none) after the minimum-visible timer, but stays in the DOM', () => {
    const { container } = render(<SplashScreen />);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    const overlay = container.firstElementChild;
    expect(overlay).toHaveClass('opacity-0');
    expect(overlay).toHaveClass('pointer-events-none');
  });

  it('unmounts entirely once the fade transition has had time to finish', () => {
    const { container } = render(<SplashScreen />);
    act(() => {
      jest.advanceTimersByTime(500 + 500);
    });
    expect(container.firstElementChild).toBeNull();
  });

  it('is marked aria-hidden and carries an sr-only status for the brief window it is visible', () => {
    render(<SplashScreen />);
    expect(screen.getByText('Loading LIBERIA360…')).toHaveClass('sr-only');
  });
});
