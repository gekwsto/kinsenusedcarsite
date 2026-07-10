/**
 * Base class for domain errors that carry their own intended HTTP status,
 * so handleApiError() can map them generically instead of needing a new
 * `instanceof` branch for every new error class.
 */
export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}
