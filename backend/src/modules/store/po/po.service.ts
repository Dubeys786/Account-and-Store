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

export class POService {
  static async generatePONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count();
    const seq = (count + 1).toString().padStart(4, '0');
    return `PO-${year}-${seq}`;
  }

  static async getPurchaseOrders(filters: { storeId?: string; status?: POStatus; partyId?: string } = {}) {
    const where: any = {};
    if (filters.storeId) where.storeId = filters.storeId;
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

    const party = await prisma.party.findUnique({ where: { id: data.partyId } });
    if (!party) throw new Error('Supplier / Party does not exist.');

    const store = await prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store) throw new Error('Store does not exist.');

    const poNumber = data.poNumber || (await this.generatePONumber());

    // Calculate line items and totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const computedItems = [];

    for (const line of data.items) {
      if (line.quantity <= 0) throw new Error('Quantity must be greater than 0.');
      if (line.rate < 0) throw new Error('Rate cannot be negative.');

      const discPct = line.discountPercent || 0;
      const taxPct = line.taxPercent || 0;

      const baseAmount = line.quantity * line.rate;
      const discount = baseAmount * (discPct / 100);
      const taxable = baseAmount - discount;
      const tax = taxable * (taxPct / 100);
      const total = taxable + tax;

      subtotal += baseAmount;
      totalDiscount += discount;
      totalTax += tax;

      computedItems.push({
        itemId: line.itemId,
        quantity: line.quantity,
        rate: line.rate,
        discountPercent: discPct,
        taxPercent: taxPct,
        total: Math.round(total * 100) / 100,
        receivedQty: 0,
      });
    }

    const grandTotal = subtotal - totalDiscount + totalTax;

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        partyId: data.partyId,
        storeId: data.storeId,
        expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
        status: POStatus.APPROVED, // Default approved for direct PO workflow
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(totalDiscount * 100) / 100,
        taxAmount: Math.round(totalTax * 100) / 100,
        totalAmount: Math.round(grandTotal * 100) / 100,
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
