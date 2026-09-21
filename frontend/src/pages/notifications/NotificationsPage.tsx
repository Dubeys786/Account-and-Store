import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  ShoppingBag,
  Truck,
  RotateCcw,
  CreditCard,
  Receipt,
  TrendingDown,
  TrendingUp,
  Inbox,
  Check,
  ExternalLink,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NotificationItem } from '../../components/notifications/NotificationDropdown';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffInSeconds) || diffInSeconds < 30) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}

function getNotificationVisuals(item: NotificationItem) {
  switch (item.referenceType) {
    case 'low_stock':
      return {
        icon: AlertTriangle,
        iconBg: 'bg-red-50 text-red-600 border border-red-200',
        badgeColor: 'bg-red-50 text-red-700 border-red-200',
        badgeText: 'Low Stock',
      };
    case 'purchase_order':
      return {
        icon: ShoppingBag,
        iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        badgeText: 'Purchase Order',
      };
    case 'material_inward':
      return {
        icon: Truck,
        iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeText: 'Inward',
      };
    case 'item_return':
      return {
        icon: RotateCcw,
        iconBg: 'bg-amber-50 text-amber-600 border border-amber-200',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeText: 'Return',
      };
    case 'payment':
      return {
        icon: CreditCard,
        iconBg: 'bg-purple-50 text-purple-600 border border-purple-200',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        badgeText: 'Payment',
      };
    case 'receipt':
      return {
        icon: Receipt,
        iconBg: 'bg-blue-50 text-blue-600 border border-blue-200',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        badgeText: 'Receipt',
      };
    case 'expense':
      return {
        icon: TrendingDown,
        iconBg: 'bg-orange-50 text-orange-600 border border-orange-200',
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
        badgeText: 'Expense',
      };
    case 'income':
      return {
        icon: TrendingUp,
        iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeText: 'Income',
      };
    default:
      return {
        icon: Bell,
        iconBg: 'bg-slate-100 text-slate-600 border border-slate-200',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        badgeText: item.type || 'Notice',
      };
  }
}

function getTargetRoute(item: NotificationItem): string | null {
  switch (item.referenceType) {
    case 'purchase_order':
      return '/store/purchase-orders';
    case 'material_inward':
      return '/store/material-inward';
    case 'item_return':
      return '/store/issue-return';
    case 'low_stock':
      return '/store/stock-register';
    case 'payment':
      return '/accounts/payments';
    case 'receipt':
      return '/accounts/receipts';
    case 'expense':
      return '/accounts/expenses';
    case 'income':
      return '/accounts/income';
    default:
      return null;
  }
}

type TabType = 'all' | 'unread' | 'store' | 'accounts';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiRequest<NotificationItem[]>('/notifications?limit=100');
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        if (typeof res.unreadCount === 'number') {
          setUnreadCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAllRead(true);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await apiRequest('/notifications/mark-all-read', { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch((err) =>
        console.error('Failed to mark read:', err)
      );
    }

    const targetRoute = getTargetRoute(item);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  const handleMarkSingleRead = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (item.isRead) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread') return !item.isRead;
    if (activeTab === 'store') return item.type === 'STORE' || ['purchase_order', 'material_inward', 'low_stock', 'item_return'].includes(item.referenceType);
    if (activeTab === 'accounts') return item.type === 'ACCOUNTS' || ['payment', 'receipt', 'expense', 'income'].includes(item.referenceType);
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time notifications triggered from Store & Accounts activities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'unread'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setActiveTab('store')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'store'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Store Activity
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'accounts'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Accounts Activity
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading notifications from database...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              {activeTab === 'unread' ? "You're all caught up!" : 'No notifications found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'unread'
                ? 'All notifications have been marked as read.'
                : 'No notification records match the selected tab filter.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const visuals = getNotificationVisuals(item);
            const IconComponent = visuals.icon;
            const hasTargetRoute = Boolean(getTargetRoute(item));

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-colors cursor-pointer group ${
                  !item.isRead ? 'bg-blue-50/40 hover:bg-blue-50/80' : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${visuals.iconBg}`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {item.title}
                      </h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${visuals.badgeColor}`}
                    >
                      {visuals.badgeText}
                    </span>

                    <div className="flex items-center gap-3">
                      {!item.isRead && (
                        <button
                          onClick={(e) => handleMarkSingleRead(e, item)}
                          title="Mark as read"
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark read</span>
                        </button>
                      )}
                      {hasTargetRoute && (
                        <span className="text-xs text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-medium">
                          <span>View details</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
