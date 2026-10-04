import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMessages } from '@/test/render-with-messages';
import { PhotoEditor } from './PhotoEditor';

// jsdom has no image decoding; fake a loaded 1200×900 photo.
class FakeImage {
  naturalWidth = 1200;
  naturalHeight = 900;
  width = 1200;
  height = 900;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

describe('PhotoEditor', () => {
  const file = new File(['x'], 'beach.png', { type: 'image/png' });

  beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:photo');
    global.URL.revokeObjectURL = jest.fn();
    (global as unknown as { Image: unknown }).Image = FakeImage;
  });

  it('offers the framing shapes and uploads the untouched file with "Use original"', async () => {
    const onDone = jest.fn();
    renderWithMessages(<PhotoEditor file={file} defaultAspect="4:3" onDone={onDone} onCancel={jest.fn()} />);
    await act(() => new Promise((r) => setTimeout(r, 5)));
    expect(screen.getByRole('radio', { name: 'Card 4:3' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('On a card')).toBeInTheDocument();
    expect(screen.getByText('As a cover')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use original' }));
    expect(onDone).toHaveBeenCalledWith(file);
  });

  it('uploads as-is when nothing was changed from the original shape', async () => {
    const onDone = jest.fn();
    renderWithMessages(<PhotoEditor file={file} onDone={onDone} onCancel={jest.fn()} />);
    await act(() => new Promise((r) => setTimeout(r, 5)));
    await userEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    expect(onDone).toHaveBeenCalledWith(file);
  });

  it('closes on Escape and offers to skip the rest of a batch', async () => {
    const onCancel = jest.fn();
    const onSkipRest = jest.fn();
    renderWithMessages(
      <PhotoEditor file={file} remaining={2} onDone={jest.fn()} onCancel={onCancel} onSkipRest={onSkipRest} />,
    );
    await act(() => new Promise((r) => setTimeout(r, 5)));
    await userEvent.click(screen.getByRole('button', { name: 'Upload the remaining 3 as they are' }));
    expect(onSkipRest).toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
