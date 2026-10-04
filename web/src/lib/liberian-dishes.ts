/** Liberian dishes a visitor will meet on menus. Names stay as they're
 * written in Monrovia; descriptions are translated in messages under
 * `liberia.dishes`. `terms` are matched as whole words, lowercase. */
export const DISHES = [
  { id: 'palmButter', name: 'Palm butter', terms: ['palm butter'] },
  { id: 'cassavaLeaf', name: 'Cassava leaf', terms: ['cassava leaf', 'cassava leaves'] },
  { id: 'potatoGreens', name: 'Potato greens', terms: ['potato greens', 'potato green'] },
  { id: 'jollof', name: 'Jollof rice', terms: ['jollof'] },
  { id: 'fufu', name: 'Fufu', terms: ['fufu', 'foofoo'] },
  { id: 'dumboy', name: 'Dumboy', terms: ['dumboy', 'dumbboy'] },
  { id: 'torbogee', name: 'Torbogee', terms: ['torbogee', 'torborgee', 'tobogee'] },
  { id: 'pepperSoup', name: 'Pepper soup', terms: ['pepper soup'] },
  { id: 'palavaSauce', name: 'Palava sauce', terms: ['palava sauce', 'palaver sauce'] },
  { id: 'checkRice', name: 'Check rice', terms: ['check rice'] },
  { id: 'kala', name: 'Kala', terms: ['kala'] },
  { id: 'riceBread', name: 'Rice bread', terms: ['rice bread'] },
  { id: 'gingerBeer', name: 'Ginger beer', terms: ['ginger beer'] },
] as const;

export type Dish = (typeof DISHES)[number];

function escape(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MATCHERS = DISHES.map((dish) => ({
  dish,
  pattern: new RegExp(`(^|[^\\p{L}])(${dish.terms.map(escape).join('|')})(?=$|[^\\p{L}])`, 'iu'),
}));

/** Dishes named anywhere in the given text, in glossary order. */
export function findDishes(...texts: Array<string | null | undefined>): Dish[] {
  const text = texts.filter(Boolean).join(' \n ');
  if (!text) return [];
  return MATCHERS.filter(({ pattern }) => pattern.test(text)).map(({ dish }) => dish);
}
