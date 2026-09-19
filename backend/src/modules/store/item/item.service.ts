import prisma from '../../../config/db';

export interface ItemFilterOptions {
  search?: string;
  category?: string;
  status?: string; // 'active', 'inactive', 'all'
  sortBy?: 'code' | 'name' | 'currentStock' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreateItemInput {
  code: string;
  name: string;
  brand?: string;
  category: string;
  unit: string;
  description?: string;
  minStock?: number;
  maxStock?: number;
  reorderLevel?: number;
  currentStock?: number;
}

export class ItemService {
  static async getItems(options: ItemFilterOptions = {}) {
    const {
      search,
      category,
      status = 'active',
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
    } = options;

    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.item.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getItemById(id: string) {
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        stockTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { store: true },
        },
      },
    });

    if (!item) {
      throw new Error(`Item not found with id ${id}`);
    }

    return item;
  }

  static async createItem(data: CreateItemInput) {
    // Check if code already exists
    const existing = await prisma.item.findUnique({
      where: { code: data.code.trim().toUpperCase() },
    });

    if (existing) {
      throw new Error(`Item code '${data.code}' already exists.`);
    }

    const item = await prisma.item.create({
      data: {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        brand: data.brand?.trim() || null,
        category: data.category.trim(),
        unit: data.unit.trim().toUpperCase() || 'PCS',
        description: data.description?.trim() || null,
        minStock: Number(data.minStock) || 0,
        maxStock: Number(data.maxStock) || 1000,
        reorderLevel: Number(data.reorderLevel) || 10,
        currentStock: Number(data.currentStock) || 0,
        isActive: true,
      },
    });

    return item;
  }

  static async updateItem(id: string, data: Partial<CreateItemInput>) {
    await this.getItemById(id);

    if (data.code) {
      const existing = await prisma.item.findUnique({
        where: { code: data.code.trim().toUpperCase() },
      });
      if (existing && existing.id !== id) {
        throw new Error(`Item code '${data.code}' is already used by another item.`);
      }
    }

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code.trim().toUpperCase() }),
        ...(data.name && { name: data.name.trim() }),
        ...(data.brand !== undefined && { brand: data.brand?.trim() || null }),
        ...(data.category && { category: data.category.trim() }),
        ...(data.unit && { unit: data.unit.trim().toUpperCase() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.minStock !== undefined && { minStock: Number(data.minStock) }),
        ...(data.maxStock !== undefined && { maxStock: Number(data.maxStock) }),
        ...(data.reorderLevel !== undefined && { reorderLevel: Number(data.reorderLevel) }),
      },
    });

    return updated;
  }

  static async toggleItemStatus(id: string, isActive: boolean) {
    await this.getItemById(id);

    return prisma.item.update({
      where: { id },
      data: { isActive },
    });
  }

  static async deleteItem(id: string) {
    await this.getItemById(id);

    // Prevent deletion if items have stock transactions or PO references
    const [txCount, poCount, inwardCount] = await Promise.all([
      prisma.stockTransaction.count({ where: { itemId: id } }),
      prisma.purchaseOrderItem.count({ where: { itemId: id } }),
      prisma.materialInwardItem.count({ where: { itemId: id } }),
    ]);

    if (txCount > 0 || poCount > 0 || inwardCount > 0) {
      throw new Error(
        'Cannot delete item with linked stock transactions, purchase orders, or inward receipts. Please deactivate it instead.'
      );
    }

    await prisma.item.delete({ where: { id } });
    return { success: true, message: 'Item successfully deleted.' };
  }
}
