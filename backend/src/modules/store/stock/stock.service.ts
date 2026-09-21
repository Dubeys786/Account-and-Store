import prisma from '../../../config/db';
import { StockTransactionType } from '@prisma/client';
import {
  calculateDaysHeld,
  getReturnClassification,
  isDamagedCondition,
} from '../../../config/return-rules.config';

export interface IssueStockInput {
  itemId: string;
  storeId: string;
  quantity: number;
  department?: string;
  referenceId?: string;
  notes?: string;
}

export interface ReturnStockInput {
  originalIssueId: string;
  itemId?: string;
  storeId?: string;
  quantity: number;
  returnDate?: string | Date;
  condition?: string;
  returnReason?: string;
  department?: string;
  referenceId?: string;
  notes?: string;
}

export class StockService {
  static async getStockRegister(storeId?: string) {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    const register = await Promise.all(
      items.map(async (item) => {
        const txWhere: any = { itemId: item.id };
        if (storeId) txWhere.storeId = storeId;

        const transactions = await prisma.stockTransaction.findMany({
          where: txWhere,
        });

        let inwardQty = 0;
        let issueQty = 0;
        let returnQty = 0;

        for (const tx of transactions) {
          if (tx.transactionType === StockTransactionType.INWARD) {
            inwardQty += tx.quantity;
          } else if (tx.transactionType === StockTransactionType.ISSUE) {
            issueQty += tx.quantity;
          } else if (tx.transactionType === StockTransactionType.RETURN) {
            // Only returns that entered usable stock affect calculated opening / return quantity
            if (!isDamagedCondition(tx.condition)) {
              returnQty += tx.quantity;
            }
          }
        }

        const calculatedOpening = Math.max(0, item.currentStock - inwardQty + issueQty - returnQty);

        return {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          category: item.category,
          unit: item.unit,
          minStock: item.minStock,
          reorderLevel: item.reorderLevel,
          openingStock: calculatedOpening,
          inward: inwardQty,
          issue: issueQty,
          return: returnQty,
          currentStock: item.currentStock,
          damagedStock: item.damagedStock || 0,
          isLowStock: item.currentStock <= item.reorderLevel,
        };
      })
    );

    return register;
  }

  static async issueStock(data: IssueStockInput) {
    if (data.quantity <= 0) {
      throw new Error('Issue quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: data.itemId } });
      if (!item) throw new Error('Item not found.');

      if (item.currentStock < data.quantity) {
        throw new Error(
          `Insufficient stock: Cannot issue ${data.quantity} ${item.unit}. Available stock is only ${item.currentStock} ${item.unit}.`
        );
      }

      const store = await tx.store.findUnique({ where: { id: data.storeId } });
      if (!store) throw new Error('Store not found.');

      const newStock = item.currentStock - data.quantity;

      // Update item balance
      await tx.item.update({
        where: { id: item.id },
        data: { currentStock: newStock },
      });

      // Log transaction
      const transaction = await tx.stockTransaction.create({
        data: {
          storeId: data.storeId,
          itemId: data.itemId,
          transactionType: StockTransactionType.ISSUE,
          quantity: data.quantity,
          balanceAfter: newStock,
          referenceType: data.department || 'ISSUE_NOTE',
          referenceId: data.referenceId || null,
          notes: data.notes || `Stock issue to ${data.department || 'Production/Ops'}`,
        },
        include: { item: true, store: true },
      });

      return {
        transaction,
        remainingStock: newStock,
      };
    }, { maxWait: 10000, timeout: 20000 });
  }

  static async returnStock(data: ReturnStockInput) {
    if (!data.originalIssueId) {
      throw new Error('Original Issue ID is required to process a return.');
    }
    if (data.quantity <= 0) {
      throw new Error('Return quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Fetch original issue with previous returns
      const originalIssue = await tx.stockTransaction.findUnique({
        where: { id: data.originalIssueId },
        include: {
          returns: true,
          item: true,
          store: true,
        },
      });

      if (!originalIssue) {
        throw new Error('Original Issue transaction not found.');
      }
      if (originalIssue.transactionType !== StockTransactionType.ISSUE) {
        throw new Error('Selected transaction is not a valid Issue transaction.');
      }

      const targetItemId = data.itemId || originalIssue.itemId;
      if (originalIssue.itemId !== targetItemId) {
        throw new Error('Selected item does not match the original issue item.');
      }

      const targetStoreId = data.storeId || originalIssue.storeId;

      // 2. Validate remaining returnable quantity
      const alreadyReturned = originalIssue.returns.reduce((sum, r) => sum + r.quantity, 0);
      const remainingReturnable = originalIssue.quantity - alreadyReturned;

      if (data.quantity > remainingReturnable) {
        throw new Error(
          `Cannot return ${data.quantity} ${originalIssue.item.unit}. Only ${remainingReturnable} remaining returnable out of ${originalIssue.quantity} originally issued.`
        );
      }

      const item = await tx.item.findUnique({ where: { id: targetItemId } });
      if (!item) throw new Error('Item not found.');

      // 3. Calculate Days Held from original issue date
      const returnDateObj = data.returnDate ? new Date(data.returnDate) : new Date();
      const issueDate = originalIssue.createdAt;
      const daysHeld = calculateDaysHeld(issueDate, returnDateObj);

      // 4. Update stock according to condition
      const isDamaged = isDamagedCondition(data.condition);
      let newUsableStock = item.currentStock;
      let newDamagedStock = item.damagedStock || 0;

      if (isDamaged) {
        // Damaged / Defective returns are quarantined: do NOT increment usable stock
        newDamagedStock += data.quantity;
        await tx.item.update({
          where: { id: item.id },
          data: { damagedStock: newDamagedStock },
        });
      } else {
        // Good condition returns restore usable stock
        newUsableStock += data.quantity;
        await tx.item.update({
          where: { id: item.id },
          data: { currentStock: newUsableStock },
        });
      }

      // 5. Create RETURN StockTransaction linked to original issue
      const transaction = await tx.stockTransaction.create({
        data: {
          storeId: targetStoreId,
          itemId: targetItemId,
          transactionType: StockTransactionType.RETURN,
          quantity: data.quantity,
          balanceAfter: newUsableStock,
          referenceType: data.department || originalIssue.referenceType || 'RETURN_SLIP',
          referenceId: data.referenceId || null,
          notes: data.notes || `Stock returned from ${data.department || originalIssue.referenceType || 'Production/Ops'}`,
          originalIssueId: originalIssue.id,
          returnDate: returnDateObj,
          condition: data.condition || 'Good',
          returnReason: data.returnReason || 'Unused Material',
          daysHeld: daysHeld,
        },
        include: { item: true, store: true, originalIssue: true },
      });

      const classification = getReturnClassification(daysHeld);

      return {
        transaction,
        newStock: newUsableStock,
        damagedStock: newDamagedStock,
        daysHeld,
        classification,
        remainingReturnable: remainingReturnable - data.quantity,
      };
    }, { maxWait: 10000, timeout: 20000 });
  }

