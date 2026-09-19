import prisma from '../../../config/db';
import { POStatus, StockTransactionType } from '@prisma/client';

export class StoreReportsService {
  static async getStockValuation() {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      include: {
        poItems: {
          take: 1,
          orderBy: { id: 'desc' },
          select: { rate: true },
        },
      },
    });

    let totalValuation = 0;

    const report = items.map((item) => {
      const unitRate = item.poItems[0]?.rate || 150; // Fallback unit rate
      const totalValue = item.currentStock * unitRate;
      totalValuation += totalValue;

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
        estimatedRate: unitRate,
        totalValuation: Math.round(totalValue * 100) / 100,
      };
    });

    return {
      summary: {
        totalItems: items.length,
        totalStockValuation: Math.round(totalValuation * 100) / 100,
      },
      details: report,
    };
  }

  static async getItemConsumption() {
    const issues = await prisma.stockTransaction.findMany({
      where: { transactionType: StockTransactionType.ISSUE },
      include: { item: true },
    });

    const consumptionMap = new Map<string, { item: any; totalIssued: number; count: number }>();

    for (const tx of issues) {
      const existing = consumptionMap.get(tx.itemId) || { item: tx.item, totalIssued: 0, count: 0 };
      existing.totalIssued += tx.quantity;
      existing.count += 1;
      consumptionMap.set(tx.itemId, existing);
    }

    return Array.from(consumptionMap.values()).map((val) => ({
      itemCode: val.item.code,
      itemName: val.item.name,
      category: val.item.category,
      unit: val.item.unit,
      totalIssued: val.totalIssued,
      issueTransactionsCount: val.count,
    }));
  }

  static async getPendingPOs() {
    return prisma.purchaseOrder.findMany({
      where: {
        status: { in: [POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED] },
      },
      include: {
        party: true,
        items: { include: { item: true } },
      },
      orderBy: { poDate: 'asc' },
    });
  }

  static async getSupplierRejectionReport() {
    const inwardItems = await prisma.materialInwardItem.findMany({
      include: {
        materialInward: { include: { party: true } },
        item: true,
      },
    });

    const supplierMap = new Map<string, { supplier: any; received: number; rejected: number; accepted: number }>();

    for (const line of inwardItems) {
      const party = line.materialInward.party;
      const existing = supplierMap.get(party.id) || {
        supplier: party,
        received: 0,
        rejected: 0,
        accepted: 0,
      };

      existing.received += line.receivedQty;
      existing.rejected += line.rejectedQty;
      existing.accepted += line.acceptedQty;
      supplierMap.set(party.id, existing);
    }

    return Array.from(supplierMap.values()).map((s) => ({
      supplierCode: s.supplier.code,
      supplierName: s.supplier.name,
      totalReceived: s.received,
      totalRejected: s.rejected,
      totalAccepted: s.accepted,
      rejectionRatePercent: s.received > 0 ? Math.round((s.rejected / s.received) * 10000) / 100 : 0,
    }));
  }
}
