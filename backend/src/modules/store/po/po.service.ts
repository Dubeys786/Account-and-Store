import prisma from '../../../config/db';
import { POStatus } from '@prisma/client';

export interface POLineItemInput {
  itemId: string;
  quantity: number;
  rate: number;
  discountPercent?: number;
  taxPercent?: number;
}

export interface CreatePOInput {
  poNumber?: string;
  partyId: string;
  storeId: string;
  expectedDelivery?: string;
  notes?: string;
  items: POLineItemInput[];
}

const round2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export class POService {
  static async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const lastPO = await prisma.purchaseOrder.findFirst({
      where: {
        poNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        poNumber: 'desc',
      },
    });

    let nextSeq = 1;
    if (lastPO && lastPO.poNumber) {
      const parts = lastPO.poNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${prefix}${seqStr}`;
  }

  static async getPurchaseOrders(filters: { storeId?: string; storeIds?: string[]; status?: POStatus; partyId?: string } = {}) {
    const where: any = {};
    if (filters.storeId) {
      where.storeId = filters.storeId;
    } else if (filters.storeIds && filters.storeIds.length > 0) {
      where.storeId = { in: filters.storeIds };
    }
    if (filters.status) where.status = filters.status;
    if (filters.partyId) where.partyId = filters.partyId;

    return prisma.purchaseOrder.findMany({
      where,
      include: {
        party: { select: { id: true, code: true, name: true, phone: true } },
        store: { select: { id: true, code: true, name: true } },
        items: {
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPOById(id: string) {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        party: true,
        store: true,
        items: {
          include: {
            item: true,
          },
        },
        materialInwards: {
          include: {
            items: {
              include: { item: true },
            },
          },
        },
      },
    });

    if (!po) {
      throw new Error(`Purchase order not found with id ${id}`);
    }

    return po;
  }

  static async createPurchaseOrder(data: CreatePOInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase Order must contain at least one line item.');
    }

    const poNumber = data.poNumber || (await this.generatePONumber());

    return prisma.$transaction(
      async (tx) => {
        const party = await tx.party.findUnique({ where: { id: data.partyId } });
        if (!party) throw new Error('Supplier / Party does not exist.');

        const store = await tx.store.findUnique({ where: { id: data.storeId } });
        if (!store) throw new Error('Store does not exist.');

        // Calculate line items and totals with decimal-safe precision
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        const computedItems = [];

        for (const line of data.items) {
          if (line.quantity <= 0) throw new Error('Quantity must be greater than 0.');
          if (line.rate < 0) throw new Error('Rate cannot be negative.');

          const discPct = line.discountPercent || 0;
          const taxPct = line.taxPercent || 0;

          const baseAmount = round2(line.quantity * line.rate);
          const discount = round2(baseAmount * (discPct / 100));
          const taxable = round2(baseAmount - discount);
          const tax = round2(taxable * (taxPct / 100));
          const total = round2(taxable + tax);

          subtotal = round2(subtotal + baseAmount);
          totalDiscount = round2(totalDiscount + discount);
          totalTax = round2(totalTax + tax);

          computedItems.push({
            itemId: line.itemId,
            quantity: line.quantity,
            rate: line.rate,
            discountPercent: discPct,
            taxPercent: taxPct,
            total,
            receivedQty: 0,
          });
        }

        const grandTotal = round2(subtotal - totalDiscount + totalTax);

        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            poNumber,
            partyId: data.partyId,
            storeId: data.storeId,
            expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
            status: POStatus.APPROVED, // Direct approved workflow for Store POs
            subtotal,
            discount: totalDiscount,
            taxAmount: totalTax,
            totalAmount: grandTotal,
            notes: data.notes || null,
            items: {
              create: computedItems,
            },
          },
          include: {
            items: { include: { item: true } },
            party: true,
            store: true,
          },
        });

        return purchaseOrder;
      },
      { maxWait: 10000, timeout: 20000 }
    );
  }

  static async updatePOStatus(id: string, status: POStatus) {
    await this.getPOById(id);

    return prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: { items: true, party: true, store: true },
    });
  }
}
