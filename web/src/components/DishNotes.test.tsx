import { screen } from '@testing-library/react';
import { renderWithMessages } from '@/test/render-with-messages';
import { DishNotes } from './DishNotes';

describe('DishNotes', () => {
  it('explains the Liberian dishes a place mentions', () => {
    renderWithMessages(<DishNotes texts={['Mama’s Kitchen', 'Famous for palm butter and dumboy on Saturdays.']} />);
    expect(screen.getByRole('heading', { name: 'Liberian dishes here' })).toBeInTheDocument();
    expect(screen.getByText('Palm butter')).toBeInTheDocument();
    expect(screen.getByText(/stretchy dough/)).toBeInTheDocument();
  });

  it('asks "What’s …?" inline on a menu item', () => {
    renderWithMessages(<DishNotes texts={['Cassava leaf & rice']} variant="inline" />);
    expect(screen.getByText('What’s Cassava leaf?')).toBeInTheDocument();
  });

  it('renders nothing when no dish is named', () => {
    const { container } = renderWithMessages(<DishNotes texts={['Grilled chicken wings']} />);
    expect(container).toBeEmptyDOMElement();
  });
});
