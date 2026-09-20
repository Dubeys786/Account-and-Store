import { Request } from 'express';
import { UserRole } from '@prisma/client';
import prisma from '../../config/db';

export class AccountsSecurityError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = 'AccountsSecurityError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AccountsSecurityError.prototype);
  }
}

/**
 * Validates that the authenticated user has access to the specified store.
 * - ADMIN has access to all stores.
 * - ACCOUNT_USER / STORE_USER must have the storeId in their assigned storeIds.
 */
export function validateStoreAccess(req: Request, storeId?: string | null): string | null {
  if (!req.user) {
    throw new AccountsSecurityError('Unauthorized: User is not authenticated.', 401);
  }

  // If no storeId is specified, nothing to validate
  if (!storeId) {
    return null;
  }

  // Admin has global store privileges
  if (req.user.role === UserRole.ADMIN) {
    return storeId;
  }

  if (!req.user.storeIds.includes(storeId)) {
    throw new AccountsSecurityError(
      `Forbidden: You do not have authorization to access data for store '${storeId}'.`,
      403
    );
  }

  return storeId;
}

/**
 * Validates that the party exists and that the user is authorized to access it (IDOR protection).
 * - Verifies party existence in database.
 * - Verifies party store isolation against the user's assigned stores.
 */
export async function validatePartyAccess(req: Request, partyId: string) {
  if (!req.user) {
    throw new AccountsSecurityError('Unauthorized: User is not authenticated.', 401);
  }

  if (!partyId) {
    throw new AccountsSecurityError('Party ID is required.', 400);
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { store: true },
  });

  if (!party) {
    throw new AccountsSecurityError(`Party with ID '${partyId}' not found.`, 404);
  }

  // Check store isolation if party is associated with a specific store
  if (party.storeId && req.user.role !== UserRole.ADMIN) {
    if (!req.user.storeIds.includes(party.storeId)) {
      throw new AccountsSecurityError(
        'Forbidden: You are not authorized to access records for this party.',
        403
      );
    }
  }

  return party;
}

/**
 * Resolves the active store ID for an operation and validates authorization
 */
export function resolveAndValidateStoreId(req: Request, explicitStoreId?: string): string | null {
  const storeId =
    explicitStoreId ||
    (req.headers['x-store-id'] as string) ||
    req.activeStoreId ||
    req.user?.defaultStoreId ||
    req.user?.storeIds[0] ||
    null;

  if (storeId) {
    validateStoreAccess(req, storeId);
  }

  return storeId;
}

/**
 * Validates that the purchase order exists and that the user is authorized to access it (IDOR protection).
 */
export async function validatePOAccess(req: Request, poId: string) {
  if (!req.user) {
    throw new AccountsSecurityError('Unauthorized: User is not authenticated.', 401);
  }

  if (!poId) {
    throw new AccountsSecurityError('Purchase Order ID is required.', 400);
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { store: true },
  });

  if (!po) {
    throw new AccountsSecurityError(`Purchase Order with ID '${poId}' not found.`, 404);
  }

  if (req.user.role !== UserRole.ADMIN && !req.user.storeIds.includes(po.storeId)) {
    throw new AccountsSecurityError(
      'Forbidden: You are not authorized to access this Purchase Order.',
      403
    );
  }

  return po;
}

