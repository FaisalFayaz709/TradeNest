import type { UserRole, UserStatus } from '@tradenest/contracts/users';

export interface UserProfileRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressRecord {
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
  createdAt: Date;
  updatedAt: Date;
}


export interface WishlistItemRecord {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
}
