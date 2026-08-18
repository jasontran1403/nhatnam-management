// src/components/common/AddressSelect.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check } from 'lucide-react';
import api from '../../api/axios';

/**
 * CHỌN TỈNH/THÀNH + PHƯỜNG/XÃ/ĐẶC KHU cho địa chỉ nhận hàng.
 *
 * <p>Thay cho việc gõ tay. Tên gõ tay từng gây hàng loạt lỗi khớp vùng — "Q1" không khớp,
 * "Nguyễn Huệ" bị hiểu là tỉnh Huế — và quy tắc COD tra theo đúng cặp (tỉnh, phường) nên
 * chỉ cần sai một ký tự là đơn rơi nhầm vào diện phải thu tiền trước.
 *
 * <p><b>Danh mục nạp một lần cho cả phiên.</b> File ~180KB, 34 tỉnh với 3.240 phường/xã;
 * tải một lượt rồi lọc tại chỗ thì dropdown phản hồi tức thì. Gọi API mỗi lần đổi tỉnh sẽ
 * làm người nhập phải chờ giữa hai thao tác liền nhau.
 *
 * @param province     tên tỉnh/thành đang chọn
 * @param ward         tên phường/xã đang chọn
 * @param onChange     (province, ward) — ward về rỗng khi đổi tỉnh
 * @param error        thông báo lỗi hiển thị dưới ô phường
 */

/** Cache cấp module — mọi form trong phiên dùng chung, không tải lại. */
let catalogCache = null;
let catalogPromise = null;

function loadCatalog() {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogPromise) {
    catalogPromise = api.get('/api/address-catalog')
      .then(res => {
        const body = res?.data?.data || res?.data || {};
        catalogCache = {
          defaultProvince: body.defaultProvince || 'Thành phố Hồ Chí Minh',
          provinces: body.provinces || [],
        };
        return catalogCache;
      })
      .catch(err => {
        // Xoá promise để lần mở form sau còn thử lại được; giữ lại sẽ khiến lỗi mạng
        // tạm thời làm hỏng dropdown suốt phiên.
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export default function AddressSelect({ province, ward, onChange, error, compact = false }) {
  const [catalog, setCatalog] = useState(catalogCache);
  const [loading, setLoading] = useState(!catalogCache);

  useEffect(() => {
    if (catalogCache) return;
    let alive = true;
    loadCatalog()
      .then(c => { if (alive) { setCatalog(c); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Mặc định TP.HCM khi form mở lần đầu và chưa có tỉnh nào.
  useEffect(() => {
    if (!catalog || province) return;
    onChange(catalog.defaultProvince, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog]);

  const provinces = catalog?.provinces || [];
  const wards = useMemo(() => {
    const p = provinces.find(x => x.name === province);
    return p?.wards || [];
  }, [provinces, province]);

  const size = compact ? 'py-1.5 text-xs' : 'py-2 text-sm';

  return (
    <div className="space-y-1.5">
      <Combo
        label="Tỉnh/Thành phố"
        value={province}
        placeholder={loading ? 'Đang tải...' : 'Chọn tỉnh/thành phố'}
        options={provinces.map(p => ({ value: p.name, label: p.name, hint: p.type }))}
        // Đổi tỉnh thì XOÁ phường: phường cũ gần như chắc chắn không thuộc tỉnh mới,
        // giữ lại sẽ tạo ra cặp (tỉnh, phường) không tồn tại và backend từ chối.
        onSelect={v => onChange(v, '')}
        disabled={loading}
        sizeCls={size}
      />

      <Combo
        label="Phường/Xã/Đặc khu"
        value={ward}
        placeholder="Vui lòng chọn Phường/Xã/Đặc khu"
        options={wards.map(w => ({ value: w.name, label: w.name, hint: w.type }))}
        onSelect={v => onChange(province, v)}
        disabled={loading || !province}
        emptyText={province ? 'Tỉnh/thành này chưa có dữ liệu phường/xã' : 'Chọn tỉnh/thành trước'}
        sizeCls={size}
        invalid={!!error}
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Dropdown có ô tìm kiếm, danh sách render qua PORTAL.
 *
 * <p>Portal là bắt buộc ở đây: component này nằm trong modal có vùng cuộn riêng, danh sách
 * 3.000 mục đặt absolute sẽ bị cắt mất phần dưới.
 */
function Combo({ label, value, placeholder, options, onSelect, disabled,
                 emptyText = 'Không tìm thấy', sizeCls, invalid }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return options;
    return options.filter(o => norm(o.label).includes(needle));
  }, [options, q]);

  const toggle = () => {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < 260 && r.top > spaceBelow;
      setPos({ left: r.left, width: r.width, top: openUp ? r.top - 6 : r.bottom + 6, openUp });
    }
    setQ('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <div>
      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
        {label} <span className="text-red-400">*</span>
      </label>
      <button
        ref={btnRef} type="button" onClick={toggle} disabled={disabled}
        className={`w-full px-3 ${sizeCls} rounded-lg border flex items-center justify-between gap-2
          text-left transition-colors disabled:opacity-50
          ${invalid ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4'
                    : 'border-line hover:border-gold focus:border-gold'}`}>
        <span className={value ? 'text-ink truncate' : 'text-faint truncate'}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
          <div
            style={{
              left: pos.left, width: pos.width, top: pos.top,
              transform: pos.openUp ? 'translateY(-100%)' : undefined,
            }}
            className="fixed z-[96] bg-surface border border-line rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-hairline">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={13} />
                <input
                  ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Tìm nhanh..."
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-line text-xs
                             bg-surface text-ink focus:outline-none focus:border-gold" />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-faint italic text-center py-4">{emptyText}</p>
              ) : filtered.map(o => (
                <button
                  key={o.value} type="button"
                  onClick={() => { onSelect(o.value); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                    ${o.value === value ? 'bg-gold/15 text-ink font-semibold' : 'hover:bg-canvas text-ink-2'}`}>
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-[10px] text-faint shrink-0">{o.hint}</span>}
                  {o.value === value && <Check size={12} className="text-gold shrink-0" />}
                </button>
              ))}
            </div>

            {filtered.length > 0 && (
              <div className="px-3 py-1.5 border-t border-hairline text-[10px] text-faint">
                {filtered.length} kết quả
              </div>
            )}
          </div>
        </>,
        document.body)}
    </div>
  );
}

/** Bỏ dấu để gõ "sai gon" cũng tìm ra "Phường Sài Gòn". */
function norm(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().trim();
}
