// src/context/WarehouseContext.jsx
// Context quản lý kho đang active — dùng cho WAREHOUSE và SUPER_WAREHOUSE đa kho
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const WarehouseContext = createContext(null);

export function WarehouseProvider({ children }) {
  const { user } = useAuth();

  // Danh sách kho được phân công: ưu tiên user.warehouses (đa kho), fallback warehouseId đơn
  const assignedWarehouses = user?.warehouses && user.warehouses.length > 0
    ? user.warehouses
    : user?.warehouseId
      ? [{ id: user.warehouseId, name: user.warehouseName || `Kho ${user.warehouseId}` }]
      : [];

  // Kho đang active — lưu vào sessionStorage để giữ khi reload
  const storageKey = `activeWarehouseId_${user?.userId || ''}`;

  const [activeWarehouseId, setActiveWarehouseIdState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (assignedWarehouses.some(w => w.id === parsed)) return parsed;
      }
    } catch (_) {}
    return assignedWarehouses[0]?.id ?? null;
  });

  // Nếu user thay đổi (login/logout), reset về kho đầu tiên
  useEffect(() => {
    const firstId = assignedWarehouses[0]?.id ?? null;
    setActiveWarehouseIdState(prev => {
      if (!assignedWarehouses.some(w => w.id === prev)) return firstId;
      return prev;
    });
  }, [user?.userId]); // eslint-disable-line

  const setActiveWarehouseId = useCallback((id) => {
    try { sessionStorage.setItem(storageKey, String(id)); } catch (_) {}
    setActiveWarehouseIdState(id);
  }, [storageKey]);

  const activeWarehouse = assignedWarehouses.find(w => w.id === activeWarehouseId) ?? assignedWarehouses[0] ?? null;

  return (
    <WarehouseContext.Provider value={{
      assignedWarehouses,
      activeWarehouseId:  activeWarehouse?.id   ?? null,
      activeWarehouseName: activeWarehouse?.name ?? '',
      activeWarehouse,
      setActiveWarehouseId,
      hasMultipleWarehouses: assignedWarehouses.length > 1,
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) throw new Error('useWarehouse must be used inside WarehouseProvider');
  return ctx;
}
