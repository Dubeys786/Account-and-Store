import prisma from '../../../config/db';
import { POStatus, StockTransactionType } from '@prisma/client';

export interface InwardItemInput {
  itemId: string;
  receivedQty: number;
  rejectedQty?: number;
  acceptedQty: number;
  rate?: number;
  remarks?: string;
}

export interface CreateInwardInput {
  inwardNumber?: string;
  inwardDate?: string;
  poId: string;
  referenceNumber?: string;
  remarks?: string;
  items: InwardItemInput[];
}

export class InwardService {
  static async generateInwardNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.materialInward.count();
    const seq = (count + 1).toString().padStart(4, '0');
    return `INW-${year}-${seq}`;
  }

  static async getMaterialInwards(filters: { storeId?: string; poId?: string } = {}) {
    const where: any = {};
    if (filters.storeId) where.storeId = filters.storeId;
    if (filters.poId) where.poId = filters.poId;

    return prisma.materialInward.findMany({
      where,
      include: {
        party: { select: { id: true, code: true, name: true } },
        store: { select: { id: true, code: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true, poDate: true, status: true } },
        items: {
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { inwardDate: 'desc' },
    });
  }

  static async getInwardById(id: string) {
    const inward = await prisma.materialInward.findUnique({
      where: { id },
      include: {
        party: true,
        store: true,
        purchaseOrder: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!inward) {
      throw new Error(`Material inward not found with id ${id}`);
    }

    return inward;
  }

  static async createMaterialInward(data: CreateInwardInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error('Material Inward must contain at least one line item.');
    }

    // 1. Fetch and validate Purchase Order
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.poId },
      include: {
        items: true,
      },
    });

    if (!po) {
      throw new Error('Invalid Purchase Order referenced.');
    }

    if (po.status === POStatus.CANCELLED) {
      throw new Error('Cannot create Material Inward against a CANCELLED Purchase Order.');
    }

    if (po.status === POStatus.RECEIVED) {
      throw new Error('Purchase Order has already been fully received.');
    }

    // 2. Validate items and verify against over-receiving
    for (const inItem of data.items) {
      const poItem = po.items.find((p) => p.itemId === inItem.itemId);
      if (!poItem) {
        throw new Error(`Item ${inItem.itemId} is not part of Purchase Order ${po.poNumber}.`);
      }

      if (inItem.acceptedQty < 0 || inItem.receivedQty < 0) {
        throw new Error('Quantities cannot be negative.');
      }

      if (inItem.acceptedQty + (inItem.rejectedQty || 0) > inItem.receivedQty) {
        throw new Error('Accepted quantity + Rejected quantity cannot exceed Received quantity.');
      }

      const remainingAllowed = poItem.quantity - poItem.receivedQty;
      if (inItem.acceptedQty > remainingAllowed) {
        throw new Error(
          `Over-receiving prevented: Accepted quantity (${inItem.acceptedQty}) exceeds remaining allowed quantity (${remainingAllowed}) for item in PO ${po.poNumber}.`
        );
      }
    }

    const inwardNumber = data.inwardNumber || (await this.generateInwardNumber());

    // 3. Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Material Inward header
      const inward = await tx.materialInward.create({
        data: {
          inwardNumber,
          inwardDate: data.inwardDate ? new Date(data.inwardDate) : new Date(),
          poId: po.id,
          partyId: po.partyId,
          storeId: po.storeId,
          referenceNumber: data.referenceNumber || null,
          remarks: data.remarks || null,
        },
      });

      // Process each inward item
      for (const inItem of data.items) {
        const poItem = po.items.find((p) => p.itemId === inItem.itemId)!;

        // Create inward line item
        await tx.materialInwardItem.create({
          data: {
            inwardId: inward.id,
            itemId: inItem.itemId,
            receivedQty: inItem.receivedQty,
            rejectedQty: inItem.rejectedQty || 0,
            acceptedQty: inItem.acceptedQty,
            rate: inItem.rate || poItem.rate,
            remarks: inItem.remarks || null,
          },
        });

        // Update PO item received quantity
        const newReceivedQty = poItem.receivedQty + inItem.acceptedQty;
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: newReceivedQty },
        });

        // Increment stock and log StockTransaction if acceptedQty > 0
        if (inItem.acceptedQty > 0) {
          const currentItem = await tx.item.findUnique({ where: { id: inItem.itemId } });
          const newStock = (currentItem?.currentStock || 0) + inItem.acceptedQty;

          await tx.item.update({
            where: { id: inItem.itemId },
            data: { currentStock: newStock },
          });

          await tx.stockTransaction.create({
            data: {
              storeId: po.storeId,
              itemId: inItem.itemId,
              transactionType: StockTransactionType.INWARD,
              quantity: inItem.acceptedQty,
              rate: inItem.rate || poItem.rate,
              balanceAfter: newStock,
              referenceType: 'MATERIAL_INWARD',
              referenceId: inward.id,
              notes: `Inward ${inwardNumber} against PO ${po.poNumber}`,
            },
          });
        }
      }

      // 4. Update PO Status
      const updatedPoItems = await tx.purchaseOrderItem.findMany({
        where: { poId: po.id },
      });

      const allFulfilled = updatedPoItems.every((item) => item.receivedQty >= item.quantity);
      const someReceived = updatedPoItems.some((item) => item.receivedQty > 0);

      const newPoStatus = allFulfilled
        ? POStatus.RECEIVED
        : someReceived
        ? POStatus.PARTIALLY_RECEIVED
        : po.status;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newPoStatus },
      });

      return inward;
    });

    return this.getInwardById(result.id);
  }
}
