import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { AccessNotAssignedPage } from './pages/auth/AccessNotAssignedPage';

// Workspace Selector Page
import { WorkspaceSelectorPage } from './pages/workspace/WorkspaceSelectorPage';

// Dashboard & Store Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
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

/**
 * Intelligent root dispatcher routing based strictly on database-stored permissions
 */
const RootRedirect: React.FC = () => {
  const { user, accessibleWorkspaces } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const hasStore = accessibleWorkspaces?.store ?? false;
  const hasAccounts = accessibleWorkspaces?.accounts ?? false;

  if (!hasStore && !hasAccounts) {
    return <Navigate to="/unassigned" replace />;
  }

  if (hasStore && hasAccounts) {
    return <Navigate to="/workspace" replace />;
  }

  if (hasAccounts && !hasStore) {
    return <Navigate to="/accounts" replace />;
  }

  return <Navigate to="/store" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <Routes>
            {/* Public Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Unassigned Access Screen */}
            <Route path="/unassigned" element={<AccessNotAssignedPage />} />

            {/* Standalone Workspace Selector */}
            <Route element={<ProtectedRoute />}>
              <Route path="/workspace" element={<WorkspaceSelectorPage />} />
            </Route>

            {/* Protected Workspace Layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RootRedirect />} />

                {/* Store & Inventory Domain (STORE_INCHARGE, STORE_MANAGER, STORE_USER) */}
                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['STORE_INCHARGE', 'STORE_MANAGER', 'STORE_USER']}
                      workspace="store"
                    />
                  }
                >
                  <Route path="/store" element={<DashboardPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/store/items" element={<ItemMasterPage />} />
                  <Route path="/store/purchase-orders" element={<POMasterPage />} />
                  <Route path="/store/material-inwards" element={<MaterialInwardPage />} />
                  <Route path="/store/stock-register" element={<StockRegisterPage />} />
                  <Route path="/store/issue-return" element={<IssueReturnPage />} />
                  <Route path="/store/reports" element={<StoreReportsPage />} />
                </Route>

                {/* Accounts & Finance Domain (ACCOUNT_AND_STORE_INCHARGE, ACCOUNT_MANAGER, ACCOUNT_USER) */}
                <Route
                  element={
                    <ProtectedRoute
                      allowedRoles={['ACCOUNT_AND_STORE_INCHARGE', 'ACCOUNT_MANAGER', 'ACCOUNT_USER']}
                      workspace="accounts"
                    />
                  }
                >
                  <Route path="/accounts" element={<AccountsDashboardPage />} />
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
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
