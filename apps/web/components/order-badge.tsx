import type { OrderStatus } from '@/lib/api-types';
import { Badge } from './ui/badge';

export function OrderBadge({ status }: { status: OrderStatus }) {
  const tone = status === 'COMPLETED'
    ? 'success'
    : status === 'CANCELLED' || status === 'REFUNDED'
      ? 'danger'
      : status === 'DISPUTED' || status === 'PENDING_PAYMENT'
        ? 'warning'
        : 'escrow';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}
