import prisma from '../../../config/db';
import { StockTransactionType } from '@prisma/client';

export interface IssueStockInput {
  itemId: string;
  storeId: string;
  quantity: number;
  department?: string;
  referenceId?: string;
  notes?: string;
}

export interface ReturnStockInput {
  itemId: string;
  storeId: string;
  quantity: number;
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
            returnQty += tx.quantity;
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
    });
  }

  static async returnStock(data: ReturnStockInput) {
    if (data.quantity <= 0) {
      throw new Error('Return quantity must be greater than zero.');
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: data.itemId } });
      if (!item) throw new Error('Item not found.');

      const store = await tx.store.findUnique({ where: { id: data.storeId } });
      if (!store) throw new Error('Store not found.');

      const newStock = item.currentStock + data.quantity;

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
          transactionType: StockTransactionType.RETURN,
          quantity: data.quantity,
          balanceAfter: newStock,
          referenceType: data.department || 'RETURN_SLIP',
          referenceId: data.referenceId || null,
          notes: data.notes || `Stock returned from ${data.department || 'Production/Ops'}`,
        },
        include: { item: true, store: true },
      });

      return {
        transaction,
        newStock,
      };
    });
  }

  static async getTransactions(options: { storeId?: string; itemId?: string; type?: StockTransactionType } = {}) {
    const where: any = {};
    if (options.storeId) where.storeId = options.storeId;
    if (options.itemId) where.itemId = options.itemId;
    if (options.type) where.transactionType = options.type;

    return prisma.stockTransaction.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, name: true, unit: true } },
        store: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
