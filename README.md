# PROZEN - Store & Accounts Management System

> Production-ready enterprise full-stack web application with dual business domains: **Store / Inventory** and **Accounts / Accounting**.

---

## 📸 UI / UX Design Reference

The application follows a refined enterprise layout based on the design system specifications:
- **Dark Navy Sidebar** (`#0b132a` / `#0f172a`) with distinct visual hierarchy and section headers.
- **Active Navigation Indicator**: Vibrant royal blue (`#2563eb`) highlighting the current route.
- **Light Content Area** (`#f8fafc` / `#ffffff`) with subtle slate borders, clean typography (Google Font Inter), and responsive data tables.
- **Sign In to Workspace**: Navy card with pre-configured **Quick Switch Demo Roles** (Admin, Store User, Account User) for instant 1-click credential switching.

---

## 🏛 Technical Architecture

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS 3, Lucide React, React Router 7 |
| **Backend** | Node.js (v24 LTS), Express 4, TypeScript 5, tsx, Morgan, Helmet, CORS |
| **Database** | PostgreSQL 16 (Native protocol via Prisma ORM + embedded local engine fallback) |
| **ORM & Migrations** | Prisma Client & Prisma Migrations (Pure PostgreSQL DDL) |
| **Authentication** | JSON Web Tokens (JWT) + bcryptjs salted password hashing |
| **Authorization** | Strict backend role-based access control (RBAC) & multi-store tenancy guards |

---

## 🔐 Role-Based Access Control (RBAC)

The system enforces authorization on both backend REST APIs and frontend navigation:

| Module / Area | ADMIN | STORE_USER | ACCOUNT_USER |
| :--- | :---: | :---: | :---: |
| **Overview / Dashboard** | ✅ Full | ✅ Store KPIs | ✅ Accounts KPIs |
| **Item Master** | ✅ Full CRUD | ✅ Full CRUD | ❌ Forbidden (403) |
| **Purchase Orders (PO Master)** | ✅ Full CRUD | ✅ Full CRUD | ❌ Forbidden (403) |
| **Material Inward** | ✅ Full CRUD | ✅ Full CRUD | ❌ Forbidden (403) |
| **Stock Register** | ✅ Full View | ✅ Full View | ❌ Forbidden (403) |
| **Issue / Return** | ✅ Full CRUD | ✅ Full CRUD | ❌ Forbidden (403) |
| **Store Reports** | ✅ View / Export | ✅ View / Export | ❌ Forbidden (403) |
| **Accounts Dashboard** | ✅ Full | ❌ Forbidden (403) | ✅ Full |
| **Party Master** | ✅ Full CRUD | ❌ Forbidden (403) | ✅ Full CRUD |
| **Purchase Accounts (With / Without PO)** | ✅ Full CRUD | ❌ Forbidden (403) | ✅ Full CRUD |
| **Party Ledger** | ✅ Full View | ❌ Forbidden (403) | ✅ Full View |
| **Receivables & Payables** | ✅ Full View | ❌ Forbidden (403) | ✅ Full View |
| **Payments & Receipts** | ✅ Full CRUD | ❌ Forbidden (403) | ✅ Full CRUD |
| **Expenses & Income** | ✅ Full CRUD | ❌ Forbidden (403) | ✅ Full CRUD |
| **Day Book, Cash Book, Bank Book** | ✅ Full View | ❌ Forbidden (403) | ✅ Full View |
| **Accounting Reports & Settings** | ✅ Full View | ❌ Forbidden (403) | ✅ Full View |

---

## ⚖️ Critical Accounting Rule: Dual Purchase Workflows

Purchases support two distinct business workflows in the database and API:

### 1. WITH PO Workflow
```
Purchase Order (Approved) 
  → Material Inward (QC Accepted) 
    → Purchase Accounting Transaction (poId: Valid UUID) 
      → Party Ledger (Credited) 
        → Accounts Payable (Liability) 
          → Payment Voucher (Bank / Cash Outflow)
```
- The `accounting_transactions.po_id` foreign key references an actual `purchase_orders.id`.

### 2. WITHOUT PO Workflow (Direct Invoice)
```
Direct Supplier Invoice 
  → Purchase Accounting Transaction (poId: NULL) 
    → Party Ledger (Credited) 
      → Accounts Payable (Liability) 
        → Payment Voucher
```
- The `accounting_transactions.po_id` is explicitly `NULL`.
- **Constraint**: The system never generates fake PO numbers for direct transactions.

---

## 🗄 Database Models (All 20 Required Entities)

