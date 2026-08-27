type VideoRef = { provider: 'youtube' | 'vimeo'; id: string };

// Shared by creatorVideoPosterUrl and creatorVideoEmbedUrl below — both
// need the same provider+id extraction, just to build a different URL
// from it.
function parseVideoRef(value: string): VideoRef | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? { provider: 'youtube', id } : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = url.searchParams.get('v') ?? url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
      return id ? { provider: 'youtube', id } : null;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? { provider: 'vimeo', id } : null;
    }
  } catch {
    return null;
  }

  return null;
}

export function creatorVideoPosterUrl(value: string): string | null {
  const ref = parseVideoRef(value);
  if (!ref) return null;
  return ref.provider === 'youtube'
    ? `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg`
    : `https://vumbnail.com/${ref.id}.jpg`;
}

// The feed's own video posts are a YouTube/Vimeo link (see
// CreatorPostComposer's "Video posts currently use a YouTube or Vimeo
// link" copy) — never a directly-hosted file, so a native <video> element
// can't play one at all. This is the embeddable iframe URL for whichever
// of the two it is, with autoplay on (the iframe itself is only mounted
// once someone taps play — see CreatorPostMedia — so this isn't an
// unsolicited autoplaying video, just a normal "tap play, it plays"
// embed). Returns null for anything this app doesn't recognize as either
// provider, so callers can fall back to linking out instead of embedding
// a URL they can't be sure is even a video.
export function creatorVideoEmbedUrl(value: string): string | null {
  const ref = parseVideoRef(value);
  if (!ref) return null;
  return ref.provider === 'youtube'
    ? `https://www.youtube.com/embed/${ref.id}?autoplay=1&playsinline=1&rel=0`
    : `https://player.vimeo.com/video/${ref.id}?autoplay=1`;
}

// Whether a mediaUrl is a direct, browser-playable video file rather than
// a YouTube/Vimeo page link — today's composer only ever produces the
// latter (see above), but a future direct-upload path would produce this
// instead, and CreatorPostMedia's inline autoplay handling is only valid
// for a real file, never for a provider page URL.
export function isDirectVideoFile(value: string): boolean {
  try {
    const url = new URL(value);
    return /\.(mp4|webm|mov|m4v|ogv)$/i.test(url.pathname);
  } catch {
    return false;
  }
}
