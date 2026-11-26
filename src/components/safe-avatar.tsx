'use client';

import { useState } from 'react';

export default function SafeAvatar({
  src,
  alt = '',
  initials,
  className = '',
}: {
  src: string | null | undefined;
  alt?: string;
  initials: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return <span className={className}>{initials}</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
