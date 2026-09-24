import prisma from '../../../config/db';
import { UserRole } from '@prisma/client';
import { AccountsSecurityError } from '../accounts.guard';

export type ContraTransferType = 'CASH_TO_BANK' | 'BANK_TO_CASH' | 'BANK_TO_BANK';

export interface CreateContraTransferInput {
  transferType: ContraTransferType;
  amount: number;
  fromAccountId?: string;
  toAccountId?: string;
  transferDate?: string | Date;
  storeId?: string;
  referenceNumber?: string;
  narration?: string;
}

export class ContraTransferService {
  /**
   * Helper to generate voucher number for Contra Transfer
   */
  private static generateEntryNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const time = Date.now().toString().slice(-4);
    return `CNTR-${today}-${time}${rand}`;
  }

  /**
   * Post a real Contra Transfer between Cash and Bank accounts
   * Both sides are Balance Sheet ASSET accounts — zero impact on Income/Expense!
   */
  static async createTransfer(
    user: { id: string; role: UserRole; storeIds: string[] },
    input: CreateContraTransferInput
  ) {
    if (!user || !user.id) {
      throw new AccountsSecurityError('Unauthorized: User credentials required.', 401);
    }
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNT_USER) {
      throw new AccountsSecurityError(
        `Forbidden: Role '${user.role}' is not authorized to post Contra Transfers.`,
        403
      );
    }

    const amount = Number(input.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Transfer amount must be a positive number greater than 0.');
    }

    // Resolve storeId
    let storeId = input.storeId?.trim() || null;
    if (storeId && user.role !== UserRole.ADMIN && !user.storeIds.includes(storeId)) {
      throw new AccountsSecurityError(`Forbidden: Store access denied for '${storeId}'.`, 403);
    }
    if (!storeId && user.role !== UserRole.ADMIN && user.storeIds.length > 0) {
      storeId = user.storeIds[0];
    }

    // Get liquid accounts
    const cashAccount = await prisma.ledgerAccount.upsert({
      where: { code: '1010' },
      update: {},
      create: {
        code: '1010',
        name: 'Cash on Hand',
        group: 'ASSET',
        balanceType: 'DEBIT',
        isSystem: true,
        description: 'Physical Cash in Hand ledger account',
      },
    });

    const defaultBankAccount = await prisma.ledgerAccount.upsert({
      where: { code: '1020' },
      update: {},
      create: {
        code: '1020',
        name: 'Operating Bank Account',
        group: 'ASSET',
        balanceType: 'DEBIT',
        isSystem: true,
        description: 'Primary Operating Bank Ledger Account',
      },
    });

    let debitAccountId: string;
    let creditAccountId: string;
    let defaultNarration = '';

    if (input.transferType === 'CASH_TO_BANK') {
      // Cash deposited to Bank: Dr Bank, Cr Cash
      debitAccountId = input.toAccountId || defaultBankAccount.id;
      creditAccountId = cashAccount.id;
      defaultNarration = `Cash deposited into Bank (${input.referenceNumber || 'Counter Deposit'})`;
    } else if (input.transferType === 'BANK_TO_CASH') {
      // Cash withdrawn from Bank: Dr Cash, Cr Bank
      debitAccountId = cashAccount.id;
      creditAccountId = input.fromAccountId || defaultBankAccount.id;
      defaultNarration = `Cash withdrawn from Bank (${input.referenceNumber || 'Self Cheque / ATM'})`;
    } else if (input.transferType === 'BANK_TO_BANK') {
      // Bank to Bank transfer
      if (!input.fromAccountId || !input.toAccountId) {
        throw new Error('Source and destination bank accounts are required for Bank to Bank transfer.');
      }
      if (input.fromAccountId === input.toAccountId) {
        throw new Error('Source and destination bank accounts cannot be the same.');
      }
      debitAccountId = input.toAccountId;
      creditAccountId = input.fromAccountId;
      defaultNarration = `Inter-bank funds transfer (${input.referenceNumber || 'NEFT / RTGS / IMPS'})`;
    } else {
      throw new Error(`Invalid transfer type: ${input.transferType}`);
    }

    // Verify both accounts exist and belong to ASSET group
    const [drAccount, crAccount] = await Promise.all([
      prisma.ledgerAccount.findUnique({ where: { id: debitAccountId } }),
      prisma.ledgerAccount.findUnique({ where: { id: creditAccountId } }),
    ]);

    if (!drAccount || !crAccount) {
      throw new Error('One or both selected accounts do not exist in the chart of accounts.');
    }

    if (drAccount.group !== 'ASSET' || crAccount.group !== 'ASSET') {
      throw new Error('Contra transfers must only be performed between ASSET accounts (Cash/Bank).');
    }

    const entryNumber = this.generateEntryNumber();
    const entryDate = input.transferDate ? new Date(input.transferDate) : new Date();
    const narration = (input.narration || defaultNarration).trim();

    // Execute atomic journal entry creation
    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate,
        referenceType: 'CONTRA',
        referenceId: input.referenceNumber || null,
        storeId,
        narration,
        totalAmount: amount,
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debitAmount: amount,
              creditAmount: 0,
              description: `[CONTRA DEBIT] Transfer to ${drAccount.name} (${drAccount.code})`,
            },
            {
              accountId: creditAccountId,
              debitAmount: 0,
              creditAmount: amount,
              description: `[CONTRA CREDIT] Transfer from ${crAccount.name} (${crAccount.code})`,
            },
          ],
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, group: true } },
          },
        },
        store: { select: { id: true, code: true, name: true } },
      },
    });

    return {
      success: true,
      message: 'Contra transfer posted successfully.',
      transfer: {
        id: journalEntry.id,
        entryNumber: journalEntry.entryNumber,
        entryDate: journalEntry.entryDate,
        transferType: input.transferType,
        amount,
        fromAccount: { id: crAccount.id, code: crAccount.code, name: crAccount.name },
        toAccount: { id: drAccount.id, code: drAccount.code, name: drAccount.name },
        narration,
        storeId,
      },
    };
  }
}
