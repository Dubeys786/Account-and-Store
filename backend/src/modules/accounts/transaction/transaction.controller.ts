import { Request, Response, NextFunction } from 'express';
import { TransactionService } from './transaction.service';
import { validateStoreAccess, validatePartyAccess, AccountsSecurityError } from '../accounts.guard';
import { UserRole } from '@prisma/client';

export class TransactionController {
  /**
   * POST /api/v1/accounts/transactions
   * Create an accounting transaction with double-entry journal linkage
   */
  static async createTransaction(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { storeId, partyId } = req.body;

      // 1. Verify Store Access
      validateStoreAccess(req, storeId);

      // 2. Verify Party Access (IDOR protection)
      await validatePartyAccess(req, partyId);

      const transaction = await TransactionService.createTransaction(req.body);
      res.status(201).json({
        success: true,
        message: 'Accounting transaction and balanced journal voucher posted successfully.',
        data: transaction,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/accounts/transactions
   * Query transactions with filters
   */
  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { storeId, partyId, type, transactionType, paymentStatus, startDate, endDate, page, limit } =
        req.query;

      if (storeId) {
        validateStoreAccess(req, storeId as string);
      }

      const result = await TransactionService.getTransactions({
        storeId: (storeId as string) || (req.user?.role !== UserRole.ADMIN ? req.user?.defaultStoreId || undefined : undefined),
        partyId: partyId as string,
        type: type as string,
        transactionType: transactionType as string,
        paymentStatus: paymentStatus as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        message: 'Accounting transactions retrieved successfully.',
        data: result.transactions,
        meta: result.pagination,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/transactions/:id
   * Get single transaction by ID
   */
  static async getTransactionById(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const transaction = await TransactionService.getTransactionById(req.params.id);

      // Verify store access to transaction's store
      validateStoreAccess(req, transaction.storeId);

      res.status(200).json({
        success: true,
        message: 'Transaction details retrieved successfully.',
        data: transaction,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(404).json({ success: false, message: error.message });
    }
  }
}
