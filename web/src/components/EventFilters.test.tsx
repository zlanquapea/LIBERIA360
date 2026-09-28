import { fireEvent, render, screen } from '@testing-library/react';
import { EventFilters } from './EventFilters';
import { getThisMonthRange, getTodayRange } from '../lib/date-ranges';
const push = jest.fn();
let params = new URLSearchParams();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => params }));
beforeEach(() => { push.mockClear(); params = new URLSearchParams(); });
it('preserves search while changing category and resets pagination', () => {
  params = new URLSearchParams('search=music&page=3');
  render(<EventFilters counties={[]} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'concert' } });
  expect(push).toHaveBeenCalledWith('/events?search=music&category=concert');
});
it('matches both date boundaries and clears an end-date-only filter', () => {
  params.set('dateFrom', getTodayRange().from);
  params.set('dateTo', getThisMonthRange().to);
  const { unmount } = render(<EventFilters counties={[]} />);
  if (getTodayRange().to !== getThisMonthRange().to) expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false');
  unmount();
  params = new URLSearchParams('dateTo=2026-12-30&search=music');
  render(<EventFilters counties={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clear dates' }));
  expect(push).toHaveBeenCalledWith('/events?search=music');
});
