// src/components/accountant/DebtReportCustomerModal.jsx
//
// Modal chọn khách hàng trước khi xuất "Báo cáo công nợ" (Aged Receivables).
// Dùng chung cho ACCOUNTANT và SUPER_ACCOUNTANT — mỗi trang chỉ cần truyền vào
// hàm `fetchCustomers` tương ứng với API mà role đó được phép gọi.
//
// Bố cục 2 CỘT (tối ưu desktop):
//   ┌──────────────────────┬─────────────────────────────────────────┐
//   │ KHÁCH HÀNG ĐÃ CHỌN   │ ô search                                │
//   │ (card cao full modal,│ ─────────────────────────────────────── │
//   │  cuộn dọc)           │ danh sách kết quả (cao full modal)      │
//   └──────────────────────┴─────────────────────────────────────────┘
// Danh sách kết quả mặc định ĐÓNG, bấm vào ô search / mũi tên để mở.
// KHÔNG phân trang: gọi API nhiều lần cho tới khi lấy hết rồi gộp thành
// một danh sách cuộn duy nhất.
//
// Props:
//   open            : boolean
//   onClose         : () => void
//   fetchCustomers  : async ({ q, page, size }) => ({ content, totalPages, totalElements })
//   onConfirm       : (customerIds: number[]) => void   // luôn ≥ 1 phần tử
//   onExportAll     : () => void                        // (tuỳ chọn) xuất toàn bộ khách hàng
//   exporting       : boolean
//   title           : string (tuỳ chọn)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, X, Check, Users, Building2, User as UserIcon, FileText, Loader2, ChevronDown,
} from 'lucide-react';

// Kích thước mỗi lần gọi API + trần số lần gọi (chặn vòng lặp vô hạn nếu BE trả sai totalPages)
const FETCH_SIZE = 200;
const MAX_FETCHES = 25;   // ⇒ tối đa 5.000 khách hàng

const displayName = (c) =>
  (c.customerType === 'COMPANY' ? (c.companyName || c.name) : c.name) || 'Khách lẻ';

const fmtMoney = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));

