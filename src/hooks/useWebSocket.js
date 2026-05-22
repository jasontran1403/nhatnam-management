// src/hooks/useWebSocket.js
// Mục 2 fix: subscribe /topic/notifications/{role}/{userId}
// Singleton WS — 1 kết nối duy nhất dù nhiều component dùng hook này
import { useEffect, useRef } from 'react';

let _SockJS = null;
let _Stomp  = null;

async function loadLibs() {
  if (_SockJS && _Stomp) return;
  if (!window.SockJS) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _SockJS = window.SockJS;
  if (!window.Stomp) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  _Stomp = window.Stomp;
}

let _client     = null;
let _connecting = false;
let _connRole   = null;
let _connToken  = null;
let _retries    = 0;
const MAX_RETRY = 3;
const RETRY_MS  = 6000;

const _subscribers = new Map();
let _subIdSeq = 0;

function broadcast(msg) {
  _subscribers.forEach(cb => { try { cb(msg); } catch (_) {} });
}

async function connect(role, token) {
  if (_connecting || _client) return;
  if (_retries >= MAX_RETRY) return;
  _connecting = true;
  try {
    await loadLibs();

    // Lấy userId hiện tại
    let userId = null;
    try {
      const me = JSON.parse(localStorage.getItem('user'));
      userId = me?.userId;
    } catch (_) {}

    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:9261');
    const sock = new _SockJS(`${base}/ws`);
    const client = _Stomp.over(sock);
    client.debug = null;
    client.connect(
      { Authorization: `Bearer ${token}` },
      () => {
        _retries   = 0;
        _client    = client;
        _connecting = false;

        // Subscribe topic chính: role/userId (đúng role, đúng user)
        if (userId) {
          client.subscribe(`/topic/notifications/${role.toLowerCase()}/${userId}`, frame => {
            try { broadcast(JSON.parse(frame.body)); } catch (_) {}
          });
        }

        // Subscribe broadcast topic của role (sendToRole — không có userId)
        client.subscribe(`/topic/notifications/${role.toLowerCase()}`, frame => {
          try { broadcast(JSON.parse(frame.body)); } catch (_) {}
        });
      },
      () => {
        _client    = null;
        _connecting = false;
        _retries++;
        if (_retries < MAX_RETRY) setTimeout(() => connect(role, token), RETRY_MS);
      }
    );
  } catch (_) {
    _connecting = false;
  }
}

function disconnect() {
  try { _client?.disconnect?.(); } catch (_) {}
  _client    = null;
  _connecting = false;
  _retries   = 0;
  _connRole  = null;
  _connToken = null;
}

export default function useWebSocket(role, token, onMessage) {
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  useEffect(() => {
    if (!role || !token) return;

    if (_connRole !== role || _connToken !== token) {
      disconnect();
      _connRole  = role;
      _connToken = token;
    }

    const id = ++_subIdSeq;
    _subscribers.set(id, msg => onMsgRef.current?.(msg));

    const timer = setTimeout(() => connect(role, token), 150);

    return () => {
      clearTimeout(timer);
      _subscribers.delete(id);
      if (_subscribers.size === 0) disconnect();
    };
  }, [role, token]);
}