  static async getOpenIssues(storeId?: string) {
    const where: any = { transactionType: StockTransactionType.ISSUE };
    if (storeId) where.storeId = storeId;

    const issues = await prisma.stockTransaction.findMany({
      where,
      include: {
        item: {
          select: { id: true, code: true, name: true, unit: true, currentStock: true },
        },
        store: { select: { id: true, code: true, name: true } },
        returns: {
          select: { id: true, quantity: true, createdAt: true, returnDate: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return issues
      .map((issue) => {
        const alreadyReturned = issue.returns.reduce((sum, r) => sum + r.quantity, 0);
        const remainingReturnable = Math.max(0, issue.quantity - alreadyReturned);
        return {
          ...issue,
          alreadyReturned,
          remainingReturnable,
        };
      })
      .filter((issue) => issue.remainingReturnable > 0);
  }

  static async getReturnSummary(storeId?: string) {
    const where: any = { transactionType: StockTransactionType.RETURN };
    if (storeId) where.storeId = storeId;

    const returns = await prisma.stockTransaction.findMany({
      where,
      include: {
        originalIssue: true,
        item: { select: { id: true, code: true, name: true, unit: true } },
      },
    });

    let totalReturns = returns.length;
    let totalReturnedQty = 0;
    let recentCount = 0;
    let oldCount = 0;
    let veryOldCount = 0;
    let totalDays = 0;
    let validDaysCount = 0;

    for (const ret of returns) {
      totalReturnedQty += ret.quantity;
      const days =
        ret.daysHeld !== null && ret.daysHeld !== undefined
          ? ret.daysHeld
          : ret.originalIssue
          ? calculateDaysHeld(ret.originalIssue.createdAt, ret.returnDate || ret.createdAt)
          : 0;

      totalDays += days;
      validDaysCount++;

      const classification = getReturnClassification(days);
      if (classification.key === 'RECENT_RETURN') recentCount++;
      else if (classification.key === 'OLD_RETURN') oldCount++;
      else if (classification.key === 'VERY_OLD_RETURN') veryOldCount++;
    }

    const avgDaysHeld = validDaysCount > 0 ? Math.round((totalDays / validDaysCount) * 10) / 10 : 0;

    return {
      totalReturns,
      totalReturnedQty,
      recentCount,
      oldCount,
      veryOldCount,
      avgDaysHeld,
    };
  }

  static async getTransactions(options: { storeId?: string; itemId?: string; type?: StockTransactionType } = {}) {
    const where: any = {};
    if (options.storeId) where.storeId = options.storeId;
    if (options.itemId) where.itemId = options.itemId;
    if (options.type) where.transactionType = options.type;

    const transactions = await prisma.stockTransaction.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, name: true, unit: true, damagedStock: true } },
        store: { select: { id: true, code: true, name: true } },
        originalIssue: {
          select: {
            id: true,
            createdAt: true,
            quantity: true,
            referenceType: true,
            referenceId: true,
            notes: true,
          },
        },
        returns: {
          select: {
            id: true,
            quantity: true,
            createdAt: true,
            returnDate: true,
            daysHeld: true,
            condition: true,
            returnReason: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return transactions.map((tx) => {
      if (tx.transactionType === StockTransactionType.RETURN) {
        const issueDate = tx.originalIssue?.createdAt || tx.createdAt;
        const returnDate = tx.returnDate || tx.createdAt;
        const daysHeld =
          tx.daysHeld !== null && tx.daysHeld !== undefined
            ? tx.daysHeld
            : calculateDaysHeld(issueDate, returnDate);
        const classification = getReturnClassification(daysHeld);

        return {
          ...tx,
          daysHeld,
          classification,
        };
      }
      return tx;
    });
  }
}
