import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { CatalogGrid } from '@/components/catalog-grid';
import { HomeCategories } from '@/components/home-categories';
import { HomeMarketPreview } from '@/components/home-market-preview';
import { PersonalizedRecommendations } from '@/components/personalized-recommendations';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Find Your Next Great Find',
  description: 'Browse TradeNest products from independent sellers, discover categories, and shop with clear order information.',
};

export default function HomePage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden bg-[var(--tradenest-navy)] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_90%_0%,rgba(15,163,163,0.28),transparent_48%),radial-gradient(ellipse_at_0%_100%,rgba(214,168,75,0.13),transparent_55%)]"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 lg:px-8 lg:py-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
              <ShoppingBag className="size-4 text-[var(--tradenest-gold)]" aria-hidden="true" />
              Welcome to TradeNest
            </p>
            <h1 className="mt-6 max-w-2xl text-[clamp(2.5rem,6vw,4.75rem)] font-semibold leading-[1.08] tracking-[-0.045em]">
              Discover your next <span className="text-[#f3cb78]">great find.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
              Explore products from independent sellers, find something you love, and shop with a clear view of your order.
            </p>

            <form action="/search" method="GET" role="search" className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:py-0">
                <Search className="size-5 shrink-0 text-[var(--tradenest-teal-ink)]" aria-hidden="true" />
                <label htmlFor="home-product-search" className="sr-only">Search products</label>
                <input
                  id="home-product-search"
                  name="q"
                  type="search"
                  maxLength={200}
                  placeholder="What are you looking for?"
                  className="min-h-10 w-full min-w-0 bg-transparent text-base text-[var(--tradenest-navy)] placeholder:text-[var(--tradenest-placeholder)] focus:outline-none"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto">Search products <ArrowRight className="size-4" aria-hidden="true" /></Button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <Link href="/explore" className="inline-flex min-h-11 items-center gap-2 font-semibold text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white">
                Browse all products <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/categories" className="inline-flex min-h-11 items-center gap-2 text-slate-200 hover:text-white">
                Explore categories <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <HomeMarketPreview />
        </div>
      </section>

      <section className="border-b border-[var(--tradenest-border)] bg-white" aria-label="Shopping information">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 text-sm text-[var(--tradenest-text-secondary)] sm:grid-cols-3 sm:gap-8 sm:px-6 lg:px-8">
          <div className="flex items-start gap-2.5"><Compass className="mt-0.5 size-5 shrink-0 text-[var(--tradenest-teal-ink)]" aria-hidden="true" /><span>Discover listings from marketplace sellers</span></div>
          <div className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--tradenest-teal-ink)]" aria-hidden="true" /><span>Stock and pricing checked again at checkout</span></div>
          <div className="flex items-start gap-2.5"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--tradenest-teal-ink)]" aria-hidden="true" /><span>Order and payment statuses based on server records</span></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8" aria-labelledby="home-categories-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tradenest-teal-ink)]">Find your corner</p>
            <h2 id="home-categories-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-3xl">Shop by category</h2>
          </div>
          <Link href="/categories" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--tradenest-blue)] hover:underline">All categories <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <HomeCategories />
      </section>

      <PersonalizedRecommendations />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="home-products-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tradenest-teal-ink)]">Start exploring</p>
            <h2 id="home-products-title" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-3xl">See what&apos;s in store</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tradenest-text-secondary)]">Browse products currently listed on TradeNest. Open a listing for details before adding it to your cart.</p>
          </div>
          <Link href="/explore" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--tradenest-blue)] hover:underline">Explore marketplace <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <CatalogGrid pageSize={8} showCategoryFilter={false} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8" aria-labelledby="home-seller-title">
        <div className="flex flex-col gap-6 rounded-[var(--tradenest-radius-card)] border border-[var(--tradenest-border)] bg-white px-5 py-7 sm:px-8 sm:py-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--tradenest-gold-light)] text-[var(--tradenest-gold-ink)]"><Store className="size-6" aria-hidden="true" /></div>
            <div>
              <h2 id="home-seller-title" className="text-xl font-semibold text-[var(--tradenest-navy)] sm:text-2xl">Already selling on TradeNest?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--tradenest-text-secondary)]">Open your seller workspace to manage products, inventory, and customer orders.</p>
            </div>
          </div>
          <Button variant="outline" size="lg" asChild><Link href="/seller">Seller workspace <ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
        </div>
      </section>
    </main>
  );
}
