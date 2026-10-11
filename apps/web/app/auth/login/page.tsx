import { Suspense } from 'react';
import { LoadingState } from '@/components/loading-state';
import LoginClient from './login-client';

export default function LoginPage() {
  return <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><LoadingState label="Loading sign in…" /></main>}><LoginClient /></Suspense>;
}
