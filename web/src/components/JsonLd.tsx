// Renders a schema.org JSON-LD <script> tag. Escapes `<` so user-submitted
// text (an event name/description, for instance — anyone eligible to post
// an event controls those strings) can't break out of the script tag and
// inject markup; JSON.stringify alone doesn't do this; the browser only
// stops parsing a script body at a literal "</script", not at any `<`, but
// escaping every `<` is the simplest safe rule that can't miss a variant.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    // eslint-disable-next-line react/no-danger -- structured, escaped JSON, not raw HTML
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
