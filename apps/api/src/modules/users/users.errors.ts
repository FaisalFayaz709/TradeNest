export class AccountDeletionBlockedRepositoryError extends Error {
  constructor() {
    super('Account deletion is blocked by protected marketplace history.');
  }
}
