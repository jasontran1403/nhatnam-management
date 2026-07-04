// src/pages/owner/OwnerMaterialStockPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, AlertTriangle, Search, ArrowDownAZ, ArrowUpZA, CalendarClock, ChevronLeft, Plus } from 'lucide-react';
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton, Field, inputCls } from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal';
import { ownerMaterialStockApi } from '../../api/materialRequestApi.js';
import { factoryMaterialApi } from '../../api/productionApi';
import { useToast } from '../../components/common/Toast.jsx';

const MATERIAL_UNITS = ['Kg', 'Gr', 'Lít', 'Túi', 'Hộp', 'Bịch', 'Thùng', 'Chai', 'Lon', 'Can'];

function fmtQty(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v || 0));
}
function fmtDate(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function daysLeft(ms) {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / 86400000);
}

// Hạn dùng gần nhất của 1 nguyên liệu (dùng để sort theo "lô hết hạn")
// — null (không có HSD) coi như xa nhất.
function nearestExpiry(item) {
  const dates = (item.lots || []).map(l => l.expiryDate).filter(Boolean);
  if (dates.length === 0) return null;
  return Math.min(...dates);
}

const NAME_SORTS = {
  az: { label: 'Tên A → Z', icon: ArrowDownAZ },
  za: { label: 'Tên Z → A', icon: ArrowUpZA },
};
const EXPIRY_SORTS = {
  near: { label: 'Hết hạn: Gần → Xa', icon: CalendarClock },
  far:  { label: 'Hết hạn: Xa → Gần', icon: CalendarClock },
};

