import type { ApiErrorCode } from '@gc3/types';

/**
 * Typed transport error. Every failure the API emits deliberately is one of
 * these, so the error handler can build the response envelope without guessing.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: readonly { path: string; message: string }[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: readonly { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: readonly { path: string; message: string }[]) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Authentication is required') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static tenantScopeRequired(message = 'Tenant scope is required') {
    return new ApiError(400, 'TENANT_SCOPE_REQUIRED', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  /** The request is well-formed but the current state forbids it (409). */
  static conflict(message = 'The current state does not allow this') {
    return new ApiError(409, 'CONFLICT', message);
  }

  static notImplemented(message = 'Not implemented yet') {
    return new ApiError(501, 'NOT_IMPLEMENTED', message);
  }

  /** Invitation token unknown, already used, or belonging to a revoked membership. */
  static inviteInvalid(message = 'This invitation is not valid') {
    return new ApiError(400, 'INVITE_INVALID', message);
  }

  /** Invitation existed but its acceptance window has closed (410 Gone). */
  static inviteExpired(message = 'This invitation has expired') {
    return new ApiError(410, 'INVITE_EXPIRED', message);
  }

  /**
   * The tenant's plan does not allow any more of this resource (403).
   *
   * Not a payment error and not a permission error: the caller is allowed to do
   * this in principle, but the subscription has no allowance left. The details
   * name the meter, what is used and what the plan includes, so the client can
   * show an upgrade prompt instead of a mystery failure.
   */
  static limitExceeded(input: {
    meter: string;
    used: number;
    limit: number;
    unit: string;
    tierCode: string;
  }) {
    return new ApiError(
      403,
      'LIMIT_EXCEEDED',
      `The ${input.tierCode} plan allows ${input.limit.toLocaleString('en-IN')} ${input.unit} — ${input.used.toLocaleString('en-IN')} used. Upgrade the plan to continue.`,
      [
        { path: 'meter', message: input.meter },
        { path: 'used', message: String(input.used) },
        { path: 'limit', message: String(input.limit) },
        { path: 'tier', message: input.tierCode },
      ],
    );
  }
}
