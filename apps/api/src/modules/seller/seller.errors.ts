export class SellerProfileAlreadyExistsRepositoryError extends Error {
  constructor() {
    super('Seller profile already exists.');
    this.name = 'SellerProfileAlreadyExistsRepositoryError';
  }
}
