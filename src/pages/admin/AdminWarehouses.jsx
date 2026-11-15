import { useLang } from '../../context/LangContext';
import { useEffect, useState } from 'react';
import { CardSkeleton, Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { Warehouse as WarehouseIcon, Plus, Edit2, Power, Truck, Store, Package, Factory, Boxes, PackageOpen, Archive, Gauge, FileSpreadsheet, ChevronLeft, History } from 'lucide-react';
import { adminWarehouseApi } from '../../api/adminApi';
import { SubPageButtons } from '../../components/common/SubPageNav';
import { ownerProdApi } from '../../api/productionModuleApi';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { downloadBlob } from '../../utils/downloadBlob';
import { useToast } from '../../components/common/Toast';
import useDebounce from '../../utils/useDebounce.js';
import {
  PageHeader,
  LoadingSpinner,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  Field,
  inputCls,
  selectCls,
  formatDateTime,
} from '../../components/ui';

export default function AdminWarehouses() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Trang này dùng chung cho OWNER/ADMIN và hai role kế toán. rolePrefix quyết
  // định các đường dẫn con; readOnly quyết định có được thao tác hay không.
  const rolePrefix =
    pathname.startsWith('/owner') ? '/owner'
      : pathname.startsWith('/super-accountant') ? '/super-accountant'
        : pathname.startsWith('/accountant') ? '/accountant'
          : '/admin';

  // KẾ TOÁN CHỈ XEM: không tạo / sửa / đóng kho. Quyền ghi vẫn do backend chặn;
  // ẩn nút ở đây để không bày ra thao tác chắc chắn bị từ chối.
  const readOnly = rolePrefix === '/accountant' || rolePrefix === '/super-accountant';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useMinLoading();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [activeConfirm, setActiveConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Modal "Xuất báo cáo kho"
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminWarehouseApi.list();
      setItems(res || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Kho xưởng chỉ hiển thị cho OWNER (mỗi xưởng gồm 3 kho: NL / bán TP / TP)
  const isOwner = rolePrefix === '/owner';
  const [factories, setFactories] = useState([]);
  useEffect(() => {
    if (!isOwner) return;
    ownerProdApi.listFactories()
      .then(list => setFactories((list || []).filter(f => f.status === 'ACTIVE')))
      .catch(() => setFactories([]));
  }, [isOwner]);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (w) => { setEditing(w); setFormOpen(true); };

  const confirmActive = async () => {
    if (!activeConfirm) return;
    setSaving(true);
    try {
      await adminWarehouseApi.setActive(activeConfirm.id, !activeConfirm.active);
      setActiveConfirm(null);
      load();
    } catch (e) { alert(e?.response?.data?.message || e.message); } finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={WarehouseIcon}
        {...{ title: t("warehouse", "warehouses") }}
        subtitle={t('admin', 'warehouse_count').replace('{n}', items.length)}
        action={
          <div className="flex items-center gap-2">
            {/* Xuất báo cáo kho ra Excel — hiển thị cho mọi role xem được trang này */}
            <SecondaryButton onClick={() => setReportOpen(true)}>
              <FileSpreadsheet size={15} /> Xuất báo cáo
            </SecondaryButton>
            {!readOnly && (
              <PrimaryButton onClick={openCreate}><Plus size={15} />{t('warehouse', 'create_warehouse_new')}</PrimaryButton>
            )}
          </div>
        }
      />

      {/* ── Trang phụ gom về đây ───────────────────────────────────────────
           "Lượng tiêu thụ" là trang tồn kho/biến động nguyên liệu (đổi nhãn),
           "Kho văn phòng phẩm" chỉ OWNER mới có route. */}
      <SubPageButtons
        items={[
          { to: `${rolePrefix}/inventory`, label: 'Lượng tiêu thụ', icon: Gauge },
          { to: `${rolePrefix}/supply-warehouse`, label: 'Kho văn phòng phẩm', icon: Archive,
            hidden: !isOwner && !readOnly },
        ]}
      />

      {loading ? (
        <TableSkeleton cols={4} rows={6} />
      ) : items.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm">
          <EmptyState icon={WarehouseIcon} title="Chưa có kho" description="Tạo kho đầu tiên để bắt đầu quản lý nguyên liệu" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => (
            <div key={w.id}
              className={`bg-surface rounded-2xl border border-hairline shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer ${!w.active ? 'opacity-60' : ''}`}
              onClick={() => navigate(`${rolePrefix}/warehouses/${w.id}/stock`)}>
              <div className="flex items-start justify-between gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${w.type === 'TRANSIT' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/28' : 'bg-gold/10 text-gold ring-gold/20'}`}>
                  {w.type === 'TRANSIT' ? <Truck size={22} /> : <Store size={22} />}
                </div>
                <Badge className={w.active ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28' : 'bg-canvas text-ink-2 ring-line'}>
                  {w.active ? t('status', 'active') : t('common', 'close')}
                </Badge>
              </div>

              <h3 className="font-bold text-ink text-lg mt-3 truncate">{w.name}</h3>
              <p className="text-xs text-muted mt-0.5 truncate">{w.address || t('common', 'no_data')}</p>

              <div className="flex items-center gap-1.5 mt-3">
                <Badge className={w.type === 'TRANSIT' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/28' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/28'}>
                  {w.type === 'TRANSIT' ? 'Trung chuyển' : 'Bán hàng'}
                </Badge>
                {typeof w.ingredientCount === 'number' && (
                  <Badge className="bg-canvas text-ink-2 ring-line">
                    <Package size={10} /> {w.ingredientCount} NL
                  </Badge>
                )}
              </div>

              {/* Kế toán chỉ xem — thẻ kho vẫn bấm được để mở tồn kho bên trong. */}
              {!readOnly && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-hairline">
                  <button onClick={e => { e.stopPropagation(); openEdit(w); }} className="flex-1 py-2 rounded-xl text-xs font-medium bg-canvas text-ink hover:bg-gold/10 hover:text-gold transition-colors flex items-center justify-center gap-1.5">
                    <Edit2 size={13} /> Sửa
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setActiveConfirm(w); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${w.active ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-100 dark:bg-red-500/18' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:bg-emerald-500/18'}`}
                  >
                    <Power size={13} /> {w.active ? 'Đóng kho' : 'Mở kho'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── KHO XƯỞNG (chỉ OWNER) ── */}
      {isOwner && factories.length > 0 && (
        <div className="space-y-3 pt-2">
          {factories.map(f => (
            <div key={f.id}>
              <p className="text-xs font-semibold text-muted mb-2 flex items-center gap-1.5">
                <Factory size={13} className="text-gold" /> {f.name}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
                <FactoryStockCard factory={f} kind="material" icon={Package}
                  title="Kho nguyên liệu xưởng" color="amber"
                  onClick={() => navigate(`${rolePrefix}/factory-stock?factoryId=${f.id}&kind=material`)} />
                <FactoryStockCard factory={f} kind="semi" icon={Boxes}
                  title="Kho bán thành phẩm" color="blue"
                  onClick={() => navigate(`${rolePrefix}/factory-stock?factoryId=${f.id}&kind=semi`)} />
                <FactoryStockCard factory={f} kind="finished" icon={PackageOpen}
                  title="Kho thành phẩm (kho xưởng)" color="green"
                  onClick={() => navigate(`${rolePrefix}/factory-stock?factoryId=${f.id}&kind=finished`)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <WarehouseFormModal open={formOpen} editing={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />

      <WarehouseReportModal open={reportOpen} warehouses={items} onClose={() => setReportOpen(false)} />

      <Modal
        open={!!activeConfirm}
        onClose={() => !saving && setActiveConfirm(null)}
        title={activeConfirm?.active ? 'Đóng kho' : 'Mở kho'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setActiveConfirm(null)} disabled={saving}>Hủy</SecondaryButton>
            {activeConfirm?.active
              ? <DangerButton onClick={confirmActive} loading={saving}>Xác nhận đóng</DangerButton>
              : <PrimaryButton onClick={confirmActive} loading={saving}>Xác nhận mở</PrimaryButton>
            }
          </div>
        }
      >
        <p className="text-sm text-ink">
          Bạn có chắc muốn {activeConfirm?.active ? 'đóng' : 'mở'} kho <span className="font-semibold">{activeConfirm?.name}</span>?
        </p>
      </Modal>
    </div>
  );
}

/**
 * Modal "Xuất báo cáo kho" — 2 bước:
 *   Bước 1: phạm vi — 1 kho (chọn dropdown) hay tất cả kho.
 *   Bước 2: loại báo cáo — Tồn kho hiện tại / Lịch sử kho.
 *           Chọn "Lịch sử kho" sẽ hiện thêm bộ chọn khoảng thời gian (dùng
 *           DateRangePicker có sẵn, không dùng input date mặc định).
 */
function WarehouseReportModal({ open, warehouses, onClose }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [scope, setScope] = useState('ALL');          // ALL | SINGLE
  const [warehouseId, setWarehouseId] = useState('');
  const [reportType, setReportType] = useState('CURRENT_STOCK'); // CURRENT_STOCK | HISTORY
  const [range, setRange] = useState({ from: null, to: null });
  const [exporting, setExporting] = useState(false);

  // Reset mỗi lần mở lại
  useEffect(() => {
    if (open) {
      setStep(1);
      setScope('ALL');
      setWarehouseId('');
      setReportType('CURRENT_STOCK');
      setRange({ from: null, to: null });
      setExporting(false);
    }
  }, [open]);

  const activeWarehouses = (warehouses || []);

  const step1Valid = scope === 'ALL' || (scope === 'SINGLE' && !!warehouseId);
  const needRange = reportType === 'HISTORY';
  const step2Valid = !needRange || (range.from && range.to);

  const handleExport = async () => {
    if (!step2Valid) return;
    setExporting(true);
    try {
      const body = {
        reportType,
        scope,
        warehouseId: scope === 'SINGLE' ? Number(warehouseId) : null,
        from: needRange ? range.from : null,
        to: needRange ? range.to : null,
      };
      const res = await adminWarehouseApi.exportReport(body);
      const filename = filenameFromResponse(res)
        || `bao-cao-kho_${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadBlob(res.data ?? res, filename);
      toast('Đã tạo báo cáo kho', 'success');
      onClose();
    } catch (e) {
      const msg = await readBlobError(e);
      toast(msg || 'Không tạo được báo cáo kho', 'error');
    } finally {
      setExporting(false);
    }
  };

  const selectedWarehouseName = activeWarehouses.find(w => String(w.id) === String(warehouseId))?.name;

  return (
    <Modal
      open={open}
      onClose={() => !exporting && onClose()}
      title="Xuất báo cáo kho"
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <div>
            {step === 2 && (
              <SecondaryButton onClick={() => setStep(1)} disabled={exporting}>
                <ChevronLeft size={15} /> Quay lại
              </SecondaryButton>
            )}
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose} disabled={exporting}>Hủy</SecondaryButton>
            {step === 1 ? (
              <PrimaryButton onClick={() => setStep(2)} disabled={!step1Valid}>Tiếp tục</PrimaryButton>
            ) : (
              <PrimaryButton onClick={handleExport} loading={exporting} disabled={!step2Valid}>
                <FileSpreadsheet size={15} /> Tạo báo cáo
              </PrimaryButton>
            )}
          </div>
        </div>
      }
    >
      {/* Chỉ báo bước */}
      <div className="flex items-center gap-2 mb-4 text-xs font-semibold">
        <span className={`px-2.5 py-1 rounded-full ${step === 1 ? 'bg-gold text-white' : 'bg-canvas text-muted'}`}>1. Phạm vi</span>
        <span className="text-faint">→</span>
        <span className={`px-2.5 py-1 rounded-full ${step === 2 ? 'bg-gold text-white' : 'bg-canvas text-muted'}`}>2. Loại báo cáo</span>
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ReportChoice
              selected={scope === 'ALL'}
              onClick={() => setScope('ALL')}
              icon={Boxes}
              title="Tất cả kho"
              desc="Gộp mọi kho, thêm cột tên kho"
            />
            <ReportChoice
              selected={scope === 'SINGLE'}
              onClick={() => setScope('SINGLE')}
              icon={Store}
              title="Một kho"
              desc="Chọn một kho cụ thể"
            />
          </div>
          {scope === 'SINGLE' && (
            <Field label="Chọn kho" required>
              <select className={selectCls} value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">— Chọn kho —</option>
                {activeWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.active ? '' : ' (đã đóng)'}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ReportChoice
              selected={reportType === 'CURRENT_STOCK'}
              onClick={() => setReportType('CURRENT_STOCK')}
              icon={Package}
              title="Tồn kho hiện tại"
              desc="Số lượng còn lại của từng nguyên liệu"
            />
            <ReportChoice
              selected={reportType === 'HISTORY'}
              onClick={() => setReportType('HISTORY')}
              icon={History}
              title="Lịch sử kho"
              desc="Nhập / xuất / chuyển / điều chỉnh theo thời gian"
            />
          </div>

          {needRange && (
            <Field label="Khoảng thời gian" required hint="Chỉ lấy các thao tác trong khoảng này">
              <DateRangePicker
                from={range.from}
                to={range.to}
                onChange={setRange}
                placeholder="Chọn khoảng thời gian"
              />
            </Field>
          )}

          <div className="bg-canvas rounded-xl p-3 text-xs text-muted leading-relaxed">
            <span className="font-semibold text-ink">Báo cáo: </span>
            {reportType === 'CURRENT_STOCK' ? 'Tồn kho hiện tại' : 'Lịch sử kho'}
            {' · '}
            {scope === 'ALL' ? 'Tất cả kho' : (selectedWarehouseName || 'Một kho')}
            {needRange && range.from && range.to && (
              <> {' · '}{new Date(range.from).toLocaleDateString('vi-VN')} → {new Date(range.to).toLocaleDateString('vi-VN')}</>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReportChoice({ selected, onClick, icon: Icon, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border-2 rounded-xl p-3 transition-colors ${selected ? 'border-gold bg-gold/10 text-gold' : 'border-hairline-2 hover:bg-canvas'}`}
    >
      <Icon size={18} className={selected ? '' : 'text-muted'} />
      <p className={`font-semibold text-sm mt-1.5 ${selected ? '' : 'text-ink'}`}>{title}</p>
      <p className="text-xs text-muted mt-0.5">{desc}</p>
    </button>
  );
}

/** Lấy tên file từ header Content-Disposition của response (nếu có). */
function filenameFromResponse(res) {
  try {
    const cd = res?.headers?.['content-disposition'] || res?.headers?.get?.('content-disposition');
    if (!cd) return null;
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

/** Response lỗi khi responseType='blob' trả về JSON dạng blob — đọc message ra. */
async function readBlobError(e) {
  try {
    const data = e?.response?.data;
    if (data instanceof Blob) {
      const text = await data.text();
      try { return JSON.parse(text)?.error || JSON.parse(text)?.message; } catch { return text; }
    }
    return e?.response?.data?.error || e?.response?.data?.message || e?.message;
  } catch { return null; }
}

function WarehouseFormModal({ open, editing, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState(() => ({
    name: editing?.name || '',
    address: editing?.address || '',
    type: editing?.type || 'SALE',
    active: editing?.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!form.name.trim()) { setErr('Tên kho bắt buộc'); return; }
    setSaving(true);
    try {
      if (editing) {
        await adminWarehouseApi.update(editing.id, form);
      } else {
        await adminWarehouseApi.create(form);
      }
      onSaved();
    } catch (e) { setErr(e?.response?.data?.message || e.message); } finally { setSaving(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Sửa kho: ${editing.name}` : 'Tạo kho mới'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>{editing ? 'Cập nhật' : 'Tạo kho'}</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-3">
        {err && <div className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm p-3 rounded-xl">{err}</div>}
        {!editing && (
          <div className="bg-gold/10 border border-gold/30 text-ink text-xs p-3 rounded-xl">
            💡 Khi tạo kho mới, hệ thống sẽ <strong>tự động thêm tất cả nguyên liệu hiện có</strong> vào kho với số lượng 0.
          </div>
        )}

        <Field label="Tên kho" required>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="VD: Kho trung tâm Q1" />
        </Field>

        <Field label="Địa chỉ">
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="VD: 123 Nguyễn Huệ, Q1, TPHCM" />
        </Field>

        <Field label="Loại kho" required>
          <div className="grid grid-cols-2 gap-2">
            <TypeCard
              selected={form.type === 'SALE'}
              onClick={() => setForm({ ...form, type: 'SALE' })}
              icon={Store}
              title="Bán hàng"
              desc="Nhập, xuất bán, chuyển, điều chỉnh"
              color="gold"
            />
            <TypeCard
              selected={form.type === 'TRANSIT'}
              onClick={() => setForm({ ...form, type: 'TRANSIT' })}
              icon={Truck}
              title="Trung chuyển"
              desc="Chỉ nhập & chuyển, không xuất bán"
              color="blue"
            />
          </div>
        </Field>

        <Field label="Trạng thái">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-gold' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-surface rounded-full shadow-sm transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-ink">{form.active ? t('status', 'active') : t('common', 'close')}</span>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function FactoryStockCard({ title, icon: Icon, color, onClick }) {
  const colorMap = {
    amber: 'bg-gold/10 text-gold ring-gold/20',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/28',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28',
  };
  return (
    <div onClick={onClick}
      className="bg-surface rounded-2xl border border-hairline shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ring-1 ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <h3 className="font-bold text-ink text-base mt-3">{title}</h3>
      <p className="text-xs text-muted mt-1">Nhấn để xem tồn kho</p>
    </div>
  );
}

function TypeCard({ selected, onClick, icon: Icon, title, desc, color }) {
  const sel = color === 'gold' ? 'border-gold bg-gold/10 text-gold' : 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border-2 rounded-xl p-3 transition-colors ${selected ? sel : 'border-hairline-2 hover:bg-canvas'}`}
    >
      <Icon size={18} className={selected ? '' : 'text-muted'} />
      <p className={`font-semibold text-sm mt-1.5 ${selected ? '' : 'text-ink'}`}>{title}</p>
      <p className="text-xs text-muted mt-0.5">{desc}</p>
    </button>
  );
}
