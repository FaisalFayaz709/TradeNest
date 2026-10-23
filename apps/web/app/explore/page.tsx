import { Suspense } from 'react';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { ExploreQueryGrid } from './explore-query';

export default function ExplorePage() {
  return (
    <PageShell eyebrow="The marketplace" title="Explore products" description="Find something you love from the live TradeNest catalog. Browse by category or search for a particular item.">
      <Suspense fallback={<LoadingState label="Loading marketplace…" />}>
        <ExploreQueryGrid />
      </Suspense>
    </PageShell>
  );
}
