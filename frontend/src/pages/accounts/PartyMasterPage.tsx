import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import apiRequest from '../../services/api';

export const PartyMasterPage: React.FC = () => {
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParties() {
      const res = await apiRequest('/accounts/parties');
      if (res.success && res.data) setParties(res.data);
      setLoading(false);
    }
    fetchParties();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>ACCOUNTS</span>
            <span>/</span>
            <span className="text-blue-600">PARTY MASTER</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Party Master</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Suppliers, Customers, GSTIN details, credit limits, and contact profiles
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" icon={<Filter className="w-3.5 h-3.5" />}>
            Filter Type
          </Button>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            Add New Party
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by party name, code, or GSTIN..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{parties.length} Parties Registered</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party Code</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>GSTIN / PAN</TableHead>
                <TableHead>Phone / Email</TableHead>
                <TableHead>Credit Terms</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    Loading party master from database...
                  </TableCell>
                </TableRow>
              ) : parties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    No parties registered yet. Click &apos;Add New Party&apos; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                parties.map((party) => (
                  <TableRow key={party.id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{party.code}</TableCell>
                    <TableCell className="font-medium text-slate-900">{party.name}</TableCell>
                    <TableCell>
                      <Badge variant={party.type === 'SUPPLIER' ? 'info' : party.type === 'CUSTOMER' ? 'success' : 'neutral'}>
                        {party.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      <div>{party.gstin || '—'}</div>
                      <div className="text-[10px] text-slate-400">{party.pan}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{party.phone}</div>
                      <div className="text-slate-400 text-[10px]">{party.email}</div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      ₹ {party.creditLimit?.toLocaleString()} ({party.creditDays}d)
                    </TableCell>
                    <TableCell>
                      <Badge variant={party.status === 'ACTIVE' ? 'success' : 'error'}>
                        {party.status}
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
