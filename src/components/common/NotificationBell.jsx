// src/components/common/NotificationBell.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, Check, CheckCheck, Clock, Package, CreditCard, Truck, FileText, Factory } from 'lucide-react';
import { notificationApi } from '../../api/operatorApi';
import useWebSocket from '../../hooks/useWebSocket';
import { useToast } from './Toast';

const EVENT_ICONS = {
  ORDER_CREATED:      Package,
  ORDER_DELIVERING:   Truck,
  ORDER_COMPLETED:    Check,
  ORDER_PAID:         CreditCard,
  ORDER_PARTIAL_PAID: CreditCard,
  BATCH_PENDING:      FileText,
  BATCH_APPROVED:     Check,
  BATCH_REJECTED:     X,
  PRODUCTION_BATCH_SUBMITTED: Factory,
  DEFAULT:            Bell,
};

function formatTime(ts, t, lang) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return t('common', 'just_now');
  if (diff < 3600000) return Math.floor(diff / 60000) + t('common', 'minutes_ago');
  if (diff < 86400000) return Math.floor(diff / 3600000) + t('common', 'hours_ago');
  return new Date(ts).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

export default function NotificationBell({ role, token }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef(null);

  // Fetch notifications from REST
  const fetchNotifications = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 0 : page;
      const res = await notificationApi.getList({ page: p, size: 20 });
      const data = res.data?.data;
      if (data) {
        if (reset) {
          setNotifications(data.content || []);
          setPage(1);
        } else {
          setNotifications(prev => [...prev, ...(data.content || [])]);
          setPage(p + 1);
        }
        setHasMore((data.content || []).length === 20);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.warn('[Notif] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // Fetch unread count on mount
  useEffect(() => {
    notificationApi.getUnreadCount()
      .then(res => setUnreadCount(res.data?.data?.count || 0))
      .catch(() => {});
  }, []);

  // WebSocket: nhận thông báo realtime
  useWebSocket(role, token, (msg) => {
    console.log('[NotificationBell] received msg:', msg);
    // Add to top of list
    setNotifications(prev => [{
      id: msg.id || Date.now(),
      eventType: msg.eventType,
      message: msg.message,
      payload: msg.payload,
      isRead: false,
      createdAt: msg.createdAt || Date.now(),
    }, ...prev]);
    setUnreadCount(c => c + 1);
    // Also show toast
    toast(msg.message, 'info', 5000);
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open) fetchNotifications(true);
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#F0EBE3] transition-all"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-[#F0EBE3] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0EBE3]">
            <div>
              <h3 className="text-sm font-semibold text-[#1C1C1E]">{t('notification', 'notification_bell')}</h3>
              {unreadCount > 0 && (
                <p className="text-[10px] text-[#8E8878]">{t('notification', 'unread_count').replace('{n}', unreadCount)}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title={t('common', 'mark_all_read')}
                  className="p-1.5 rounded-lg text-[#8E8878] hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#F0EBE3] transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-96">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10">
                <Bell size={28} className="mx-auto text-[#D3CFC8] mb-2" />
                <p className="text-sm text-[#8E8878]">Chưa có thông báo</p>
              </div>
            ) : (
              <>
                {notifications.map((n) => {
                  const Icon = EVENT_ICONS[n.eventType] || EVENT_ICONS.DEFAULT;
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && handleMarkRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-[#F8F5F0] cursor-pointer transition-colors
                        ${n.isRead ? 'bg-white' : 'bg-amber-50/40 hover:bg-amber-50'}`}
                    >
                      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                        ${n.isRead ? 'bg-[#F0EBE3]' : 'bg-[#C9A84C]/15'}`}>
                        <Icon size={13} className={n.isRead ? 'text-[#8E8878]' : 'text-[#C9A84C]'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${n.isRead ? 'text-[#5C5C5C]' : 'text-[#1C1C1E] font-medium'}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-[#8E8878] mt-0.5 flex items-center gap-1">
                          <Clock size={9} />
                          {formatTime(n.createdAt, t, lang)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 rounded-full bg-[#C9A84C] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={() => fetchNotifications(false)}
                    disabled={loading}
                    className="w-full py-2.5 text-xs text-[#C9A84C] hover:bg-[#FAF7F2] transition-colors font-medium"
                  >
                    {loading ? t('common','loading'): t('common','view_more')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}