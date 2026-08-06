// src/components/warehouse/WarehouseSelector.jsx
// Dropdown chọn kho — chỉ hiện khi user quản lý nhiều kho
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Warehouse, Check } from 'lucide-react';
import { useWarehouse } from '../../context/WarehouseContext';
import { useLang } from '../../context/LangContext';

/**
 * @param {boolean} compact  nút gọn hơn (dùng trong thanh công cụ chật)
 * @param {string}  align    'left' | 'right' — mép nào của menu dính vào nút.
 *
 *   Mặc định 'right' vì nút này gần như luôn nằm ở góc PHẢI header. Neo mép
 *   trái (bản cũ) khiến menu bung sang phải và tràn ra ngoài khung, bị cắt mất
 *   phần tên kho. Truyền 'left' khi đặt nút ở phía trái màn hình.
 */
export default function WarehouseSelector({ compact = false, align = 'right' }) {
  const { t } = useLang();
  const {
    assignedWarehouses,
    activeWarehouseName,
    activeWarehouseId,
    setActiveWarehouseId,
    hasMultipleWarehouses,
  } = useWarehouse();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!hasMultipleWarehouses) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold">
        <Warehouse size={13} />
        <span className="truncate max-w-[120px]">{activeWarehouseName || t('warehouse', 'warehouse')}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all
          ${open
            ? 'bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40'
            : 'bg-[#C9A84C]/10 text-[#C9A84C] hover:bg-[#C9A84C]/20 border border-transparent'}
          ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
      >
        <Warehouse size={13} />
        <span className="truncate max-w-[120px]">{activeWarehouseName || t('warehouse', 'select_warehouse')}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full mt-1 z-50 min-w-[180px] max-w-[70vw] bg-white
          rounded-xl shadow-xl border border-[#E8DDD0] py-1 overflow-hidden
          ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <p className="text-[10px] uppercase font-semibold text-[#8E8878] tracking-wider px-3 py-1.5">
            {t('warehouse', 'select_warehouse')}
          </p>
          {assignedWarehouses.map(w => (
            <button
              key={w.id}
              onClick={() => { setActiveWarehouseId(w.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors
                ${w.id === activeWarehouseId
                  ? 'bg-[#C9A84C]/10 text-[#C9A84C] font-semibold'
                  : 'text-[#1C1C1E] hover:bg-[#FAF7F2]'}`}
            >
              <Warehouse size={14} />
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === activeWarehouseId && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}