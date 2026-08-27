'use client';

import Link from 'next/link';
import { CreatorVideoThumbnail } from './CreatorVideoThumbnail';
import { creatorVideoPosterUrl } from '@/lib/creator-media';
import type { CreatorPost } from '@/lib/types';

export function CreatorPostMedia({ post }: { post: CreatorPost }) {
  const label = `${post.creator.name}'s ${post.mediaType === 'video' ? 'video' : 'photo'} post`;

  return (
    <Link
      href={post.mediaType === 'video' ? post.mediaUrl : post.mediaUrl}
      target={post.mediaType === 'video' ? '_blank' : undefined}
      rel={post.mediaType === 'video' ? 'noopener noreferrer' : undefined}
      className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
      aria-label={`Open ${label}`}
    >
      {post.mediaType === 'video' ? (
        <CreatorVideoThumbnail src={post.mediaUrl} poster={creatorVideoPosterUrl(post.mediaUrl)} label={label} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.mediaUrl} alt={label} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
      )}
    </Link>
  );
}
