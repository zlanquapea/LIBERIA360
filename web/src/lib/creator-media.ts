export function creatorVideoPosterUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = url.searchParams.get('v') ?? url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? `https://vumbnail.com/${id}.jpg` : null;
    }
  } catch {
    return null;
  }

  return null;
}
