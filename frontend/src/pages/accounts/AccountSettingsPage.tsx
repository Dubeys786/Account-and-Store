import React from 'react';
import { Settings, Shield, Sliders, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export const AccountSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">SETTINGS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & Compliance Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure financial fiscal year, default ledger accounts, GST rate slabs, and authorization rules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">Fiscal Year & Currency</CardTitle>
            </div>
            <Badge variant="success">Active</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Financial Year</span>
              <span className="font-bold text-slate-800">2026-2027 (01 Apr 2026 - 31 Mar 2027)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Base Currency</span>
              <span className="font-bold text-slate-800">Indian Rupee (INR - ₹)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">GST Composition / Regular</span>
              <span className="font-bold text-emerald-700">Regular GST Registered</span>
            </div>
            <div className="flex justify-between py-2 text-xs">
              <span className="text-slate-500 font-medium">Accounting Method</span>
              <span className="font-bold text-slate-800">Accrual Basis (Double Entry)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <CardTitle className="text-sm">Role & Separation Policy</CardTitle>
            </div>
            <Badge variant="blue">Enforced</Badge>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p><span className="font-bold text-slate-800">Store Isolation:</span> Store Users cannot view accounting transactions, bank balances, or profit margins.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p><span className="font-bold text-slate-800">Accounts Authorization:</span> Account Users can access authorized stores&apos; purchase bills and ledger entries.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p><span className="font-bold text-slate-800">PO Nonce Enforcement:</span> Non-PO purchases strictly maintain <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">po_id = NULL</code>.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
