import { Suspense } from 'react';
import { LoadingState } from '@/components/loading-state';
import SearchClient from './search-client';

export default function SearchPage() {
  return <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><LoadingState label="Loading search…" /></main>}><SearchClient /></Suspense>;
}
