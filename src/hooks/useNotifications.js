// src/hooks/useNotifications.js
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * Hook quản lý thông báo real-time (WebSocket STOMP) + REST.
 * Tự động connect khi mount, disconnect khi unmount.
 */
export function useNotifications(role, onNewNotification) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const stompClientRef = useRef(null);
  const connectedRef = useRef(false);

  // ── Fetch from REST ──────────────────────────────────────────────
  const fetchNotifications = useCallback(async (pageNum = 0) => {
    try {
      setLoading(true);
      const res = await api.get('/api/notifications', { params: { page: pageNum, size: 20 } });
      const data = res.data?.data;
      if (data) {
        if (pageNum === 0) setNotifications(data.content || []);
        else setNotifications(prev => [...prev, ...(data.content || [])]);
        setUnreadCount(data.unreadCount || 0);
        setTotalPages(data.totalPages || 1);
        setPage(pageNum);
      }
    } catch (e) {
      console.error('[Notifications] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Mark single read ─────────────────────────────────────────────
  const markRead = useCallback(async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('[Notifications] markRead error', e);
    }
  }, []);

  // ── Mark all read ────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('[Notifications] markAllRead error', e);
    }
  }, []);

  // ── Load more ───────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (page + 1 < totalPages) fetchNotifications(page + 1);
  }, [page, totalPages, fetchNotifications]);

  // ── WebSocket connect ────────────────────────────────────────────
  useEffect(() => {
    if (!role) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let client = null;

    const connect = async () => {
      try {
        // Lazy-load SockJS + STOMP
        const [{ default: SockJS }, { Client }] = await Promise.all([
          import('sockjs-client'),
          import('@stomp/stompjs'),
        ]);

        client = new Client({
          webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
          connectHeaders: { Authorization: `Bearer ${token}` },
          reconnectDelay: 5000,
          onConnect: () => {
            connectedRef.current = true;
            const topic = `/topic/notifications/${role.toLowerCase()}`;
            client.subscribe(topic, (msg) => {
              try {
                const notification = JSON.parse(msg.body);

                // Nếu message có targetUserId → chỉ xử lý nếu đúng user hiện tại
                console.log('Received nofi for user:', msg.targetUserId);
                if (notification.targetUserId !== undefined) {
                  try {
                    const me = JSON.parse(localStorage.getItem('user'));
                    console.log('Received nofi for user:', me?.userId);
                    if (!me?.userId || String(me.userId) !== String(notification.targetUserId)) {
                      return;
                    }
                  } catch (_) { return; }
                }

                // Là của mình (hoặc broadcast không có targetUserId) → xử lý bình thường
                setNotifications(prev => [{ ...notification, isRead: false }, ...prev]);
                setUnreadCount(prev => prev + 1);
                if (onNewNotification) onNewNotification(notification);
              } catch (e) {
                console.error('[WS] parse error', e);
              }
            });
          },
          onDisconnect: () => { connectedRef.current = false; },
          onStompError: (err) => console.error('[STOMP] error', err),
        });

        client.activate();
        stompClientRef.current = client;
      } catch (e) {
        // SockJS/STOMP not available — graceful degrade
        console.warn('[Notifications] WebSocket unavailable, using REST only');
      }
    };

    connect();
    fetchNotifications(0);

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
        connectedRef.current = false;
      }
    };
  }, [role]); // eslint-disable-line

  return {
    notifications,
    unreadCount,
    loading,
    page,
    totalPages,
    fetchNotifications,
    markRead,
    markAllRead,
    loadMore,
  };
}
