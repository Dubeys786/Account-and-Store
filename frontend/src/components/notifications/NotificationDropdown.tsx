import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceType: string;
  referenceId?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

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

export const NotificationDropdown: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiRequest<{ unreadCount: number }>('/notifications/unread-count');
      if (res.success && typeof res.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [user]);

  // Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiRequest<NotificationItem[]>('/notifications?limit=25');
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

  // Initial fetch and polling
  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();

    // Periodic poll every 25 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    }, 25000);

    // Refresh on window focus
    const onFocus = () => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, isOpen, fetchUnreadCount, fetchNotifications]);

  // When opening dropdown, fetch notifications
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Mark single notification as read
  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Call API
      apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' }).catch((err) =>
        console.error('Failed to mark read:', err)
      );
    }

    setIsOpen(false);

    // Navigate to target route if exists
    const targetRoute = getTargetRoute(item);
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  // Mark single as read without navigation
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

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAllRead(true);

    // Optimistic update
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className={`relative p-2 rounded-lg transition-all ${
          isOpen
            ? 'bg-blue-50 text-blue-600 ring-2 ring-blue-500/20'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-blue-600 text-white font-bold text-[10px] leading-5 rounded-full ring-2 ring-white flex items-center justify-center shadow-xs animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Body List */}
          <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-xs font-semibold text-slate-700 mb-1">You're all caught up</p>
                <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                  No notifications to display right now. Real database events will appear here automatically.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const visuals = getNotificationVisuals(item);
                const IconComponent = visuals.icon;
                const hasTargetRoute = Boolean(getTargetRoute(item));

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                      !item.isRead ? 'bg-blue-50/40 hover:bg-blue-50/80' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${visuals.iconBg}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {item.title}
                          </span>
                          {!item.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 mb-1.5">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between pt-0.5">
                        <span
                          className={`text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${visuals.badgeColor}`}
                        >
                          {visuals.badgeText}
                        </span>

                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {!item.isRead && (
                            <button
                              onClick={(e) => handleMarkSingleRead(e, item)}
                              title="Mark as read"
                              className="text-[10px] text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-white"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          {hasTargetRoute && (
                            <span className="text-[10px] text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                              <span>Open</span>
                              <ExternalLink className="w-2.5 h-2.5" />
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

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">
              Connected to real-time events
            </span>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
