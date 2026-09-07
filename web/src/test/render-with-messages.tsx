import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import enMessages from '../../messages/en.json';

// Phase 2 (I18N_PLAN.md, "Test/tooling updates"): any component under test
// that calls next-intl's useTranslations()/useLocale() throws without a
// NextIntlClientProvider ancestor — Header, ConfirmDialog, BrandLoader, and
// anything else translated in this phase now need one. Defaults to the
// English message catalog, since these are unit tests for behavior, not
// translation content — pass `messages`/`locale` to exercise a specific
// locale's strings instead. Uses RTL's `wrapper` option (not a manual JSX
// wrap) specifically so `rerender()` on the returned result re-applies the
// provider too, rather than dropping it on the next render.
export function renderWithMessages(
  ui: ReactElement,
  options?: RenderOptions & { locale?: string; messages?: Record<string, unknown> },
) {
  const { locale = 'en', messages = enMessages, ...renderOptions } = options ?? {};
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
