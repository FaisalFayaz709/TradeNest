export class CatalogDeleteBlockedRepositoryError extends Error {
  constructor() {
    super('Catalog record deletion is blocked by related records.');
    this.name = 'CatalogDeleteBlockedRepositoryError';
  }
}
