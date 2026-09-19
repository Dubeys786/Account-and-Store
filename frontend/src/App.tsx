import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';

// Dashboard
import { DashboardPage } from './pages/dashboard/DashboardPage';

// Store Pages
import { ItemMasterPage } from './pages/store/ItemMasterPage';
import { POMasterPage } from './pages/store/POMasterPage';
import { MaterialInwardPage } from './pages/store/MaterialInwardPage';
import { StockRegisterPage } from './pages/store/StockRegisterPage';
import { IssueReturnPage } from './pages/store/IssueReturnPage';
import { StoreReportsPage } from './pages/store/StoreReportsPage';

// Accounts Pages
import { AccountsDashboardPage } from './pages/accounts/AccountsDashboardPage';
import { PartyMasterPage } from './pages/accounts/PartyMasterPage';
import { PurchaseAccountsPage } from './pages/accounts/PurchaseAccountsPage';
import { PartyLedgerPage } from './pages/accounts/PartyLedgerPage';
import { ReceivablesPage } from './pages/accounts/ReceivablesPage';
import { PayablesPage } from './pages/accounts/PayablesPage';
import { PaymentsPage } from './pages/accounts/PaymentsPage';
import { ReceiptsPage } from './pages/accounts/ReceiptsPage';
import { ExpensesPage } from './pages/accounts/ExpensesPage';
import { IncomePage } from './pages/accounts/IncomePage';
import { DayBookPage } from './pages/accounts/DayBookPage';
import { CashBookPage } from './pages/accounts/CashBookPage';
import { BankBookPage } from './pages/accounts/BankBookPage';
import { AccountsReportsPage } from './pages/accounts/AccountsReportsPage';
import { AccountSettingsPage } from './pages/accounts/AccountSettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <Routes>
            {/* Public Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Workspace Layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Store & Inventory Submodules (ADMIN & STORE_USER) */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'STORE_USER']} />}>
                  <Route path="/store/items" element={<ItemMasterPage />} />
                  <Route path="/store/purchase-orders" element={<POMasterPage />} />
                  <Route path="/store/material-inwards" element={<MaterialInwardPage />} />
                  <Route path="/store/stock-register" element={<StockRegisterPage />} />
                  <Route path="/store/issue-return" element={<IssueReturnPage />} />
                  <Route path="/store/reports" element={<StoreReportsPage />} />
                </Route>

                {/* Accounts & Finance Submodules (ADMIN & ACCOUNT_USER) */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNT_USER']} />}>
                  <Route path="/accounts/dashboard" element={<AccountsDashboardPage />} />
                  <Route path="/accounts/parties" element={<PartyMasterPage />} />
                  <Route path="/accounts/purchases" element={<PurchaseAccountsPage />} />
                  <Route path="/accounts/ledger" element={<PartyLedgerPage />} />
                  <Route path="/accounts/receivables" element={<ReceivablesPage />} />
                  <Route path="/accounts/payables" element={<PayablesPage />} />
                  <Route path="/accounts/payments" element={<PaymentsPage />} />
                  <Route path="/accounts/receipts" element={<ReceiptsPage />} />
                  <Route path="/accounts/expenses" element={<ExpensesPage />} />
                  <Route path="/accounts/income" element={<IncomePage />} />
                  <Route path="/accounts/day-book" element={<DayBookPage />} />
                  <Route path="/accounts/cash-book" element={<CashBookPage />} />
                  <Route path="/accounts/bank-book" element={<BankBookPage />} />
                  <Route path="/accounts/reports" element={<AccountsReportsPage />} />
                  <Route path="/accounts/settings" element={<AccountSettingsPage />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
