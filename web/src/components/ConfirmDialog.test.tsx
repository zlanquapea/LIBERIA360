import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Delete this?" onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the title, description, consequences, and the irreversible warning', () => {
    render(
      <ConfirmDialog
        open
        title='Delete "Liberia Adventure 2026"?'
        description="This will permanently delete this trip."
        consequences={['3 people will lose access to this trip.']}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Delete "Liberia Adventure 2026"?')).toBeInTheDocument();
    expect(screen.getByText('This will permanently delete this trip.')).toBeInTheDocument();
    expect(screen.getByText('3 people will lose access to this trip.')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when the destructive button is clicked, with no typed confirmation required', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog open title="Delete this?" confirmLabel="Delete Trip" onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Trip' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked, when Escape is pressed, and when the backdrop is clicked', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog open title="Delete this?" onConfirm={jest.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('alertdialog'));
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('does not dismiss via Escape or backdrop while a request is in flight', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog open isLoading title="Delete this?" onConfirm={jest.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('alertdialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables both buttons and shows the loading label while isLoading', () => {
    render(
      <ConfirmDialog open isLoading title="Delete this?" loadingLabel="Deleting trip…" onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Deleting trip…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows an inline error and lets the user retry without losing the dialog', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Delete this?"
        error="Something went wrong. Please try again."
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  describe('type-to-confirm safeguard', () => {
    it('keeps the confirm button disabled until the typed value matches exactly', () => {
      const onConfirm = jest.fn();
      render(
        <ConfirmDialog
          open
          title="Delete this?"
          confirmationPhrase="Liberia Adventure 2026"
          confirmLabel="Permanently Delete"
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />,
      );
      const confirmButton = screen.getByRole('button', { name: 'Permanently Delete' });
      const input = screen.getByRole('textbox');

      expect(confirmButton).toBeDisabled();

      fireEvent.change(input, { target: { value: 'Liberia Adventure' } });
      expect(confirmButton).toBeDisabled();

      fireEvent.change(input, { target: { value: 'Liberia Adventure 2026' } });
      expect(confirmButton).toBeEnabled();

      fireEvent.click(confirmButton);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('resets the typed value each time the dialog reopens', () => {
      const { rerender } = render(
        <ConfirmDialog open title="Delete this?" confirmationPhrase="Trip Name" onConfirm={jest.fn()} onCancel={jest.fn()} />,
      );
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Trip Name' } });
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

      rerender(<ConfirmDialog open={false} title="Delete this?" confirmationPhrase="Trip Name" onConfirm={jest.fn()} onCancel={jest.fn()} />);
      rerender(<ConfirmDialog open title="Delete this?" confirmationPhrase="Trip Name" onConfirm={jest.fn()} onCancel={jest.fn()} />);

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });
  });
});
