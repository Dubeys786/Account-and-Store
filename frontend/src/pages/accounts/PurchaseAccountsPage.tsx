import React, { useEffect, useState } from 'react';
import { Plus, Search, FileCheck, FileX, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Tabs } from '../../components/common/Tabs';
import apiRequest from '../../services/api';

export const PurchaseAccountsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'with-po' | 'without-po'>('all');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPurchases() {
      setLoading(true);
      const queryParam = activeTab === 'all' ? '' : `?type=${activeTab}`;
      const res = await apiRequest(`/accounts/purchases${queryParam}`);
      if (res.success && res.data) setPurchases(res.data);
      setLoading(false);
    }
    fetchPurchases();
  }, [activeTab]);

  const tabs = [
    { id: 'all', label: 'All Purchase Bills', count: purchases.length },
    { id: 'with-po', label: 'With PO Workflow' },
    { id: 'without-po', label: 'Without PO / Direct Invoices' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PURCHASE ACCOUNTS</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Accounts & Bills</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Process supplier invoices under dual procurement workflows: With Purchase Order and Direct Invoices
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<FileX className="w-3.5 h-3.5 text-slate-600" />}>
            Direct Purchase (No PO)
          </Button>
          <Button size="sm" variant="primary" icon={<FileCheck className="w-3.5 h-3.5" />}>
            Bill Against PO
          </Button>
        </div>
      </div>

      {/* Dual Workflow Informational Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg">
              <FileCheck className="w-4 h-4" />
            </span>
            <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wide">WITH PO WORKFLOW</h4>
          </div>
          <p className="text-xs text-blue-900/80 mb-2.5">
            Linked directly to an approved Purchase Order. Mandatory <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">po_id</code> reference.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 overflow-x-auto py-1">
            <span>Approved PO</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span>Material Inward</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span>Purchase Bill</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span>Payable</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-purple-600 text-white rounded-lg">
              <FileX className="w-4 h-4" />
            </span>
            <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wide">WITHOUT PO WORKFLOW</h4>
          </div>
          <p className="text-xs text-purple-900/80 mb-2.5">
            Direct purchase invoice. <code className="bg-purple-100 px-1 py-0.5 rounded font-mono text-[11px]">po_id</code> is explicitly <span className="font-bold">NULL</span>. No fake PO numbers generated.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-purple-700 overflow-x-auto py-1">
            <span>Direct Vendor Bill</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span>Purchase Accounting</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span>Party Ledger</span>
            <ArrowRight className="w-3 h-3 shrink-0" />
            <span>Payable</span>
          </div>
        </div>
      </div>

      <Card>
        <div className="px-6 pt-2">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as any)} />
        </div>

        <CardHeader className="border-t-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice number or vendor..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{purchases.length} Records</span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Workflow Type</TableHead>
                <TableHead>PO Reference</TableHead>
                <TableHead>Supplier / Party</TableHead>
                <TableHead>Gross Amount</TableHead>
                <TableHead>Tax (GST)</TableHead>
                <TableHead>Net Amount</TableHead>
                <TableHead>Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    Loading purchase transactions from database...
                  </TableCell>
                </TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                    No purchase transactions recorded for the selected workflow filter.
                  </TableCell>
                </TableRow>
              ) : (
                purchases.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{inv.invoiceNumber}</TableCell>
                    <TableCell>{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={inv.poId ? 'blue' : 'neutral'}>
                        {inv.poId ? 'WITH PO' : 'WITHOUT PO (Direct)'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {inv.purchaseOrder?.poNumber || <span className="text-slate-400 italic">None (NULL)</span>}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{inv.party?.name}</TableCell>
                    <TableCell className="font-mono">₹ {inv.grossAmount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-slate-500">₹ {inv.taxAmount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono font-bold text-slate-900">₹ {inv.netAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={inv.paymentStatus === 'PAID' ? 'success' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'error'}>
                        {inv.paymentStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