function MaterialDetail({ item, onBack }) {
  const sortedLots = [...(item.lots || [])].sort((a, b) => {
    // gần hết hạn nhất lên đầu; lô không có HSD xuống cuối
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate - b.expiryDate;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> Quay lại danh sách tồn kho
      </button>

      <PageHeader icon={Package} title={item.materialName}
        subtitle={`Tổng: ${fmtQty(item.totalQty)} ${item.unit} · ${item.lots?.length || 0} lô`} />

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-black/5 bg-[#FAF7F2]">
          <h3 className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">
            Chi tiết các lô — sắp xếp gần hết hạn nhất trước
          </h3>
        </div>
        <div className="divide-y divide-black/5">
          {sortedLots.map((lot, i) => {
            const days = daysLeft(lot.expiryDate);
            return (
              <div key={lot.id || i} className={`flex items-center justify-between px-5 py-3.5 ${lot.nearExpiry ? 'bg-amber-50' : ''}`}>
                <div>
                  <p className="text-sm font-semibold text-[#1C1C1E]">{fmtQty(lot.quantity)} {item.unit}</p>
                  <p className="text-xs text-[#8E8878]">Ban đầu: {fmtQty(lot.initialQuantity)} {item.unit}</p>
                </div>
                <div className="text-right">
                  {lot.expiryDate ? (
                    <>
                      <p className={`text-sm font-medium ${lot.nearExpiry ? 'text-amber-700' : 'text-[#1C1C1E]'}`}>
                        HSD: {fmtDate(lot.expiryDate)}
                      </p>
                      {days != null && (
                        <p className={`text-xs ${days <= 7 ? 'text-red-600 font-semibold' : days <= 30 ? 'text-amber-600' : 'text-[#8E8878]'}`}>
                          {days >= 0 ? `còn ${days} ngày` : `quá hạn ${-days} ngày`}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-[#8E8878]">Không có HSD</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tạo nguyên liệu mới (chỉ Owner) ──────────────────────────────────────────
function CreateMaterialModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', unit: 'Kg', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Vui lòng nhập tên nguyên liệu'); return; }
    if (!form.unit) { setErr('Vui lòng chọn đơn vị'); return; }
    setSaving(true);
    try {
      const created = await factoryMaterialApi.create({
        name: form.name.trim(),
        unit: form.unit,
        description: form.description.trim() || null,
      });
      toast(`Đã tạo nguyên liệu "${created?.name || form.name}"`, 'success');
      onCreated(created);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open title="Tạo nguyên liệu mới" onClose={onClose} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>Tạo nguyên liệu</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label="Tên nguyên liệu" required>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Thịt nạc dăm" autoFocus />
        </Field>
        <Field label="Đơn vị" required>
          <select className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)}>
            {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Mô tả (không bắt buộc)">
          <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export default function OwnerMaterialStockPage() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [nameSort, setNameSort] = useState(null);     // 'az' | 'za' | null
  const [expirySort, setExpirySort] = useState(null);  // 'near' | 'far' | null
  const [selected, setSelected] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const reload = () => {
    setLoading(true);
    ownerMaterialStockApi.getStock()
      .then(d => setStocks(d || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    let list = stocks.filter(s => !search || s.materialName.toLowerCase().includes(search.toLowerCase()));

    if (expirySort) {
      list = [...list].sort((a, b) => {
        const ea = nearestExpiry(a), eb = nearestExpiry(b);
        if (ea == null && eb == null) return 0;
        if (ea == null) return 1;   // không HSD -> coi như xa nhất
        if (eb == null) return -1;
        return expirySort === 'near' ? ea - eb : eb - ea;
      });
    } else if (nameSort) {
      list = [...list].sort((a, b) =>
        nameSort === 'az'
          ? a.materialName.localeCompare(b.materialName, 'vi')
          : b.materialName.localeCompare(a.materialName, 'vi'));
    }
    return list;
  }, [stocks, search, nameSort, expirySort]);

  const nearExpiryCount = stocks.reduce((acc, s) => acc + (s.lots || []).filter(l => l.nearExpiry).length, 0);

  if (selected) {
    const fresh = stocks.find(s => s.materialName === selected.materialName && s.unit === selected.unit) || selected;
    return <MaterialDetail item={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={() => navigate('/owner/production')}
        className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> Quay lại Tổng quan sản xuất
      </button>

      <PageHeader icon={Package} title="Tồn kho nguyên liệu sản xuất"
        subtitle={`${stocks.length} loại nguyên liệu`}
        action={
          <PrimaryButton onClick={() => setShowCreateModal(true)}>
            <Plus size={15} /> Tạo nguyên liệu
          </PrimaryButton>
        } />

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
          <p className="text-xs text-[#8E8878]">Số loại nguyên liệu</p>
          <p className="text-2xl font-bold text-[#1A2B1A] mt-1">{stocks.length}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${nearExpiryCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
          <p className="text-xs text-[#8E8878]">Lô sắp hết hạn (&lt;30 ngày)</p>
          <p className={`text-2xl font-bold mt-1 ${nearExpiryCount > 0 ? 'text-amber-700' : 'text-[#1A2B1A]'}`}>{nearExpiryCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-[#FAF7F2] placeholder-[#8E8878]"
            placeholder="Tìm tên nguyên liệu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8E8878] font-medium">Tên:</span>
          {Object.entries(NAME_SORTS).map(([key, cfg]) => (
            <button key={key}
              onClick={() => { setNameSort(s => s === key ? null : key); setExpirySort(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${nameSort === key ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
              <cfg.icon size={12} />{cfg.label}
            </button>
          ))}
          <span className="text-xs text-[#8E8878] font-medium ml-2">Hạn dùng:</span>
          {Object.entries(EXPIRY_SORTS).map(([key, cfg]) => (
            <button key={key}
              onClick={() => { setExpirySort(s => s === key ? null : key); setNameSort(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${expirySort === key ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-amber-600'}`}>
              <cfg.icon size={12} />{cfg.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Không tìm thấy nguyên liệu" />
      ) : (
        <div className="space-y-3">
          {filtered.map((item, i) => {
            const nearExpiryLots = (item.lots || []).filter(l => l.nearExpiry);
            const hasWarning = nearExpiryLots.length > 0;
            const nearest = nearestExpiry(item);
            return (
              <button key={i} onClick={() => setSelected(item)}
                className={`w-full text-left rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all ${hasWarning ? 'bg-amber-50 border-amber-200' : 'bg-white border-black/5'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1C1C1E]">{item.materialName}</span>
                      {hasWarning && (
                        <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                          <AlertTriangle size={10} /> {nearExpiryLots.length} lô sắp hết hạn
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-[#1A2B1A] mt-1">
                      {fmtQty(item.totalQty)}
                      <span className="text-xs text-[#8E8878] bg-[#F5F0EB] px-2 py-0.5 rounded-full ml-1">{item.unit}</span>
                    </p>
                    {nearest && (
                      <p className="text-xs text-[#8E8878] mt-1">Gần hết hạn nhất: {fmtDate(nearest)}</p>
                    )}
                  </div>
                  <span className="text-xs text-[#8E8878] flex-shrink-0">{item.lots?.length || 0} lô</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateMaterialModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); reload(); }}
        />
      )}
    </div>
  );
}
