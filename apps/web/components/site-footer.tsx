import Link from 'next/link';
import { ShieldCheck, Sparkles } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--tradenest-border)] bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2 font-semibold text-[var(--tradenest-navy)]"><ShieldCheck className="size-5" />TradeNest</div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--tradenest-text-secondary)]">A marketplace experience built around protected transactions, explicit financial states, and useful seller intelligence.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--tradenest-navy)]">Marketplace</p>
          <div className="mt-3 grid gap-2 text-sm text-[var(--tradenest-text-secondary)]"><Link href="/explore">Explore products</Link><Link href="/categories">Categories</Link><Link href="/search">Search</Link></div>
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--tradenest-navy)]"><Sparkles className="size-4 text-[var(--tradenest-teal)]" />TradeNest principles</p>
          <p className="mt-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">Prices, inventory, payment success, escrow, and order transitions are verified by the backend—not declared by this interface.</p>
        </div>
      </div>
    </footer>
  );
}
