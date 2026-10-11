# Seller contracts

This contract surface activates the blueprint-reserved seller contract namespace.

Concrete contracts in this document cover only the seller onboarding/profile/dashboard surface explicitly assigned to this contract surface:

- onboarding accepts a `storeName`;
- profile update accepts a `storeName`;
- the backend derives and owns the stable seller slug;
- seller status remains an open string contract because the blueprint does not define the full status vocabulary;
- dashboard is a minimal seller summary containing the seller profile only; order/product/analytics data is exposed through dedicated contracts and endpoints.

Business authorization (SELLER role, ACTIVE-seller policy) remains in NestJS services/guards, not Zod.
