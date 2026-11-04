/**
 * Request augmentation for the fields the middleware chain guarantees.
 */
declare global {
  namespace Express {
    interface Request {
      /** Correlation id resolved by `requestIdMiddleware`. */
      requestId: string;
      /** Tenant scope resolved by `requireTenantScope`; absent on unscoped routes. */
      organizationId?: string;
      /** Authenticated caller resolved by `requireAuth`. */
      actor?: import('@gc3/types').AuthActor;
    }
  }
}

export {};
