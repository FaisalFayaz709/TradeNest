'use client';

import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import type { ProductImage } from '@/lib/api-types';

type ProductGalleryProps = {
  productName: string;
  images: ProductImage[];
};

/** Seller-hosted images remain unoptimized until their approved media hosts are configured. */
export function ProductGallery({ productName, images }: ProductGalleryProps) {
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const primary = sortedImages.find((image) => image.isPrimary) ?? sortedImages[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sortedImages.find((image) => image.id === selectedId) ?? primary;
  const selectedIndex = sortedImages.findIndex((image) => image.id === selected?.id);

  return (
    <section aria-label={`${productName} photo gallery`} className="min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-slate-100 sm:aspect-square">
        {selected ? (
          <Image
            key={selected.id}
            src={selected.url}
            alt={`${productName} — photo ${selectedIndex + 1} of ${sortedImages.length}`}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, (min-width: 640px) 80vw, 100vw"
            unoptimized
            className="object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 to-slate-200 text-[var(--tradenest-text-secondary)]">
            <ImageOff className="size-10" aria-hidden="true" />
            <p className="text-sm font-medium">Photos coming soon</p>
          </div>
        )}
        {sortedImages.length > 1 ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-[var(--tradenest-navy)]/90 px-3 py-1 text-xs font-semibold text-white" aria-live="polite">
            {selectedIndex + 1} / {sortedImages.length} photos
          </span>
        ) : null}
      </div>
      {sortedImages.length > 1 ? (
        <div className="mt-3 flex max-w-full gap-3 overflow-x-auto pb-2" aria-label="Choose a product photo">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Show photo ${index + 1} of ${sortedImages.length}`}
              aria-pressed={selected?.id === image.id}
              onClick={() => setSelectedId(image.id)}
              className="relative size-20 shrink-0 overflow-hidden rounded-xl border-2 border-[var(--tradenest-border)] bg-slate-100 transition hover:border-[var(--tradenest-teal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)] aria-pressed:border-[var(--tradenest-teal)] sm:size-24"
            >
              <Image src={image.url} alt="" fill sizes="96px" unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
