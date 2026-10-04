/** Everyday Liberian English (Kolokwa). The phrase itself stays as it's
 * said; its meaning is translated in messages under `liberia.phrases`. */
export const PHRASES = [
  { id: 'howDaBody', phrase: 'How lay body?', example: 'My man, how lay body?' },
  { id: 'bodyFine', phrase: 'lay body fine.', example: 'lay body fine oh, thank God.' },
  { id: 'whatYouSaying', phrase: 'Wha your saying?', example: 'Ay, my people, wha your saying?' },
  { id: 'iComing', phrase: 'I coming.', example: 'Hold on, I coming.' },
  { id: 'smallSmall', phrase: 'Small small.', example: 'Small small, we will reach.' },
  { id: 'myPeople', phrase: 'My people!', example: null },
  { id: 'holdYourFoot', phrase: 'Let me hold your foot.', example: 'Let me hold your foot, help me small.' },
  { id: 'youLie', phrase: 'You lie!', example: null },
  { id: 'carryMe', phrase: 'Carry me Waterside.', example: null },
  { id: 'iDoneEat', phrase: 'I na eat.', example: null },
  { id: 'lehWeGo', phrase: 'Leh go.', example: null },
  { id: 'thankYouOh', phrase: 'Thank you oh!', example: null },
  { id: 'itNotEasy', phrase: 'It na easy.', example: null },
  { id: 'oldMa', phrase: 'Old ma / Papay', example: 'Good morning, old ma.' },
  { id: 'pekin', phrase: 'Pekin', example: 'Da my pekin.' },
  { id: 'pehnPehn', phrase: 'Pehn-pehn', example: 'Take pehn-pehn to Sinkor.' },
  { id: 'keke', phrase: 'Keke', example: null },
  { id: 'snap', phrase: 'The snap', example: null },
] as const;

export type PhraseId = (typeof PHRASES)[number]['id'];

/** Same phrase for everyone all day (UTC, which is Liberia's time zone),
 * a new one tomorrow. */
export function phraseOfTheDay(date: Date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return PHRASES[((day % PHRASES.length) + PHRASES.length) % PHRASES.length];
}