1. `users`: System users with hashed credentials and roles (`ADMIN`, `STORE_USER`, `ACCOUNT_USER`).
2. `stores`: Multi-store locations (`STR-001` Main Central Store, `STR-002` North Regional Warehouse).
3. `store_users`: Store-to-user assignment mappings with default flags.
4. `items`: Central item master catalog (code, name, category, unit, min/max/reorder levels, stock).
5. `purchase_orders`: Requisition POs with status transitions (`DRAFT`, `PENDING`, `APPROVED`, etc.).
6. `purchase_order_items`: Line items with rates, discounts, taxes, and received quantities.
7. `material_inwards`: Physical inward receipts against POs or direct deliveries.
8. `material_inward_items`: QC quantities (received, rejected, accepted).
9. `stock_transactions`: Immutable stock ledger (`INWARD`, `ISSUE`, `RETURN`, `ADJUSTMENT`).
10. `parties`: Party master for Suppliers, Customers, or Both (GSTIN, PAN, credit limits).
11. `ledger_accounts`: Chart of accounts grouped by `ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, `EXPENSE`.
12. `journal_entries`: Double-entry journal voucher headers.
13. `journal_entry_lines`: Individual debit and credit splits with balanced constraints.
14. `accounting_transactions`: Core purchase and sales invoices supporting nullable `poId`.
15. `payments`: Outflow payment vouchers referencing bank or cash ledgers and invoices.
16. `receipts`: Inflow collection vouchers from debtors.
17. `expenses`: Operating expense records linked to expense ledger accounts.
18. `income`: Direct and auxiliary income records.
19. `audit_logs`: Detailed audit trail recording user actions, IP address, user agent, and entity diffs.

---

## 🚀 Quick Setup & Run Instructions

### Prerequisites
- Node.js v18+ (tested on Node.js v24.19.0)
- npm v10+ (use `npm.cmd` on Windows)

### 1. Install Dependencies
```bash
# Install root orchestration packages
npm.cmd install

# Install backend dependencies
cd backend
npm.cmd install
npx.cmd prisma generate

# Install frontend dependencies
cd ../frontend
npm.cmd install
```

### 2. Database Migration & Seeding
```bash
cd backend
npm.cmd run db:seed
```

### 3. Run Automated Tests
```bash
cd backend
npm.cmd test
```
*Executes all 23 automated integration tests across database models, health check, login authentication, role access blocks (verifying 403 Forbidden on unauthorized cross-domain calls), and purchase workflow filters.*

### 4. Start Development Servers
From the root workspace:
```bash
npm.cmd run dev
```
- **Backend API**: `http://localhost:5000` (Health: `http://localhost:5000/api/v1/health`)
- **Frontend App**: `http://localhost:5173` (Sign In: `http://localhost:5173/login`)

---

## 🔑 Pre-Seeded Demo Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@prozen.com` | `Prozen@123` | Full enterprise access across both Store and Accounts |
| **Store User** | `store@prozen.com` | `Prozen@123` | Store, Item Master, PO, Inward, Stock Register, Issues |
| **Account User** | `account@prozen.com` | `Prozen@123` | Accounts Dashboard, Parties, Purchases, Ledger, Books |

*Tip: On the Login screen, click any of the 3 **Quick Switch Demo Roles** cards to sign in with a single click.*

---

## 📁 Repository Structure

```
Account-and-Store/
├── package.json                        # Root concurrently runner
├── .gitignore
├── README.md
│
├── backend/                            # Node.js + Express + TypeScript Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env
│   ├── prisma/
│   │   ├── schema.prisma               # 20-Entity PostgreSQL Prisma schema
│   │   ├── migrations/
│   │   │   └── 20260919000000_init/
│   │   │       └── migration.sql       # Pure PostgreSQL DDL migration
│   │   └── seed.ts                     # Database seeder
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts                   # Resilient PostgreSQL / embedded PGlite connector
│   │   │   ├── env.ts                  # Typed environment configuration
│   │   │   └── seed.ts                 # Seeder implementation
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       # JWT Bearer token authentication
│   │   │   ├── role.middleware.ts       # Role & Store-level RBAC guards
│   │   │   └── error.middleware.ts      # Standardized JSON error response
│   │   ├── modules/
│   │   │   ├── auth/                   # Login, get profile, logout endpoints
│   │   │   ├── health/                 # Health check & DB latency ping
│   │   │   ├── store/                  # Store & inventory endpoints (RBAC protected)
│   │   │   └── accounts/               # Financial accounts endpoints (RBAC protected)
│   │   ├── app.ts                      # Express application setup
│   │   └── server.ts                   # HTTP server startup with auto-bootstrap
│   └── tests/
│       └── run-tests.ts                # Automated test runner (23 test assertions)
│
└── frontend/                           # React 19 + TypeScript + Vite Frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── index.css                   # Enterprise scrollbar and design system
        ├── main.tsx
        ├── App.tsx                     # Route hierarchy with ProtectedRoute guards
        ├── components/
        │   ├── common/                 # Button, Card, Table, Badge, Input, Select, StatsCard, Tabs, Modal
        │   └── layout/                 # AppLayout, Sidebar, Topbar, ProtectedRoute
        ├── context/
        │   ├── AuthContext.tsx         # JWT token & user state management
        │   └── StoreContext.tsx        # Multi-store active selector
        ├── services/
        │   ├── api.ts                  # Fetch client with token & store headers
        │   └── auth.service.ts         # Authentication API calls
        └── pages/
            ├── auth/LoginPage.tsx      # Sign In matching screenshot with quick-switch cards
            ├── dashboard/DashboardPage.tsx
            ├── store/                  # 6 Store module pages
            └── accounts/               # 9 Accounts module pages
```