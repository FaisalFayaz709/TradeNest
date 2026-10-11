export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type ApiErrorShape = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ProductImage = {
  id: string;
  productId: string;
  objectKey: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  sku: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED';
  availableQuantity: number;
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
};

export type Cart = {
  id: string;
  userId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

export type Address = {
  id: string;
  userId: string;
  label: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutQuoteItem = {
  productId: string;
  sellerId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type CheckoutQuote = {
  cartId: string;
  sellerId: string;
  currency: string;
  items: CheckoutQuoteItem[];
  subtotalAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  inventoryReserved: false;
};

export type CheckoutCreated = {
  order: {
    id: string;
    orderNumber: string;
    status: 'PENDING_PAYMENT';
    currency: string;
    subtotalAmount: string;
    shippingAmount: string;
    discountAmount: string;
    totalAmount: string;
    items: Array<CheckoutQuoteItem & { totalPrice: string }>;
  };
  payment: {
    id: string;
    status: 'PENDING';
    amount: string;
    currency: string;
  };
  inventoryReserved: true;
  cartClosed: true;
};

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'REFUNDED';

export type OrderSummary = {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: OrderStatus;
  currency: string;
  subtotal: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Order = OrderSummary & {
  shippingAddress: {
    sourceAddressId: string;
    recipient: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
    phone: string | null;
  };
  items: Array<{
    id: string;
    productId: string;
    sellerId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    createdAt: string;
  }>;
};

export type WishlistItem = {
  id: string;
  productId: string;
  createdAt: string;
};

export type Payment = {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  amount: string;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Escrow = {
  id: string;
  orderId: string;
  paymentId: string;
  status: 'PENDING' | 'HELD' | 'SELLER_SHIPPED' | 'BUYER_CONFIRMED' | 'RELEASED' | 'DISPUTED' | 'UNDER_REVIEW' | 'REFUNDED';
  amount: string;
  heldAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  transactions: Array<{
    id: string;
    type: 'HOLD' | 'RELEASE' | 'REFUND' | 'ADJUSTMENT';
    amount: string;
    reference: string | null;
    createdAt: string;
  }>;
};

export type Shipment = {
  id: string;
  orderId: string;
  carrier: string;
  trackingCode: string;
  status: 'SHIPPED' | 'DELIVERED';
  shippedAt: string;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Review = {
  id: string;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Dispute = {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  resolution: 'REFUND_BUYER' | 'RELEASE_TO_SELLER' | null;
  resolvedBy: string | null;
  openedAt: string;
  resolvedAt: string | null;
  updatedAt: string;
  messages: Array<{ id: string; disputeId: string; authorId: string; body: string; createdAt: string }>;
  evidence: Array<{
    id: string;
    disputeId: string;
    uploadedById: string;
    objectKey: string;
    url: string;
    fileName: string | null;
    mimeType: string | null;
    createdAt: string;
  }>;
};

export type SellerProfile = {
  userId: string;
  storeName: string;
  slug: string;
  status: string;
  rating: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerDashboard = { profile: SellerProfile };

export type Inventory = {
  productId: string;
  availableQuantity: number;
  reservedQuantity: number;
  updatedAt: string;
};

export type SellerAnalyticsMoney = { currency: string; amount: string };
export type SellerAnalytics = {
  generatedAt: string;
  lowStockThreshold: number;
  kpis: {
    orderCount: number;
    productsSold: number;
    conversionRatePercent: number | null;
    revenueByCurrency: SellerAnalyticsMoney[];
    averageOrderValueByCurrency: SellerAnalyticsMoney[];
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    unitsSold: number;
    revenueByCurrency: SellerAnalyticsMoney[];
  }>;
  lowStockProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    availableQuantity: number;
    reservedQuantity: number;
  }>;
  orderStatusDistribution: Array<{ status: OrderStatus; count: number }>;
  escrowByStatus: Array<{
    status: Escrow['status'];
    currency: string;
    count: number;
    amount: string;
  }>;
};

export type SmartPricingSuggestion = {
  productId: string;
  currency: string;
  currentPrice: string;
  suggestedRange: { minPrice: string; maxPrice: string };
  signals: {
    productViews: number;
    addToCartEvents: number;
    completedOrders: number;
    completedUnitsSold: number;
    conversionRatePercent: number | null;
    comparableProductCount: number;
    comparableMedianPrice: string | null;
  };
  advisory: true;
  modelVersion: string;
  generatedAt: string;
};


export type AdminDashboard = {
  counts: { users: number; sellers: number; products: number; orders: number; payments: number; escrows: number; disputes: number; recentFraudAlerts: number };
  openDisputes: number;
  recentHighRiskAlerts: number;
};

export type AdminSellerSummary = SellerProfile;

export type FraudAlert = {
  id: string;
  userId: string | null;
  orderId: string | null;
  paymentId: string | null;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: Array<{ code: string; message: string; contribution: number }>;
  reviewRecommended: boolean;
  modelVersion: string;
  createdAt: string;
};
