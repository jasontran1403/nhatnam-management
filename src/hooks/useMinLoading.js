/**
 * useMinLoading — đảm bảo loading state tối thiểu MIN_MS (default 600ms).
 * Tránh skeleton flash khi API quá nhanh.
 *
 * Usage:
 *   const [loading, setLoading] = useMinLoading();        // bắt đầu false (form/action)
 *   const [loading, setLoading] = useMinLoading(true);    // bắt đầu true  (fetch data ngay khi mount)
 */
import { useState, useRef, useCallback } from 'react';

const MIN_MS = 600;

export default function useMinLoading(initial = false) {
  const [loading, _setLoading] = useState(initial);
  const startRef = useRef(initial ? Date.now() : null);
  const timerRef = useRef(null);

  const setLoading = useCallback((val) => {
    if (val) {
      // Bắt đầu loading — ghi thời điểm start
      startRef.current = Date.now();
      clearTimeout(timerRef.current);
      _setLoading(true);
    } else {
      // Kết thúc loading — đảm bảo tối thiểu MIN_MS
      const elapsed = startRef.current ? Date.now() - startRef.current : MIN_MS;
      const remain  = Math.max(0, MIN_MS - elapsed);
      clearTimeout(timerRef.current);
      if (remain <= 0) {
        _setLoading(false);
      } else {
        timerRef.current = setTimeout(() => _setLoading(false), remain);
      }
    }
  }, []);

  return [loading, setLoading];
}