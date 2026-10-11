export interface SellerProfileRecord {
  userId: string;
  storeName: string;
  slug: string;
  status: string;
  rating: { toString(): string } | null;
  createdAt: Date;
  updatedAt: Date;
}
