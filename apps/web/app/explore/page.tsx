import { Suspense } from 'react';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { ExploreQueryGrid } from './explore-query';

export default function ExplorePage() {
  return <PageShell eyebrow="Public marketplace" title="Explore TradeNest" description="Browse active listings. Availability and prices shown here are catalog information; checkout revalidates current stock and authoritative totals."><Suspense fallback={<LoadingState label="Loading marketplace…" />}><ExploreQueryGrid /></Suspense></PageShell>;
}