export default function DebtReportCustomerModal({
  open,
  onClose,
  fetchCustomers,
  onConfirm,
  onExportAll,
  exporting = false,
  title = 'Chọn khách hàng cho báo cáo công nợ',
}) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [list, setList] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);           // đang tải mẻ đầu tiên
  const [fetchingRest, setFetchingRest] = useState(false); // đang tải nốt phần còn lại
  const [error, setError] = useState('');
  const [listOpen, setListOpen] = useState(false);         // mặc định ĐÓNG

  // Map<id, customer> — giữ luôn object để chip vẫn hiện tên khi kết quả search đổi
  const [selected, setSelected] = useState(() => new Map());

  const inputRef = useRef(null);
  const reqIdRef = useRef(0);   // chống race-condition khi gõ nhanh

  // ── Reset mỗi lần mở modal ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setQ(''); setDebouncedQ('');
    setList([]); setTotalElements(0);
    setSelected(new Map());
    setError('');
    setListOpen(false);
  }, [open]);

  // ── Debounce ô search ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // ── Tải TOÀN BỘ khách hàng khớp từ khoá (không phân trang ở UI) ───────────
  const loadAll = useCallback(async () => {
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setFetchingRest(false);
    setError('');
    try {
      const acc = [];
      let p = 0;
      let pages = 1;

      while (p < pages && p < MAX_FETCHES) {
        const res = await fetchCustomers({ q: debouncedQ || undefined, page: p, size: FETCH_SIZE });
        if (myReq !== reqIdRef.current) return;   // đã có request mới hơn → bỏ kết quả cũ

        const content = res?.content || [];
        acc.push(...content);
        pages = res?.totalPages ?? 1;

        setList([...acc]);
        setTotalElements(res?.totalElements ?? acc.length);
        if (p === 0) { setLoading(false); setFetchingRest(pages > 1); }
        if (!content.length) break;
        p += 1;
      }
    } catch (e) {
      if (myReq !== reqIdRef.current) return;
      console.error(e);
      setError(e?.response?.data?.message || 'Không tải được danh sách khách hàng');
      setList([]);
    } finally {
      if (myReq === reqIdRef.current) { setLoading(false); setFetchingRest(false); }
    }
  }, [fetchCustomers, debouncedQ]);

  // Nạp sẵn ngay khi mở modal → bấm vào ô search là có data liền
  useEffect(() => { if (open) loadAll(); }, [open, debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Esc: đóng danh sách trước, sau đó mới đóng modal ──────────────────────
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (listOpen) setListOpen(false); else onClose?.();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, listOpen, onClose]);

  const selectedList = useMemo(() => [...selected.values()], [selected]);

  const toggle = (c) => {
    setSelected(prev => {
      const next = new Map(prev);
      next.has(c.id) ? next.delete(c.id) : next.set(c.id, c);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(prev => {
      const next = new Map(prev);
      list.forEach(c => next.set(c.id, c));
      return next;
    });
  };

  const clearAll = () => setSelected(new Map());

  const handleConfirm = () => {
    if (!selected.size || exporting) return;
    onConfirm?.([...selected.keys()]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !exporting && onClose?.()} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-5xl xl:max-w-6xl
                      h-[94vh] md:h-[86vh] md:max-h-[820px] md:min-h-[600px]
                      rounded-t-3xl sm:rounded-2xl shadow-2xl
                      flex flex-col animate-[slideUpDR_.18s_ease-out]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[#C9A84C]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[#1C1C1E] text-base truncate">{title}</h3>
              <p className="text-xs text-[#8E8878]">
                Chọn một hoặc nhiều khách hàng để đưa vào báo cáo công nợ
              </p>
            </div>
          </div>
          <button onClick={() => !exporting && onClose?.()}
            className="text-[#8E8878] hover:text-[#1C1C1E] p-2 rounded-lg hover:bg-[#FAF7F2] transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* ── Body: 2 cột ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 px-6 py-4 min-h-0">

          {/* ══ CỘT TRÁI: khách hàng đã chọn — card cao full modal ══ */}
          <div className="flex flex-col min-h-0 md:w-[38%] md:max-w-[440px] flex-shrink-0
                          h-[38%] md:h-auto">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <p className="text-xs font-bold text-[#8E8878] uppercase tracking-wider">
                Khách hàng đã chọn
                <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[#C9A84C]/15 text-[#C9A84C] font-bold">
                  {selected.size}
                </span>
              </p>
              {selected.size > 0 && (
                <button onClick={clearAll}
                  className="text-xs text-[#8E8878] hover:text-red-500 transition-colors">
                  Bỏ chọn tất cả
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-[#E8DDD0]
                            bg-[#FAF7F2]/50 p-2">
              {selected.size === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-[#C4B9A8] px-4 text-center">
                  <Users size={26} strokeWidth={1.5} />
                  <p className="text-xs">Chưa chọn khách hàng nào</p>
                  <p className="text-[11px]">Tìm và chọn khách hàng ở cột bên phải</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {selectedList.map(c => {
                    const isCompany = c.customerType === 'COMPANY';
                    return (
                      <div key={c.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white
                                   border border-[#E8DDD0] shadow-sm">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0
                          ${isCompany ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
                          {isCompany ? <Building2 size={13} /> : <UserIcon size={13} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[#1C1C1E] truncate">
                            {displayName(c)}
                          </span>
                          <span className="block text-[11px] text-[#8E8878] truncate">
                            {c.customerCode ? `#${c.customerCode}` : '—'}
                            {c.phone ? ` · ${c.phone}` : ''}
                          </span>
                        </span>
                        {c.unpaidDebt > 0 && (
                          <span className="text-[11px] font-bold text-red-600 shrink-0">
                            {fmtMoney(c.unpaidDebt)} đ
                          </span>
                        )}
                        <button onClick={() => toggle(c)} title="Bỏ chọn"
                          className="text-[#8E8878] hover:text-red-500 hover:bg-red-50 p-1 rounded-lg transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══ CỘT PHẢI: search + danh sách kết quả cao full modal ══ */}
          <div className="flex-1 flex flex-col min-h-0 gap-2.5">
            {/* Ô search */}
            <div className="relative flex-shrink-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={e => { setQ(e.target.value); setListOpen(true); }}
                onFocus={() => setListOpen(true)}
                onClick={() => setListOpen(true)}
                placeholder="Bấm để tìm & thêm khách hàng (tên, công ty, mã KH, SĐT)..."
                className="w-full h-11 border border-[#E8DDD0] rounded-xl pl-10 pr-20 text-sm bg-white
                           focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {q && (
                  <button onClick={() => { setQ(''); inputRef.current?.focus(); }}
                    className="text-[#8E8878] hover:text-[#1C1C1E] p-0.5">
                    <X size={15} />
                  </button>
                )}
                <button onClick={() => setListOpen(v => !v)} title={listOpen ? 'Thu gọn' : 'Mở danh sách'}
                  className="text-[#8E8878] hover:text-[#1C1C1E] p-0.5">
                  <ChevronDown size={16} className={`transition-transform ${listOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Vùng danh sách — chiếm trọn chiều cao còn lại của modal */}
            <div className="flex-1 min-h-0 rounded-xl border border-[#E8DDD0] bg-white overflow-hidden flex flex-col">
              {!listOpen ? (
                // Đóng: cả vùng là nút mở danh sách
                <button onClick={() => { setListOpen(true); inputRef.current?.focus(); }}
                  className="flex-1 w-full flex flex-col items-center justify-center gap-2 text-[#C4B9A8]
                             hover:bg-[#FAF7F2] transition-colors">
                  <Search size={26} strokeWidth={1.5} />
                  <p className="text-xs">Bấm để mở danh sách khách hàng</p>
                  {!loading && totalElements > 0 && (
                    <p className="text-[11px] text-[#8E8878]">{totalElements} khách hàng khả dụng</p>
                  )}
                </button>
              ) : (
                <>
                  {/* Thanh công cụ */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAF7F2]
                                  border-b border-[#F0EBE3] flex-shrink-0">
                    <span className="text-xs text-[#8E8878]">
                      {loading
                        ? 'Đang tải...'
                        : <>
                          {list.length}/{totalElements} khách hàng
                          {debouncedQ && <span className="ml-1">khớp "{debouncedQ}"</span>}
                          {fetchingRest && <span className="ml-1 italic">· đang tải tiếp...</span>}
                        </>}
                    </span>
                    <div className="flex items-center gap-3">
                      <button onClick={selectAllVisible} disabled={!list.length}
                        className="text-xs font-semibold text-[#C9A84C] hover:underline disabled:opacity-40">
                        Chọn tất cả ({list.length})
                      </button>
                      <button onClick={() => setListOpen(false)}
                        className="text-xs text-[#8E8878] hover:text-[#1C1C1E]">Thu gọn</button>
                    </div>
                  </div>

                  {/* Danh sách cuộn — không phân trang */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                      <div className="h-full flex items-center justify-center gap-2 text-[#8E8878] text-xs">
                        <Loader2 size={15} className="animate-spin" /> Đang tải danh sách...
                      </div>
                    ) : error ? (
                      <div className="h-full flex items-center justify-center text-xs text-red-500">{error}</div>
                    ) : list.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-[#8E8878]">
                        Không tìm thấy khách hàng phù hợp
                      </div>
                    ) : (
                      <>
                        {list.map(c => {
                          const isCompany = c.customerType === 'COMPANY';
                          const checked = selected.has(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggle(c)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                                border-b border-[#F0EBE3] last:border-0
                                ${checked ? 'bg-[#C9A84C]/10' : 'hover:bg-[#FAF7F2]'}`}>
                              <span className={`w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0
                                ${checked ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-[#E8DDD0] bg-white'}`}>
                                {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                              </span>
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0
                                ${isCompany ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
                                {isCompany ? <Building2 size={14} /> : <UserIcon size={14} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-[#1C1C1E] truncate">
                                  {displayName(c)}
                                </span>
                                <span className="block text-xs text-[#8E8878] truncate">
                                  {c.customerCode ? `#${c.customerCode}` : '—'}
                                  {c.phone ? ` · ${c.phone}` : ''}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                {c.unpaidDebt > 0 ? (
                                  <>
                                    <span className="block text-xs font-bold text-red-600">{fmtMoney(c.unpaidDebt)} đ</span>
                                    <span className="block text-[10px] text-[#8E8878]">công nợ</span>
                                  </>
                                ) : (
                                  <span className="block text-xs text-[#C4B9A8]">—</span>
                                )}
                              </span>
                            </button>
                          );
                        })}

                        {fetchingRest && (
                          <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-[#8E8878]">
                            <Loader2 size={13} className="animate-spin" /> Đang tải thêm khách hàng...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-black/5 bg-[#FAF7F2]/60 flex items-center gap-3 flex-shrink-0
                        sm:rounded-b-2xl">
          {onExportAll && (
            <button onClick={onExportAll} disabled={exporting}
              className="text-xs text-[#8E8878] hover:text-[#C9A84C] hover:underline disabled:opacity-50">
              Xuất tất cả khách hàng
            </button>
          )}
          <div className="flex-1" />
          <button onClick={() => !exporting && onClose?.()} disabled={exporting}
            className="px-5 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C5C5C] hover:border-[#C9A84C] transition-all disabled:opacity-50">
            Hủy
          </button>
          <button onClick={handleConfirm} disabled={!selected.size || exporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold
                       hover:bg-[#B8963F] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {exporting
              ? <><Loader2 size={15} className="animate-spin" /> Đang xuất...</>
              : <><FileText size={15} /> Xuất báo cáo{selected.size ? ` (${selected.size})` : ''}</>}
          </button>
        </div>
      </div>

      <style>{`@keyframes slideUpDR { from { transform: translateY(16px); opacity:0 } to { transform: translateY(0); opacity:1 } }`}</style>
    </div>
  );
}