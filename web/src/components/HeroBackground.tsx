import Image from 'next/image';

// The three real, product-supplied Liberia photos OnboardingTour already
// uses (a waterfall, and two shots of the same scenic cliff-ringed lake) —
// see page.tsx's "Hero 'first impression' rebuild" doc comment for why
// these were reused here rather than pulling from the catalog the way
// HeroPhotoMosaic (now retired) did.
const HERO_PHOTOS = [
  { src: '/onboarding/discover.jpg', alt: '' },
  { src: '/onboarding/plan-trip.jpg', alt: '' },
  { src: '/onboarding/save-places.jpg', alt: '' },
] as const;

// Each layer runs the exact same `hero-ken-burns` keyframe (tailwind.config.ts)
// but starts partway through it via a *negative* delay, so the three take
// turns fading in/zooming/fading out instead of animating in lockstep — a
// pure-CSS crossfade carousel with no client JS. Purely decorative
// (aria-hidden on the wrapper, empty alt on each photo) since the hero's
// actual heading carries the same "what is this" message on its own.
export function HeroBackground() {
  const cycleSeconds = 24;
  const stepSeconds = cycleSeconds / HERO_PHOTOS.length;
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {HERO_PHOTOS.map((photo, i) => (
        <div
          key={photo.src}
          className="absolute inset-0 animate-hero-ken-burns motion-reduce:hidden"
          style={{ animationDelay: `${-i * stepSeconds}s` }}
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ))}
      {/* A visitor with prefers-reduced-motion gets no crossfade above —
          this static first frame stands in so the hero still has its
          photo instead of falling back to bare gradient. */}
      <div className="absolute inset-0 hidden motion-reduce:block">
        <Image src={HERO_PHOTOS[0].src} alt="" fill priority sizes="100vw" className="object-cover" />
      </div>
    </div>
  );
}
