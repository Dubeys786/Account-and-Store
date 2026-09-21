import prisma from '../../../config/db';
import { POStatus, StockTransactionType } from '@prisma/client';
import {
  calculateDaysHeld,
  getReturnClassification,
} from '../../../config/return-rules.config';

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

  static async getReturnAgeReport(storeId?: string) {
    const where: any = { transactionType: StockTransactionType.RETURN };
    if (storeId) where.storeId = storeId;

    const returns = await prisma.stockTransaction.findMany({
      where,
      include: {
        item: true,
        store: true,
        originalIssue: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalReturns = returns.length;
    let totalReturnedQty = 0;
    let recentCount = 0;
    let oldCount = 0;
    let veryOldCount = 0;
    let totalDays = 0;
    let validDaysCount = 0;

    const records = returns.map((ret) => {
      const issueDate = ret.originalIssue?.createdAt || ret.createdAt;
      const returnDate = ret.returnDate || ret.createdAt;
      const daysHeld =
        ret.daysHeld !== null && ret.daysHeld !== undefined
          ? ret.daysHeld
          : calculateDaysHeld(issueDate, returnDate);

      totalReturnedQty += ret.quantity;
      totalDays += daysHeld;
      validDaysCount++;

      const classification = getReturnClassification(daysHeld);
      if (classification.key === 'RECENT_RETURN') recentCount++;
      else if (classification.key === 'OLD_RETURN') oldCount++;
      else if (classification.key === 'VERY_OLD_RETURN') veryOldCount++;

      return {
        id: ret.id,
        returnDate,
        issueDate,
        originalIssueId: ret.originalIssueId,
        itemCode: ret.item.code,
        itemName: ret.item.name,
        category: ret.item.category,
        unit: ret.item.unit,
        storeCode: ret.store.code,
        storeName: ret.store.name,
        issuedQuantity: ret.originalIssue?.quantity ?? null,
        returnedQuantity: ret.quantity,
        issuedTo: ret.originalIssue?.referenceType || ret.referenceType || 'N/A',
        referenceId: ret.referenceId,
        daysHeld,
        classificationKey: classification.key,
        classificationLabel: classification.label,
        badgeVariant: classification.badgeVariant,
        condition: ret.condition || 'Good',
        returnReason: ret.returnReason || 'Unused Material',
        notes: ret.notes,
      };
    });

    const avgDaysHeld = validDaysCount > 0 ? Math.round((totalDays / validDaysCount) * 10) / 10 : 0;

    return {
      summary: {
        totalReturns,
        totalReturnedQty,
        recentCount,
        oldCount,
        veryOldCount,
        avgDaysHeld,
      },
      records,
    };
  }
}
