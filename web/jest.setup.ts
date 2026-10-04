import '@testing-library/jest-dom';

// jsdom has no <dialog> modal API yet; components that open a native
// dialog (e.g. CreatorPostCard's safety menu) call these on mount.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
