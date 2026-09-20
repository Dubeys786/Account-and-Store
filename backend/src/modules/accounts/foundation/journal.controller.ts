import { Request, Response, NextFunction } from 'express';
import { JournalService } from './journal.service';

import { AuditService } from '../../audit/audit.service';

export class JournalController {
  /**
   * POST /api/v1/accounts/journal-entries
   * Create a double-entry balanced journal voucher
   */
  static async createJournalEntry(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const entry = await JournalService.createJournalEntry(req.body);

      await AuditService.record({
        userId: req.user?.id,
        action: 'JOURNAL',
        entity: 'JournalEntry',
        entityId: entry.id,
        newValues: { entryNumber: entry.entryNumber, totalAmount: entry.totalAmount, narration: entry.narration },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({
        success: true,
        message: 'Journal entry posted successfully. Total debit equals total credit.',
        data: entry,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/v1/accounts/journal-entries
   * List journal entries with filters and pagination
   */
  static async getJournalEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { referenceType, referenceId, startDate, endDate, page, limit } = req.query;
      const result = await JournalService.getJournalEntries({
        referenceType: referenceType as string,
        referenceId: referenceId as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        message: 'Journal entries retrieved successfully.',
        data: result.entries,
        meta: result.pagination,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * GET /api/v1/accounts/journal-entries/:id
   * Get single journal entry by ID
   */
  static async getJournalEntryById(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const entry = await JournalService.getJournalEntryById(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Journal entry retrieved successfully.',
        data: entry,
      });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/v1/accounts/ledger-accounts
   * Chart of accounts
   */
  static async getLedgerAccounts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await JournalService.getLedgerAccounts();
      res.status(200).json({
        success: true,
        message: 'Chart of accounts retrieved.',
        data: accounts,
      });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * POST /api/v1/accounts/ledger-accounts
   * Create account in chart of accounts
   */
  static async createLedgerAccount(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const account = await JournalService.createLedgerAccount(req.body);
      res.status(201).json({
        success: true,
        message: 'Ledger account created successfully.',
        data: account,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
