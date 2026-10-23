import { notFound } from 'next/navigation';
import { RoleWorkflowClient, type E2eFixture } from './role-workflow-client';

// This E2E-only diagnostic route must never be statically prerendered.
export const dynamic = 'force-dynamic';

export default function E2eRoleWorkflowPage() {
  if (process.env.TRADENEST_E2E_UI !== '1') notFound();

  const password = process.env.E2E_SHARED_PASSWORD ?? 'TradeNest-E2E-Only-2026!';
  const fixtures: E2eFixture[] = [
    { role: 'BUYER', email: process.env.E2E_BUYER_EMAIL ?? 'e2e.buyer@tradenest.invalid', password },
    { role: 'SELLER', email: process.env.E2E_SELLER_EMAIL ?? 'e2e.seller@tradenest.invalid', password },
    { role: 'ADMIN', email: process.env.E2E_ADMIN_EMAIL ?? 'e2e.admin@tradenest.invalid', password },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 p-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--tradenest-teal)]">TradeNest E2E</p>
        <h1 className="text-3xl font-semibold text-[var(--tradenest-navy)]">Role workflow verification</h1>
        <p className="max-w-3xl text-[var(--tradenest-text-secondary)]">
          This route exists only when TRADENEST_E2E_UI=1. It verifies browser → Next.js UI → NestJS role boundaries without exposing a production test console.
        </p>
      </div>
      <RoleWorkflowClient fixtures={fixtures} />
    </main>
  );
}
