// src/hooks/useNotifications.js
// Mục 2 fix: subscribe /topic/notifications/{role}/{userId}
// — đúng role đang login, không bị nhận noti nhầm khi user có multi-role
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export function useNotifications(role, onNewNotification) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const [page, setPage]                   = useState(0);
  const [totalPages, setTotalPages]       = useState(1);
  const stompClientRef = useRef(null);
  const connectedRef   = useRef(false);

  // ── Fetch REST ───────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (pageNum = 0) => {
    try {
      setLoading(true);
      const res  = await api.get('/api/notifications', { params: { page: pageNum, size: 20 } });
      const data = res.data?.data;
      if (data) {
        if (pageNum === 0) setNotifications(data.content || []);
        else               setNotifications(prev => [...prev, ...(data.content || [])]);
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

  // ── Handle incoming WS message ───────────────────────────────────
  const handleMessage = useCallback((msg) => {
    try {
      const notification = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg;
      setNotifications(prev => [{ ...notification, isRead: false }, ...prev]);
      setUnreadCount(prev => prev + 1);
      if (onNewNotification) onNewNotification(notification);
    } catch (e) {
      console.error('[WS] parse error', e);
    }
  }, [onNewNotification]);

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
        const [{ default: SockJS }, { Client }] = await Promise.all([
          import('sockjs-client'),
          import('@stomp/stompjs'),
        ]);

        // Lấy userId từ localStorage
        let userId = null;
        try {
          const me = JSON.parse(localStorage.getItem('user'));
          userId = me?.userId;
        } catch (_) {}

        client = new Client({
          webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
          connectHeaders: { Authorization: `Bearer ${token}` },
          reconnectDelay: 5000,
          onConnect: () => {
            connectedRef.current = true;

            // ── Topic chính: role + userId ── không nhận nhầm khi multi-role
            if (userId) {
              const topic = `/topic/notifications/${role.toLowerCase()}/${userId}`;
              client.subscribe(topic, handleMessage);
            }

            // ── Broadcast topic cho role (sendToRole, không có userId) ──
            const broadcastTopic = `/topic/notifications/${role.toLowerCase()}`;
            client.subscribe(broadcastTopic, handleMessage);
          },
          onDisconnect: () => { connectedRef.current = false; },
          onStompError: (err) => console.error('[STOMP] error', err),
        });

        client.activate();
        stompClientRef.current = client;
      } catch (e) {
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
