// src/pages/accountant/AccountantLotPricingPage.jsx
//
// PANEL ĐIỀU CHỈNH LÔ (SUPER_ACCOUNTANT).
//
// Khi nhân viên kho tạo LÔ MỚI trong phiếu điều chỉnh tồn kho, lô đó được tạo
// ngay với giá vốn tạm = 1. Trang này liệt kê các lô đó dưới dạng CARD để kế
// toán trưởng nhập giá vốn thật.
//
// Kế toán trưởng CHỈ được sửa GIÁ — số lượng / hạn sử dụng do kho quyết định.
// Giá nhập được theo 2 cách:
//   1. Đơn giá / 1 đơn vị tính
//   2. Giá tổng cả lô → server chia cho số lượng
// Giá vốn cuối cùng luôn được làm tròn tới hàng đơn vị (đồng).
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers, DollarSign, CheckCircle, Clock, RefreshCw, Warehouse, User, CalendarClock, History,
} from 'lucide-react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { lotPricingApi } from '../../api/accountantApi';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/ui/Modal';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40';

const fmtQty = (v) => Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const fmtMoney = (v) => Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');
const fmtTime = (ms) => (ms ? new Date(Number(ms)).toLocaleString('vi-VN') : '—');

/** Chỉ giữ số + 1 dấu thập phân */
const cleanNumber = (raw) => {
  const s = String(raw ?? '').replace(/[^\d.]/g, '');
  const parts = s.split('.');
  return parts.length <= 2 ? s : `${parts[0]}.${parts.slice(1).join('')}`;
};

