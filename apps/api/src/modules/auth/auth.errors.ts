export class DuplicateEmailRepositoryError extends Error {
  constructor() {
    super('Email already exists.');
  }
}
