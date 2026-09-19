import prisma from '../../../config/db';
import { POStatus } from '@prisma/client';

export class StoreDashboardService {
  static async getDashboardMetrics(storeId?: string) {
    const itemWhere: any = { isActive: true };
    const poWhere: any = {};
    const inwardWhere: any = {};

    if (storeId) {
      poWhere.storeId = storeId;
      inwardWhere.storeId = storeId;
    }

    // 1. Total Items
    const totalItems = await prisma.item.count({ where: itemWhere });

    // 2. Active Purchase Orders
    const purchaseOrders = await prisma.purchaseOrder.count({
      where: {
        ...poWhere,
        status: { in: [POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED, POStatus.PENDING] },
      },
    });

    // 3. Material Inwards
    const materialInwards = await prisma.materialInward.count({
      where: inwardWhere,
    });

    // 4. Total Available Stock
    const allItems = await prisma.item.findMany({
      where: itemWhere,
      select: { currentStock: true, reorderLevel: true },
    });

    const totalAvailableStock = allItems.reduce((sum, itm) => sum + (itm.currentStock || 0), 0);

    // 5. Low / Out of Stock Count
    const lowStockCount = allItems.filter((itm) => itm.currentStock <= itm.reorderLevel).length;

    // 6. Outstanding Payables (from accounting transactions or ledger balance)
    const unpaidInvoices = await prisma.accountingTransaction.findMany({
      where: { paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      select: { netAmount: true, paidAmount: true },
    });

    const outstandingBalance = unpaidInvoices.reduce(
      (acc, inv) => acc + (inv.netAmount - inv.paidAmount),
      0
    );

    // 7. Recent Transactions Feed
    const [recentPOs, recentInwards, recentTransactions] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: poWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { party: true, items: { include: { item: true } } },
      }),
      prisma.materialInward.findMany({
        where: inwardWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { party: true, purchaseOrder: true },
      }),
      prisma.stockTransaction.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { item: true, store: true },
      }),
    ]);

    return {
      kpiCards: {
        totalItems,
        purchaseOrders,
        materialInwards,
        totalAvailableStock: Math.round(totalAvailableStock * 100) / 100,
        outstandingBalance: Math.round(outstandingBalance * 100) / 100,
        lowStockCount,
      },
      recentPOs,
      recentInwards,
      recentTransactions,
    };
  }
}
