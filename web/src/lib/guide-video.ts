// Turns a creator's video link into something the guide page can play,
// only after the visitor presses play. YouTube uses the privacy-enhanced
// (no-cookie) domain.

export type GuideVideoSource =
  | { kind: 'embed'; src: string }
  | { kind: 'file'; src: string };

export function guideVideoSource(url: string | null): GuideVideoSource | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return { kind: 'file', src: url };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\./, '');
  let youtubeId: string | null = null;
  if (host === 'youtu.be') youtubeId = parsed.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com') {
    if (parsed.pathname === '/watch') youtubeId = parsed.searchParams.get('v');
    else {
      const m = parsed.pathname.match(/^\/(shorts|embed)\/([\w-]+)/);
      youtubeId = m ? m[2] : null;
    }
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0` };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = parsed.pathname.match(/(\d{5,12})/);
    if (m) return { kind: 'embed', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1` };
  }
  return null;
}
