"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const client_1 = require("@prisma/client");
const db_1 = require("../src/config/db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function seedDatabase() {
    console.log('🌱 Starting database seeding for PROZEN Store & Accounts...');
    await (0, db_1.initDatabase)();
    // 1. Seed Stores
    const mainStore = await db_1.prisma.store.upsert({
        where: { code: 'STR-001' },
        update: {},
        create: {
            code: 'STR-001',
            name: 'Main Central Store',
            location: 'Building A, Industrial Complex',
            address: 'Plot 12, Industrial Area, Sector 58',
            phone: '+91 98765 43210',
            email: 'store.central@prozen.com',
        },
    });
    const branchStore = await db_1.prisma.store.upsert({
        where: { code: 'STR-002' },
        update: {},
        create: {
            code: 'STR-002',
            name: 'North Regional Warehouse',
            location: 'Logistics Hub, North Zone',
            address: 'Gate 4, Logistics Park, GT Road',
            phone: '+91 98765 43211',
            email: 'store.north@prozen.com',
        },
    });
    console.log('✅ Stores seeded: Main Central Store, North Regional Warehouse');
    // 2. Seed Users
    const salt = await bcryptjs_1.default.genSalt(10);
    const defaultPasswordHash = await bcryptjs_1.default.hash('Prozen@123', salt);
    // ADMIN user
    const adminUser = await db_1.prisma.user.upsert({
        where: { email: 'admin@prozen.com' },
        update: { passwordHash: defaultPasswordHash },
        create: {
            email: 'admin@prozen.com',
            name: 'Chief Administrator',
            passwordHash: defaultPasswordHash,
            role: client_1.UserRole.ADMIN,
            phone: '+91 90000 00001',
            storeUsers: {
                create: [
                    { storeId: mainStore.id, isDefault: true },
                    { storeId: branchStore.id, isDefault: false },
                ],
            },
        },
    });
    // STORE_USER
    const storeUser = await db_1.prisma.user.upsert({
        where: { email: 'store@prozen.com' },
        update: { passwordHash: defaultPasswordHash },
        create: {
            email: 'store@prozen.com',
            name: 'Rajesh Sharma (Store In-Charge)',
            passwordHash: defaultPasswordHash,
            role: client_1.UserRole.STORE_USER,
            phone: '+91 90000 00002',
            storeUsers: {
                create: [{ storeId: mainStore.id, isDefault: true }],
            },
        },
    });
    // ACCOUNT_USER
    const accountUser = await db_1.prisma.user.upsert({
        where: { email: 'account@prozen.com' },
        update: { passwordHash: defaultPasswordHash },
        create: {
            email: 'account@prozen.com',
            name: 'Pooja Verma (Finance & Accounts)',
            passwordHash: defaultPasswordHash,
            role: client_1.UserRole.ACCOUNT_USER,
            phone: '+91 90000 00003',
            storeUsers: {
                create: [
                    { storeId: mainStore.id, isDefault: true },
                    { storeId: branchStore.id, isDefault: false },
                ],
            },
        },
    });
    console.log('✅ Users seeded: Admin, Store User, Account User');
    // 3. Seed Chart of Accounts
    const chartOfAccounts = [
        { code: '1010', name: 'Cash in Hand', group: client_1.AccountGroup.ASSET, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
        { code: '1020', name: 'HDFC Bank Current A/c', group: client_1.AccountGroup.ASSET, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
        { code: '1030', name: 'Accounts Receivable', group: client_1.AccountGroup.ASSET, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
        { code: '1040', name: 'Inventory Asset', group: client_1.AccountGroup.ASSET, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
        { code: '1050', name: 'Input GST Credit (CGST+SGST)', group: client_1.AccountGroup.ASSET, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
        { code: '2010', name: 'Accounts Payable', group: client_1.AccountGroup.LIABILITY, balanceType: client_1.BalanceType.CREDIT, isSystem: true },
        { code: '2020', name: 'Output GST Payable', group: client_1.AccountGroup.LIABILITY, balanceType: client_1.BalanceType.CREDIT, isSystem: true },
        { code: '3010', name: "Owner's Equity / Capital", group: client_1.AccountGroup.EQUITY, balanceType: client_1.BalanceType.CREDIT, isSystem: true },
        { code: '4010', name: 'Sales Revenue', group: client_1.AccountGroup.INCOME, balanceType: client_1.BalanceType.CREDIT, isSystem: true },
        { code: '5010', name: 'Cost of Goods Sold / Purchase Expense', group: client_1.AccountGroup.EXPENSE, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
        { code: '5020', name: 'Rent & Utility Expense', group: client_1.AccountGroup.EXPENSE, balanceType: client_1.BalanceType.DEBIT, isSystem: true },
    ];
    for (const acc of chartOfAccounts) {
        await db_1.prisma.ledgerAccount.upsert({
            where: { code: acc.code },
            update: {},
            create: acc,
        });
    }
    console.log(`✅ Chart of Accounts seeded (${chartOfAccounts.length} system accounts)`);
    // 4. Seed Parties
    const parties = [
        {
            code: 'PRT-SUP-001',
            name: 'Bharat Steel & Fasteners Ltd',
            type: client_1.PartyType.SUPPLIER,
            gstin: '07AAAAA0000A1Z5',
            pan: 'AAAAA0000A',
            phone: '+91 98111 22233',
            email: 'sales@bharatsteel.com',
            address: 'Industrial Focal Point, Phase 4',
            city: 'Gurugram',
            state: 'Haryana',
            pincode: '122001',
            creditLimit: 500000,
            creditDays: 30,
            status: client_1.PartyStatus.ACTIVE,
        },
        {
            code: 'PRT-SUP-002',
            name: 'Apex Industrial Lubricants Corp',
            type: client_1.PartyType.SUPPLIER,
            gstin: '07BBBBB1111B1Z2',
            pan: 'BBBBB1111B',
            phone: '+91 98222 33344',
            email: 'orders@apexlubricants.in',
            address: 'Chemical Zone, Sector 25',
            city: 'Faridabad',
            state: 'Haryana',
            pincode: '121004',
            creditLimit: 250000,
            creditDays: 45,
            status: client_1.PartyStatus.ACTIVE,
        },
        {
            code: 'PRT-CUS-001',
            name: 'Metro City Infrastructure Pvt Ltd',
            type: client_1.PartyType.CUSTOMER,
            gstin: '07CCCCC2222C1Z9',
            pan: 'CCCCC2222C',
            phone: '+91 98333 44455',
            email: 'procurement@metrocityinfra.com',
            address: 'Commercial Tower B, Okhla',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110020',
            creditLimit: 1000000,
            creditDays: 60,
            status: client_1.PartyStatus.ACTIVE,
        },
    ];
    for (const party of parties) {
        await db_1.prisma.party.upsert({
            where: { code: party.code },
            update: {},
            create: party,
        });
    }
    console.log(`✅ Parties seeded (${parties.length} parties)`);
    // 5. Seed Items
    const items = [
        {
            code: 'ITM-001',
            name: 'Heavy Duty Structural Steel Beam 100x50',
            brand: 'Tata Structura',
            category: 'RAW_MATERIALS',
            unit: 'PCS',
            description: 'IS 2062 Grade E250 structural steel beam',
            minStock: 20,
            maxStock: 500,
            reorderLevel: 50,
            currentStock: 120,
            isActive: true,
        },
        {
            code: 'ITM-002',
            name: 'Industrial Deep Groove Ball Bearing 6205-2RS',
            brand: 'SKF',
            category: 'HARDWARE',
            unit: 'PCS',
            description: 'Rubber sealed deep groove radial ball bearing',
            minStock: 50,
            maxStock: 1000,
            reorderLevel: 100,
            currentStock: 350,
            isActive: true,
        },
        {
            code: 'ITM-003',
            name: 'Synthetic High Performance Gear Oil ISO VG 220',
            brand: 'Mobil',
            category: 'CONSUMABLES',
            unit: 'LTR',
            description: 'Fully synthetic heavy load industrial gear oil barrel',
            minStock: 5,
            maxStock: 100,
            reorderLevel: 15,
            currentStock: 45,
            isActive: true,
        },
    ];
    for (const item of items) {
        await db_1.prisma.item.upsert({
            where: { code: item.code },
            update: {},
            create: item,
        });
    }
    console.log(`✅ Items seeded (${items.length} items)`);
    console.log('🎉 PROZEN Store & Accounts database seeding completed successfully!');
}
if (require.main === module) {
    seedDatabase()
        .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
        .finally(async () => {
        await db_1.prisma.$disconnect();
    });
}
