import { render, screen, fireEvent } from '@testing-library/react';
import { SafeImage } from './SafeImage';

const FALLBACK = <span>fallback-ui</span>;

describe('SafeImage', () => {
  it('renders the fallback when src is null/undefined', () => {
    render(<SafeImage src={null} alt="" fallback={FALLBACK} />);
    expect(screen.getByText('fallback-ui')).toBeInTheDocument();
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  });

  it('renders an <img> for src with no thumbSrc, and falls back on error', () => {
    const { container } = render(<SafeImage src="https://example.com/full.jpg" alt="" fallback={FALLBACK} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://example.com/full.jpg');

    fireEvent.error(img);
    expect(screen.getByText('fallback-ui')).toBeInTheDocument();
  });

  it('loads thumbSrc first when provided', () => {
    const { container } = render(
      <SafeImage
        src="https://example.com/full.jpg"
        thumbSrc="https://example.com/full-thumb.jpg"
        alt=""
        fallback={FALLBACK}
      />,
    );
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/full-thumb.jpg');
  });

  it('retries with the full-size src when the thumbnail fails to load, instead of showing the fallback', () => {
    const { container } = render(
      <SafeImage
        src="https://example.com/full.jpg"
        thumbSrc="https://example.com/full-thumb.jpg"
        alt=""
        fallback={FALLBACK}
      />,
    );
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://example.com/full-thumb.jpg');

    fireEvent.error(img);

    // Still an <img>, not the fallback — it silently retried with the
    // full-size image rather than giving up after the thumbnail 404'd.
    expect(screen.queryByText('fallback-ui')).not.toBeInTheDocument();
    const retried = container.querySelector('img')!;
    expect(retried).toHaveAttribute('src', 'https://example.com/full.jpg');
  });

  it('shows the fallback only once the full-size retry also fails', () => {
    const { container } = render(
      <SafeImage
        src="https://example.com/full.jpg"
        thumbSrc="https://example.com/full-thumb.jpg"
        alt=""
        fallback={FALLBACK}
      />,
    );
    fireEvent.error(container.querySelector('img')!); // thumb fails -> retries with full
    fireEvent.error(container.querySelector('img')!); // full also fails -> gives up

    expect(screen.getByText('fallback-ui')).toBeInTheDocument();
  });

  it('resets to a fresh loading state when src/thumbSrc change', () => {
    const { container, rerender } = render(
      <SafeImage src="https://example.com/a.jpg" alt="" fallback={FALLBACK} />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByText('fallback-ui')).toBeInTheDocument();

    rerender(<SafeImage src="https://example.com/b.jpg" alt="" fallback={FALLBACK} />);
    expect(screen.queryByText('fallback-ui')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/b.jpg');
  });

  it('sets decoding="async" so a large image never blocks paint', () => {
    const { container } = render(<SafeImage src="https://example.com/full.jpg" alt="" fallback={FALLBACK} />);
    expect(container.querySelector('img')).toHaveAttribute('decoding', 'async');
  });

  // Regression test for a real bug: the <img> used to be `hidden`
  // (display: none) while status === 'loading', with a separate sibling
  // div standing in as the skeleton. A loading="lazy" image never starts
  // fetching until the browser's layout engine can measure its box against
  // the viewport — a display:none element has no box — so that <img>
  // could never actually load, ever, for any lazily-loaded photo in the
  // app. The fix keeps the same <img> in real layout the whole time and
  // uses a background-color + pulse class instead of hiding it.
  it('keeps the <img> in normal layout flow (never display:none) while loading, so native lazy-loading can actually fetch it', () => {
    const { container } = render(
      <SafeImage src="https://example.com/full.jpg" alt="" className="h-32 w-full" fallback={FALLBACK} loading="lazy" />,
    );
    const img = container.querySelector('img')!;
    expect(img.className).not.toMatch(/\bhidden\b/);
    // jsdom doesn't compute real layout, but this is the mechanism that
    // actually broke: the img carried Tailwind's `hidden` utility
    // (display: none) via its className, which is exactly what this
    // asserts is gone.
  });

  it('shows a pulsing skeleton look on the <img> itself while loading, then sheds it once loaded', () => {
    const { container } = render(<SafeImage src="https://example.com/full.jpg" alt="" fallback={FALLBACK} />);
    const img = container.querySelector('img')!;
    expect(img.className).toMatch(/animate-pulse/);

    fireEvent.load(img);
    expect(img.className).not.toMatch(/animate-pulse/);
  });
});
