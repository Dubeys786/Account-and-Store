import React, { useState, useEffect } from 'react';
import { adminService, CreateUserData } from '../../services/admin.service';
import { AdminUserRecord, RoleRecord, Store } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Shield,
  Store as StoreIcon,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const AdminUsersPage: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'audit'>('users');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showStoresModal, setShowStoresModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);

  // Form states
  const [newUserForm, setNewUserForm] = useState<CreateUserData>({
    name: '',
    email: '',
    password: '',
    phone: '',
    roles: ['STORE_USER'],
    storeIds: [],
  });
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedDefaultStoreId, setSelectedDefaultStoreId] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, auditRes] = await Promise.all([
        adminService.getUsers(),
        adminService.getRoles(),
        adminService.getAuditLogs(20, 0),
      ]);

      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      }
      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
      }
      if (auditRes.success && auditRes.data) {
        setAuditLogs(auditRes.data.logs || []);
      }

      // Fetch store list from localStorage or api
      const cachedStores = localStorage.getItem('stockledger_stores');
      if (cachedStores) {
        try {
          setStores(JSON.parse(cachedStores));
        } catch {
          // ignore
        }
      }
    } catch {
      setActionError('Failed to load administration data.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.roles.some((r) => r.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenRoleModal = (u: AdminUserRecord) => {
    setSelectedUser(u);
    setSelectedRoleNames([...u.roles]);
    setActionError(null);
    setActionSuccess(null);
    setShowRolesModal(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await adminService.updateUserRoles(selectedUser.id, selectedRoleNames);
      if (res.success) {
        setActionSuccess(`Roles updated for ${selectedUser.name}.`);
        setShowRolesModal(false);
        loadData();
      } else {
        setActionError(res.message || 'Failed to update roles.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStoresModal = (u: AdminUserRecord) => {
    setSelectedUser(u);
    const storeIds = u.stores.map((s) => s.id);
    setSelectedStoreIds(storeIds);
    const defaultStore = u.stores.find((s) => s.isDefault);
    setSelectedDefaultStoreId(defaultStore ? defaultStore.id : storeIds[0] || '');
    setActionError(null);
    setActionSuccess(null);
    setShowStoresModal(true);
  };

  const handleSaveStores = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await adminService.updateUserStores(
        selectedUser.id,
        selectedStoreIds,
        selectedDefaultStoreId
      );
      if (res.success) {
        setActionSuccess(`Store access updated for ${selectedUser.name}.`);
        setShowStoresModal(false);
        loadData();
      } else {
        setActionError(res.message || 'Failed to update store access.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: AdminUserRecord) => {
    if (u.id === currentAdmin?.id) {
      alert('You cannot deactivate your own administrator account.');
      return;
    }

    try {
      const res = await adminService.toggleUserStatus(u.id, !u.isActive);
      if (res.success) {
        loadData();
      }
    } catch (e: any) {
      alert(e.message || 'Failed to toggle status.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || newUserForm.roles.length === 0) {
      setActionError('Name, email, and at least one role are required.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await adminService.createUser(newUserForm);
      if (res.success) {
        setActionSuccess(`User ${newUserForm.name} created successfully.`);
        setShowCreateModal(false);
        setNewUserForm({
          name: '',
          email: '',
          password: '',
          phone: '',
          roles: ['STORE_USER'],
          storeIds: [],
        });
        loadData();
      } else {
        setActionError(res.message || 'Failed to create user.');
      }
    } catch (e: any) {
      setActionError(e.message || 'Error occurred creating user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'STORE_MANAGER':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'STORE_USER':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'ACCOUNT_MANAGER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ACCOUNT_USER':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">User & Access Management</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Production-grade Role-Based Access Control (RBAC). Manage multi-role permissions and warehouse store isolation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setActionError(null);
              setShowCreateModal(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Create User
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'users' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'roles' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" /> Roles & Permissions ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'audit' ? 'bg-blue-50 text-blue-600 font-bold' : 'hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" /> Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user name, email, role..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Assigned Roles</th>
                    <th className="px-5 py-3.5">Assigned Stores</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No users found matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{u.name}</div>
                          <div className="text-slate-400 font-mono text-[11px]">{u.email}</div>
                          {u.phone && <div className="text-slate-400 text-[10px]">{u.phone}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                                  r
                                )}`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {u.roles.includes('ADMIN') ? (
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Universal Access (All Stores)
                            </span>
                          ) : u.stores.length === 0 ? (
                            <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              No stores assigned
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.stores.map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1"
                                >
                                  <StoreIcon className="w-2.5 h-2.5" />
                                  {s.code}
                                  {s.isDefault && (
                                    <span className="text-[9px] text-blue-600 font-bold">(Default)</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                            }`}
                          >
                            {u.isActive ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 text-rose-600" /> Deactivated
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg border border-slate-200 font-semibold text-[11px] transition-colors flex items-center gap-1"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>Roles</span>
                            </button>
                            <button
                              onClick={() => handleOpenStoresModal(u)}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg border border-slate-200 font-semibold text-[11px] transition-colors flex items-center gap-1"
                            >
                              <StoreIcon className="w-3.5 h-3.5" />
                              <span>Stores</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((r) => (
            <div
              key={r.id}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getRoleBadgeStyle(r.name)}`}>
                    {r.name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {r.userCount} User{r.userCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-4">{r.description || 'Standard system role.'}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Permissions:</span>
                <span className="font-bold text-slate-800">{r.permissionCount} granted</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-sm text-slate-900">Security & RBAC Audit Trail</h3>
            <p className="text-xs text-slate-500">Chronological log of user management and role assignment events.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No audit logs recorded yet.</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-start justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-800">{log.action}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono text-slate-600">{log.entity}</span>
                    </div>
                    <p className="text-slate-500 text-[11px]">
                      By {log.user?.name || log.user?.email || 'System'}
                      {log.ipAddress && ` (IP: ${log.ipAddress})`}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER ROLES */}
      {showRolesModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assign Roles</h3>
                <p className="text-xs text-slate-500">Configure multi-role assignments for {selectedUser.name}</p>
              </div>
              <button onClick={() => setShowRolesModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-3 max-h-96 overflow-y-auto">
              {roles.map((role) => {
                const isSelected = selectedRoleNames.includes(role.name);
                return (
                  <label
                    key={role.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedRoleNames(selectedRoleNames.filter((r) => r !== role.name));
                      } else {
                        setSelectedRoleNames([...selectedRoleNames, role.name]);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/50 border-blue-400 text-blue-950'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled on container click
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{role.name}</span>
                        <span className="text-[10px] text-slate-400">({role.permissionCount} perms)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{role.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRolesModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={isSubmitting} onClick={handleSaveRoles}>
                {isSubmitting ? 'Saving...' : 'Update Roles'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER STORES */}
      {showStoresModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Store Access Boundaries</h3>
                <p className="text-xs text-slate-500">Configure warehouse locations for {selectedUser.name}</p>
              </div>
              <button onClick={() => setShowStoresModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5 space-y-3">
              <p className="text-xs text-slate-500 mb-2">
                Users can only query, create, or issue stock in stores they are explicitly assigned to.
              </p>

              {stores.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                  No stores registered in system.
                </div>
              ) : (
                stores.map((store) => {
                  const isAssigned = selectedStoreIds.includes(store.id);
                  const isDefault = selectedDefaultStoreId === store.id;

                  return (
                    <div
                      key={store.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isAssigned ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200 opacity-60'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newIds = [...selectedStoreIds, store.id];
                              setSelectedStoreIds(newIds);
                              if (!selectedDefaultStoreId) setSelectedDefaultStoreId(store.id);
                            } else {
                              const newIds = selectedStoreIds.filter((id) => id !== store.id);
                              setSelectedStoreIds(newIds);
                              if (selectedDefaultStoreId === store.id) {
                                setSelectedDefaultStoreId(newIds[0] || '');
                              }
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{store.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{store.code}</div>
                        </div>
                      </label>

                      {isAssigned && (
                        <button
                          type="button"
                          onClick={() => setSelectedDefaultStoreId(store.id)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                            isDefault
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isDefault ? 'Default Store' : 'Set as Default'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowStoresModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={isSubmitting} onClick={handleSaveStores}>
                {isSubmitting ? 'Saving...' : 'Update Store Access'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create System User</h3>
                <p className="text-xs text-slate-500">Add an enterprise user with RBAC role assignments</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="johndoe@stockledger.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newUserForm.password || ''}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="Default: Stockledger@123"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={newUserForm.phone || ''}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Initial Roles (Multi-Select)</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const isSelected = newUserForm.roles.includes(r.name);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          if (isSelected) {
                            setNewUserForm({
                              ...newUserForm,
                              roles: newUserForm.roles.filter((rn) => rn !== r.name),
                            });
                          } else {
                            setNewUserForm({
                              ...newUserForm,
                              roles: [...newUserForm.roles, r.name],
                            });
                          }
                        }}
                        className={`text-left p-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 text-blue-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{r.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
