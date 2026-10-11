import Link from 'next/link';
import { ArrowRight, BadgeCheck, BrainCircuit, ShieldCheck, WalletCards } from 'lucide-react';
import { CatalogGrid } from '@/components/catalog-grid';
import { PersonalizedRecommendations } from '@/components/personalized-recommendations';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-[var(--tradenest-border)] bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(15,163,163,0.12),transparent_32%),radial-gradient(circle_at_15%_90%,rgba(214,168,75,0.12),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--tradenest-teal-light)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-teal-800"><BrainCircuit className="size-4" />AI-powered marketplace</div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[var(--tradenest-navy)] sm:text-5xl lg:text-6xl">Shop with clarity. Trade with protected money flow.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--tradenest-text-secondary)] sm:text-lg">TradeNest combines a modern marketplace with backend-controlled checkout, escrow visibility, and recommendation intelligence—without asking the browser to decide financial truth.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/explore"><Button size="lg">Explore marketplace<ArrowRight className="size-4" /></Button></Link><Link href="/auth/register"><Button size="lg" variant="outline">Create buyer account</Button></Link></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <TrustCard icon={ShieldCheck} eyebrow="Escrow" title="Protected transaction states" body="Payment, order, and escrow move through explicit backend state machines." tone="gold" />
            <TrustCard icon={BadgeCheck} eyebrow="Verified" title="Backend-authoritative checkout" body="Stock, seller status, prices, and totals are revalidated at checkout." tone="navy" />
            <TrustCard icon={BrainCircuit} eyebrow="AI" title="Useful recommendations" body="Behavior signals can improve discovery while critical business data remains untouched." tone="teal" />
            <TrustCard icon={WalletCards} eyebrow="Money" title="No browser-declared success" body="Only verified provider state can establish a successful payment." tone="navy" />
          </div>
        </div>
      </section>

      <PersonalizedRecommendations />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--tradenest-teal)]">Marketplace</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-3xl">Discover active products</h2></div><Link href="/explore" className="hidden text-sm font-semibold text-[var(--tradenest-blue)] sm:inline">View all products →</Link></div>
        <CatalogGrid pageSize={8} showCategoryFilter={false} />
      </section>
    </main>
  );
}

function TrustCard({ icon: Icon, eyebrow, title, body, tone }: { icon: typeof ShieldCheck; eyebrow: string; title: string; body: string; tone: 'gold' | 'teal' | 'navy' }) {
  const backgrounds = { gold: 'bg-[var(--tradenest-gold-light)]', teal: 'bg-[var(--tradenest-teal-light)]', navy: 'bg-slate-50' };
  return <div className={`rounded-[var(--tradenest-radius-card)] border border-white/70 p-6 shadow-[0_15px_50px_rgba(11,42,74,0.08)] ${backgrounds[tone]}`}><div className="flex size-11 items-center justify-center rounded-xl bg-white text-[var(--tradenest-navy)] shadow-sm"><Icon className="size-5" /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--tradenest-text-secondary)]">{eyebrow}</p><h3 className="mt-1 text-lg font-semibold text-[var(--tradenest-navy)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{body}</p></div>;
}
