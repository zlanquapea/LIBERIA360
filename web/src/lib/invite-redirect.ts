// Post-login/signup redirect helpers shared by /login and /invite/[token]
// — split out from the page components so the open-redirect guard is
// unit-testable on its own.

// Only redirect to a same-site relative path — `next` comes from a URL
// query string, so an absolute/external value here would be an open
// redirect.
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

// If `next` points at a trip invitation or a ticket transfer, "New here?"
// on the login page should carry that token itself (/signup?invite=… or
// /signup?ticketTransfer=…, which the signup form links back to after
// registering), not a generic `next` redirect the signup form doesn't read.
export function signupHrefFor(next: string): string {
  const inviteMatch = next.match(/^\/invite\/([^/?#]+)/);
  if (inviteMatch) return `/signup?invite=${inviteMatch[1]}`;
  const transferMatch = next.match(/^\/ticket-transfer\/([^/?#]+)/);
  if (transferMatch) return `/signup?ticketTransfer=${transferMatch[1]}`;
  return '/signup';
}
