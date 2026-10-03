const kinds = {
  places: { label: "Place", action: "View place" },
  businesses: { label: "Business", action: "View business" },
  guides: { label: "Guide & host", action: "View guide" },
  experiences: { label: "Experience", action: "View & book" },
};

export function parsePostListing(value: string) {
  try {
    const url = new URL(value.trim(), "https://liberia360.net");
    if (
      url.protocol !== "https:" ||
      !["liberia360.net", "www.liberia360.net"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    const match = url.pathname.match(
      /^\/(?:en\/|fr\/|ar\/|zh\/)?(places|businesses|guides|experiences)\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,199})\/?$/,
    );
    if (!match || ["new", "me", "search"].includes(match[2])) return null;
    const kind = match[1] as keyof typeof kinds;
    return {
      kind,
      slug: match[2],
      path: `/${kind}/${match[2]}`,
      ...kinds[kind],
    };
  } catch {
    return null;
  }
}
