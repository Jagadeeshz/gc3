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
    }
  }
}

export {};
