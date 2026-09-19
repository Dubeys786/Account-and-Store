import { Request, Response, NextFunction } from 'express';
import { LedgerService } from './ledger.service';
import { validatePartyAccess, AccountsSecurityError } from '../accounts.guard';

export class LedgerController {
  /**
   * GET /api/v1/accounts/parties/:id/ledger
   * Get party sub-ledger statement with debit, credit, and running balances
   */
  static async getPartyLedger(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const partyId = req.params.id;
      await validatePartyAccess(req, partyId);

      const { startDate, endDate } = req.query;
      const ledger = await LedgerService.getPartyLedger(partyId, {
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.status(200).json({
        success: true,
        message: `Party ledger statement retrieved for '${ledger.party.name}'.`,
        data: ledger,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(404).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/accounts/parties/:id/balance
   * Get party balance from backend database
   */
  static async getPartyBalance(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const partyId = req.params.id;
      await validatePartyAccess(req, partyId);

      const balance = await LedgerService.getPartyBalance(partyId);

      res.status(200).json({
        success: true,
        message: 'Party balance retrieved successfully.',
        data: balance,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(404).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/accounts/parties/:id/transactions
   * Get party transactions
   */
  static async getPartyTransactions(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const partyId = req.params.id;
      await validatePartyAccess(req, partyId);

      const { page, limit, type } = req.query;
      const result = await LedgerService.getPartyTransactions(partyId, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        type: type as string,
      });

      res.status(200).json({
        success: true,
        message: 'Party transactions retrieved successfully.',
        data: result.transactions,
        meta: result.pagination,
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      res.status(404).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/accounts/ledger
   * Generic or partyId-based query (backwards-compatible with previous stub)
   */
  static async getGenericLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partyId = req.query.partyId as string;
      if (partyId) {
        await validatePartyAccess(req, partyId);
        const ledger = await LedgerService.getPartyLedger(partyId, {
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
        });
        res.status(200).json({
          success: true,
          message: 'Party Ledger entries retrieved.',
          data: ledger,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Party Ledger statement ready. Provide partyId query parameter.',
        data: {
          partyId: null,
          openingBalance: 0,
          closingBalance: 0,
          entries: [],
        },
      });
    } catch (error: any) {
      if (error instanceof AccountsSecurityError) {
        res.status(error.statusCode).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  }
}