// ═════════════════════════════════════════════════════════════════════════════
// MODAL NHẬP GIÁ VỐN CHO 1 LÔ
// ═════════════════════════════════════════════════════════════════════════════
function LotPriceModal({ lot, onClose, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('UNIT');   // UNIT = đơn giá | TOTAL = giá cả lô
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const qty = Number(lot.quantity) || 0;
  const raw = Number(input);
  const valid = input !== '' && Number.isFinite(raw) && raw > 0 && qty > 0;

  // Giá vốn/đvt — làm tròn tới hàng đơn vị, giống hệt cách backend tính
  const unitCost = useMemo(() => {
    if (!valid) return null;
    return mode === 'TOTAL' ? Math.round(raw / qty) : Math.round(raw);
  }, [valid, raw, mode, qty]);

  const lotCost = unitCost != null ? unitCost * qty : null;

  // Đổi chế độ → quy đổi số đang gõ để không mất dữ liệu
  const switchMode = (next) => {
    if (next === mode) return;
    if (valid && qty > 0) {
      setInput(next === 'TOTAL' ? String(raw * qty) : String(Math.round(raw / qty)));
    }
    setMode(next);
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const body = mode === 'TOTAL' ? { totalPrice: raw } : { unitPrice: raw };
      const res = await lotPricingApi.setPrice(lot.id, body);
      if (res.data?.status && res.data.status !== 200 && res.data?.message) {
        toast(res.data.message, 'error');
        return;
      }
      toast('Đã cập nhật giá vốn của lô', 'success');
      onDone();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Nhập giá vốn — ${lot.ingredientName}`} size="md">
      <div className="space-y-4">
        {/* Thông tin lô — CHỈ ĐỌC */}
        <div className="bg-[#FAF7F2] border border-black/5 rounded-xl p-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Field label="Kho" value={lot.warehouseName} />
          <Field label="Nguyên liệu" value={lot.ingredientName} />
          <Field label="Số lượng" value={`${fmtQty(lot.quantity)} ${lot.unit || ''}`} />
          <Field label="Hạn sử dụng" value={fmtDate(lot.expiryDate)} />
          <Field label="Người thao tác" value={lot.requestedByName || '—'} />
          <Field label="Mã phiếu" value={lot.receiptCode || '—'} />
        </div>

        {/* Chọn cách nhập giá */}
        <div>
          <p className="text-sm font-semibold text-[#1C1C1E] mb-2">Cách nhập giá</p>
          <div className="flex gap-2">
            {[
              { key: 'UNIT', label: `Đơn giá / ${lot.unit || 'đvt'}` },
              { key: 'TOTAL', label: 'Giá tổng cả lô' },
            ].map((m) => (
              <button key={m.key} onClick={() => switchMode(m.key)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                  mode === m.key
                    ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                    : 'border-black/10 text-[#555] hover:bg-gray-50'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ô nhập giá */}
        <div>
          <label className="block text-sm font-medium text-[#555] mb-1.5">
            {mode === 'TOTAL'
              ? `Tổng tiền của ${fmtQty(lot.quantity)} ${lot.unit || ''}`
              : `Giá 1 ${lot.unit || 'đơn vị'}`}
          </label>
          <div className="relative">
            <input
              className={inputCls} inputMode="decimal" autoFocus placeholder="0"
              value={input}
              onChange={(e) => setInput(cleanNumber(e.target.value))}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8E8878]">đ</span>
          </div>
        </div>

        {/* Kết quả tính */}
        {unitCost != null && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-emerald-700">Giá vốn / {lot.unit || 'đvt'}</span>
              <span className="font-bold text-emerald-800 tabular-nums">{fmtMoney(unitCost)} đ</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-700">Giá vốn cả lô</span>
              <span className="font-semibold text-emerald-800 tabular-nums">{fmtMoney(lotCost)} đ</span>
            </div>
            <p className="text-[10.5px] text-emerald-700 pt-1 border-t border-emerald-200">
              Giá vốn được làm tròn tới hàng đơn vị đồng.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-black/10 text-[#555] hover:bg-gray-50 font-medium transition">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={!valid || saving}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CheckCircle size={16} />}
            {saving ? 'Đang lưu...' : 'Lưu giá vốn'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-[#8E8878] font-semibold">{label}</p>
      <p className="text-[#1C1C1E] font-medium truncate">{value || '—'}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD 1 LÔ
// ═════════════════════════════════════════════════════════════════════════════
function LotCard({ lot, onPrice }) {
  const priced = lot.status === 'PRICED';
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:shadow-md transition flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-[#1C1C1E] text-base truncate">{lot.ingredientName}</p>
          <p className="flex items-center gap-1.5 text-xs text-[#8E8878] mt-0.5 truncate">
            <Warehouse size={12} className="flex-shrink-0" /> {lot.warehouseName}
          </p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
          priced ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {priced ? <CheckCircle size={11} /> : <Clock size={11} />}
          {priced ? 'Đã định giá' : 'Chờ giá vốn'}
        </span>
      </div>

      {/* Số liệu */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#FAF7F2] rounded-xl px-3 py-2">
          <p className="text-[10.5px] uppercase tracking-wide text-[#8E8878] font-semibold">Số lượng</p>
          <p className="text-sm font-bold text-[#1C1C1E] tabular-nums">
            {fmtQty(lot.quantity)} <span className="font-medium text-[#8E8878]">{lot.unit}</span>
          </p>
        </div>
        <div className="bg-[#FAF7F2] rounded-xl px-3 py-2">
          <p className="text-[10.5px] uppercase tracking-wide text-[#8E8878] font-semibold">Hạn sử dụng</p>
          <p className="text-sm font-bold text-[#1C1C1E] flex items-center gap-1">
            <CalendarClock size={12} className="text-[#8E8878]" /> {fmtDate(lot.expiryDate)}
          </p>
        </div>
      </div>

      {/* Người thao tác */}
      <p className="flex items-center gap-1.5 text-xs text-[#8E8878]">
        <User size={12} className="flex-shrink-0" />
        Người thao tác: <span className="text-[#1C1C1E] font-medium">{lot.requestedByName || '—'}</span>
        {lot.receiptCode && <span className="font-mono text-[#C9A84C]">· {lot.receiptCode}</span>}
      </p>

      {priced ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-emerald-700">Giá vốn / {lot.unit}</span>
            <span className="font-bold text-emerald-800 tabular-nums">{fmtMoney(lot.unitCost)} đ</span>
          </div>
          <p className="text-[10.5px] text-emerald-700 mt-1">
            {lot.pricedByName || '—'} · {fmtTime(lot.pricedAt)}
          </p>
        </div>
      ) : (
        <button onClick={() => onPrice(lot)}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#C9A84C] text-white rounded-xl text-sm font-semibold hover:bg-[#B8923E] transition">
          <DollarSign size={14} /> Nhập giá vốn
        </button>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function AccountantLotPricingPage() {
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === 'pending'
        ? await lotPricingApi.getPending()
        : await lotPricingApi.getHistory();
      setLots(res.data?.data || []);
    } catch (e) {
      toast('Không tải được danh sách lô', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Layers size={24} className="text-[#C9A84C] flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C1C1E]">Điều chỉnh lô</h1>
            <p className="text-sm text-[#8E8878]">
              Nhập giá vốn cho các lô mới do kho tạo khi điều chỉnh tồn
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'pending' && (
            <span className="bg-orange-100 text-orange-700 text-sm font-semibold px-3 py-1 rounded-full">
              {lots.length} chờ xử lý
            </span>
          )}
          <button onClick={load} disabled={loading} title="Làm mới"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-sm text-[#555] hover:bg-[#FAF7F2] transition disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'pending', label: 'Chờ giá vốn', icon: Clock },
          { key: 'history', label: 'Đã định giá', icon: History },
        ].map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition ${
              tab === tb.key
                ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                : 'bg-white border-black/10 text-[#555] hover:bg-[#FAF7F2]'
            }`}>
            <tb.icon size={14} /> {tb.label}
          </button>
        ))}
      </div>

      {/* Danh sách card */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : lots.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm text-center py-16">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
          <p className="text-lg font-semibold text-[#1C1C1E]">
            {tab === 'pending' ? 'Không có lô chờ xử lý' : 'Chưa có lô nào được định giá'}
          </p>
          <p className="text-sm text-[#8E8878] mt-1">
            {tab === 'pending'
              ? 'Tất cả lô mới đã được nhập giá vốn'
              : 'Các lô sau khi định giá sẽ hiện ở đây'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-1">
          {lots.map((lot) => (
            <LotCard key={lot.id} lot={lot} onPrice={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <LotPriceModal
          key={selected.id}
          lot={selected}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
