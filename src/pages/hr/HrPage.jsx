// src/pages/hr/HrPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, FileText, Clock, Plus, Search, ChevronDown, ChevronUp,
  DollarSign, Calendar, UserCog, X, Check, Loader2, AlertCircle, Download, Upload,
  Calculator, Send, Eye, Trash2,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { hrSalaryApi, hrLeaveApi, hrOtApi, hrEmployeeApi, payrollApi, allowanceLabelApi } from '../../api/hrApi';
import { downloadBlob } from '../../api/services';
import api from '../../api/axios';
import {
  PageHeader, PrimaryButton, SecondaryButton, Field, inputCls, selectCls,
  Table, Thead, Th, Td, Tr, TabBar, EmptyState, LoadingSpinner,
  formatCurrency, formatDate, formatDateTime, SectionCard,
} from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import DateRangePicker from '../../components/ui/DateRangePicker';
import SalaryBreakdownCards from '../../components/hr/SalaryBreakdownCards';
import EmployeeRequestsPanel from '../../components/hr/EmployeeRequestsPanel';

// ── Helper: format số kiểu Việt Nam khi gõ (chỉ số nguyên, có dấu chấm ngăn cách) ──
const digitsOnly = (s) => String(s ?? '').replace(/[^\d]/g, '');
const formatVnInt = (s) => {
  const d = digitsOnly(s);
  return d ? Number(d).toLocaleString('vi-VN') : '';
};
const toNumber = (s) => Number(digitsOnly(s) || 0);

/** Ô nhập tiền VNĐ: hiển thị có ngăn cách hàng nghìn, chỉ cho số nguyên. */
function MoneyInput({ value, onChange, placeholder, autoFocus, className }) {
  return (
    <input
      className={className || inputCls}
      inputMode="numeric"
      value={formatVnInt(value)}
      onChange={(e) => onChange(digitsOnly(e.target.value))}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}



// ── Salary Modal (single) — lương trước thuế + phụ cấp + thưởng ──────────────
// TaxToggle ĐÃ BỎ: mọi phụ cấp và thưởng đều cộng vào thu nhập rồi mới tính
// thuế TNCN, không còn khoản nào "miễn thuế" để bật/tắt.

function SalaryModal({ user, onClose, onSaved }) {
  const { t } = useLang();
  const toast = useToast();
  const [baseSalary, setBaseSalary] = useState('');
  const [insuranceSalary, setInsuranceSalary] = useState('');
  const [allowances, setAllowances] = useState([]); // [{label, amount, taxable}]
  const [bonus, setBonus] = useState('');
  const [bonusTaxable, setBonusTaxable] = useState(true);  // luôn chịu thuế
  const [dependents, setDependents] = useState('0');
  const [partTime, setPartTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [current, setCurrent] = useState(null);

  const [labels, setLabels] = useState([]);
  const [newLabelFor, setNewLabelFor] = useState(-1); // index đang tạo nhãn mới
  const [newLabelText, setNewLabelText] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // Tải lương hiện hành + danh mục nhãn phụ cấp
  useEffect(() => {
    let active = true;
    setLoadingCurrent(true);
    Promise.all([
      hrSalaryApi.getCurrent(user.id).catch(() => null),
      allowanceLabelApi.list().catch(() => []),
    ]).then(([data, lbls]) => {
      if (!active) return;
      if (Array.isArray(lbls)) setLabels(lbls);
      setCurrent(data);
      if (data) {
        setBaseSalary(data.baseSalary != null ? String(data.baseSalary) : '');
        setInsuranceSalary(data.insuranceSalary != null && data.insuranceSalary > 0 ? String(data.insuranceSalary) : '');
        setBonus(data.bonus != null ? String(data.bonus) : '');
        setBonusTaxable(true);
        setDependents(data.dependents != null ? String(data.dependents) : '0');
        setPartTime(Boolean(data.partTime));
        if (Array.isArray(data.allowances) && data.allowances.length > 0) {
          setAllowances(data.allowances.map(a => ({
            label: a.label || '', amount: String(a.amount ?? ''), taxable: true,
          })));
        } else if (data.allowance) {
          setAllowances([{ label: 'Phụ cấp', amount: String(data.allowance), taxable: true }]);
        }
      }
    }).finally(() => { if (active) setLoadingCurrent(false); });
    return () => { active = false; };
  }, [user.id]);

  // Payload gửi lên (dùng cho cả preview lẫn submit)
  const buildPayload = useCallback(() => ({
    userId: user.id,
    baseSalary: toNumber(baseSalary),
    insuranceSalary: toNumber(insuranceSalary),
    bonus: toNumber(bonus),
    bonusTaxable,
    dependents: Number(digitsOnly(dependents) || 0),
    partTime,
    allowances: allowances
      .filter(a => toNumber(a.amount) > 0)
      .map(a => ({ label: a.label || 'Phụ cấp', amount: toNumber(a.amount), taxable: true })),
  }), [user.id, baseSalary, insuranceSalary, bonus, bonusTaxable, dependents, partTime, allowances]);

  // Live preview (debounce 450ms) — gọi cùng công thức backend để khớp màn Owner
  useEffect(() => {
    if (loadingCurrent) return;
    if (toNumber(baseSalary) <= 0) { setPreview(null); return; }
    setPreviewing(true);
    const payload = buildPayload();
    const timer = setTimeout(() => {
      hrSalaryApi.preview(payload)
        .then(setPreview)
        .catch(() => setPreview(null))
        .finally(() => setPreviewing(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [buildPayload, loadingCurrent, baseSalary]);

  const addAllowance = () => setAllowances(a => [...a, { label: labels[0]?.name || 'Phụ cấp', amount: '', taxable: true }]);
  const updateAllowance = (i, patch) => setAllowances(a => a.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeAllowance = (i) => setAllowances(a => a.filter((_, idx) => idx !== i));

  const onSelectLabel = (i, val) => {
    if (val === '__new__') { setNewLabelFor(i); setNewLabelText(''); }
    else updateAllowance(i, { label: val });
  };
  const confirmNewLabel = async (i) => {
    const name = newLabelText.trim();
    if (!name) { setNewLabelFor(-1); return; }
    try {
      const created = await allowanceLabelApi.create(name);
      setLabels(ls => ls.some(l => l.name === created.name) ? ls : [...ls, created]);
      updateAllowance(i, { label: created.name });
    } catch (e) { toast(e.message || 'Không tạo được nhãn', 'error'); }
    finally { setNewLabelFor(-1); setNewLabelText(''); }
  };

  const submit = async () => {
    if (toNumber(baseSalary) <= 0) { toast('Vui lòng nhập lương cơ bản', 'error'); return; }
    setSaving(true);
    try {
      await hrSalaryApi.set(buildPayload());
      toast(t('hr', 'salary_pending_owner'), 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  const statusLabel = current?.status === 'PENDING' ? 'Đang chờ Owner duyệt'
    : current?.status === 'APPROVED' ? 'Đã được duyệt'
    : current?.status === 'REJECTED' ? 'Đã bị từ chối' : null;

  return (
    <Modal open onClose={onClose} title={`${t('hr', 'update_salary')} — ${user.fullName}`} size="xl">
      {loadingCurrent ? (
        <div className="py-6 flex justify-center"><Loader2 size={20} className="animate-spin text-muted" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {/* ── Cột trái: form nhập ── */}
          <div className="space-y-3 py-1">
            {current && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Lương hiện tại: <strong>{Number(current.baseSalary || 0).toLocaleString('vi-VN')}đ</strong>
                {statusLabel && <span> — {statusLabel}</span>}
                {current.rejectReason && <p className="mt-1 text-red-600 dark:text-red-300">Lý do từ chối: {current.rejectReason}</p>}
                <p className="mt-1 text-amber-600 dark:text-amber-300">Lưu lại sẽ tạo phiếu lương mới chờ Owner duyệt.</p>
              </div>
            )}

            <Field label="Lương cơ bản (VNĐ/tháng)" required
              hint="Lương NET thực nhận cố định — chưa gồm phụ cấp, thưởng. Hệ thống tự suy ngược GROSS, bảo hiểm & thuế TNCN.">
              <MoneyInput value={baseSalary} onChange={setBaseSalary} placeholder="VD: 7.719.000" autoFocus />
            </Field>

            <Field label="Lương đóng thuế/bảo hiểm (VNĐ/tháng)"
              hint="Căn cứ đóng BHXH/BHYT/BHTN — bảo hiểm (NLĐ 10,5% & DN 21,5%) tính cố định trên mức này. Để trống = bằng lương cơ bản.">
              <MoneyInput value={insuranceSalary} onChange={setInsuranceSalary} placeholder="VD: 5.682.000" />
            </Field>

            {/* Phụ cấp động */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-ink">Phụ cấp</label>
                <button type="button" onClick={addAllowance}
                  className="text-xs text-gold-deep font-medium flex items-center gap-1 hover:underline">
                  <Plus size={13} /> Thêm khoản
                </button>
              </div>
              <div className="space-y-2">
                {allowances.length === 0 && (
                  <p className="text-xs text-muted">Chưa có phụ cấp. Bấm "Thêm khoản" để thêm (cơm trưa, xăng xe…).</p>
                )}
                {allowances.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    {newLabelFor === i ? (
                      <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                        <input className={`${inputCls} !py-1.5 text-sm`} autoFocus value={newLabelText}
                          onChange={e => setNewLabelText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && confirmNewLabel(i)}
                          placeholder="Tên khoản phụ cấp mới" />
                        <button type="button" className="text-emerald-600 dark:text-emerald-300" onClick={() => confirmNewLabel(i)}><Check size={16} /></button>
                        <button type="button" className="text-muted" onClick={() => setNewLabelFor(-1)}><X size={16} /></button>
                      </div>
                    ) : (
                      <select className={`${selectCls} !py-1.5 text-sm flex-1 min-w-[130px]`}
                        value={a.label} onChange={e => onSelectLabel(i, e.target.value)}>
                        {!labels.some(l => l.name === a.label) && a.label && <option value={a.label}>{a.label}</option>}
                        {labels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                        <option value="__new__">＋ Tạo nhãn mới…</option>
                      </select>
                    )}
                    <div className="w-[120px]">
                      <MoneyInput className={`${inputCls} !py-1.5 text-sm`} value={a.amount}
                        onChange={v => updateAllowance(i, { amount: v })} placeholder="Số tiền" />
                    </div>
                    <button type="button" className="text-red-400 hover:text-red-600 dark:text-red-300 p-1" onClick={() => removeAllowance(i)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Thưởng */}
            <Field label="Thưởng (VNĐ/tháng)"
              hint="Thưởng KPI — sẽ được nhân theo tỷ lệ KPI đạt được khi tính lương.">
              <div className="flex items-center gap-1.5">
                <div className="flex-1"><MoneyInput value={bonus} onChange={setBonus} placeholder="VD: 8.360.000" /></div>
              </div>
            </Field>

            <Field label="Số người phụ thuộc"
              hint="Mỗi người phụ thuộc giảm trừ thêm 6.200.000đ/tháng khi tính thuế TNCN.">
              <input className={inputCls} inputMode="numeric" value={dependents}
                onChange={e => setDependents(digitsOnly(e.target.value))} placeholder="0" />
            </Field>

            <div className="mt-3 px-1">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none group">
                <input type="checkbox" checked={partTime}
                  onChange={e => setPartTime(e.target.checked)}
                  className="w-4 h-4 rounded border-line text-brand accent-brand focus:ring-brand/30" />
                <span className="text-ink group-hover:text-brand transition-colors">
                  Nhân viên part-time
                  <span className="text-muted text-xs ml-1">(bán thời gian — 0.5 công/ngày)</span>
                </span>
              </label>
            </div>
          </div>

          {/* ── Cột phải: preview giống màn Owner ── */}
          <div className="md:border-l md:border-line md:pl-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Xem trước chi tiết lương</p>
              {previewing && <Loader2 size={13} className="animate-spin text-muted" />}
            </div>
            {preview ? (
              <SalaryBreakdownCards row={preview} />
            ) : (
              <div className="text-xs text-muted py-8 text-center">Nhập lương cơ bản để xem chi tiết bảo hiểm, thuế và lương thực nhận.</div>
            )}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} disabled={loadingCurrent} className="flex-1">Gửi duyệt</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Batch Salary Modal — lương thực nhận + phụ cấp + thưởng + người phụ thuộc ──
function BatchSalaryModal({ userIds, onClose, onSaved }) {
  const toast = useToast();
  const [baseSalary, setBaseSalary] = useState('');
  const [insuranceSalary, setInsuranceSalary] = useState('');
  const [allowance, setAllowance] = useState('');
  const [bonus, setBonus] = useState('');
  const [dependents, setDependents] = useState('0');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!baseSalary) { toast('Vui lòng nhập lương thực nhận', 'error'); return; }
    setSaving(true);
    try {
      await hrSalaryApi.setBatch({
        userIds,
        baseSalary: Number(baseSalary),
        insuranceSalary: Number(insuranceSalary) || 0,
        allowance: Number(allowance) || 0,
        bonus: Number(bonus) || 0,
        dependents: Number(dependents) || 0,
      });
      toast(`Đã gửi phiếu lương cho ${userIds.length} nhân viên`, 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Lỗi khi lưu', 'error');
    } finally { setSaving(false); }
  };

  const totalReceived = (Number(baseSalary) || 0) + (Number(allowance) || 0) + (Number(bonus) || 0);

  return (
    <Modal open onClose={onClose} title={`Set lương hàng loạt (${userIds.length} nhân viên)`}>
      <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2 mb-3">
        Lương thực nhận, lương đóng thuế/BH, phụ cấp, thưởng, số người phụ thuộc dưới đây sẽ được áp dụng cho tất cả nhân viên đã chọn.
      </p>
      <div className="space-y-3 py-1">
        <Field label="Lương trước thuế (VNĐ/tháng)" required
          hint="Lương NET thực nhận — chưa gồm phụ cấp, thưởng. Hệ thống sẽ tự tính ngược ra lương GROSS, bảo hiểm và thuế TNCN.">
          <input className={inputCls} type="number" value={baseSalary}
            onChange={e => setBaseSalary(e.target.value)} placeholder="VD: 12000000" autoFocus />
        </Field>
        <Field label="Lương đóng thuế/bảo hiểm (VNĐ/tháng)"
          hint="Căn cứ đóng BHXH/BHYT/BHTN — bảo hiểm (NLĐ & DN) tính trên mức này. Để trống = bằng lương thực nhận.">
          <input className={inputCls} type="number" value={insuranceSalary}
            onChange={e => setInsuranceSalary(e.target.value)} placeholder="VD: 6000000" />
        </Field>
        <Field label="Phụ cấp (VNĐ/tháng)"
          hint="Cộng thẳng vào lương thực nhận, không qua bảo hiểm/thuế.">
          <input className={inputCls} type="number" value={allowance}
            onChange={e => setAllowance(e.target.value)} placeholder="VD: 200000" />
        </Field>
        <Field label="Thưởng (VNĐ/tháng)"
          hint="Cộng thẳng vào lương thực nhận, không qua bảo hiểm/thuế.">
          <input className={inputCls} type="number" value={bonus}
            onChange={e => setBonus(e.target.value)} placeholder="VD: 0" />
        </Field>
        <Field label="Số người phụ thuộc"
          hint="Mỗi người phụ thuộc giảm trừ thêm 6.200.000đ/tháng khi tính thuế TNCN.">
          <input className={inputCls} type="number" min="0" step="1" value={dependents}
            onChange={e => setDependents(e.target.value)} placeholder="0" />
        </Field>
        {totalReceived > 0 && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
            <span>Lương thực nhận cuối cùng (mỗi người):</span>
            <strong className="text-sm">{totalReceived.toLocaleString('vi-VN')}đ</strong>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Gửi duyệt</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Info Modal (dept/pos) ─────────────────────────────────────────────────────

/**
 * DANH MỤC CỐ ĐỊNH "Bộ phận → Chức vụ".
 *
 * PHẢI KHỚP với OrgCatalog.java bên backend — mỗi chức vụ ở đây ứng với đúng
 * một role hưởng lương, và backend sẽ ghi role đó vào _user.payroll_role khi
 * lưu. Sửa danh sách này thì phải sửa OrgCatalog.java tương ứng.
 *
 * Có thể lấy động từ GET /api/hr/org-structure nếu muốn khỏi khai báo 2 nơi.
 */
const ORG = {
  // Ban lãnh đạo — lương tính tách riêng, không gộp với bộ phận nào khác.
  'Quản lý cấp cao': ['Chủ Tịch', 'Giám Đốc'],
  'Xưởng sản xuất': ['Trưởng xưởng', 'Quản lý xưởng', 'Kế toán xưởng',
                     'Công nhân sản xuất', 'Trợ lý xưởng', 'Nhân viên văn phòng', 'Bảo vệ'],
  'Kế Toán':        ['Kế toán trưởng', 'Chuyên viên kế toán'],
  'Kinh doanh':     ['Trưởng phòng kinh doanh', 'Nhân viên kinh doanh'],
  'Kho':            ['Quản lý kho', 'Nhân viên kho'],
  'Tài xế':         ['Tài xế giao nhận'],
};

/**
 * Số năm thâm niên TRÒN tính tới HÔM NAY — chỉ để hiển thị tham khảo ở bảng nhân sự.
 *
 * <p>Con số CHÍNH THỨC dùng để trả phụ cấp là bản do BE chốt lúc Chủ bấm
 * "Hoàn tất" phiếu lương ({@code SeniorityCalculator.java}), lấy mốc là ngày
 * hoàn tất chấm công chứ không phải hôm nay. Hai số có thể lệch nhau nếu ngày kỷ
 * niệm vào làm rơi vào khoảng giữa hai mốc — đây chỉ là chỗ xem nhanh.
 *
 * <p>Đếm theo lịch (so ngày/tháng) chứ không chia 365 ngày, để năm nhuận và
 * người vào làm 29/02 không bị lệch.
 */
const seniorityYearsOf = (workStartDate) => {
  if (!workStartDate) return 0;
  const start = new Date(Number(workStartDate));
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();

  // Chưa tới ngày kỷ niệm trong năm nay thì trừ đi 1.
  const monthDiff = now.getMonth() - start.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) years -= 1;

  return years > 0 ? years : 0;
};

function InfoModal({ user, onClose, onSaved }) {
  const toast = useToast();

  // Dữ liệu cũ nhập tay có thể không khớp danh mục → bỏ qua, buộc chọn lại
  const [form, setForm] = useState({
    department: ORG[user.department] ? user.department : '',
    division: user.division || '',
    position: '',
    // Ngày vào làm — epoch ms (DatePicker nhận/trả ms). null = chưa nhập.
    workStartDate: user.workStartDate ?? null,
  });

  // Đổi bộ phận thì chức vụ phải nằm trong bộ phận mới, nếu không thì xoá trắng
  useEffect(() => {
    const list = ORG[form.department] || [];
    if (!list.includes(form.position)) {
      setForm(f => ({ ...f, position: list.includes(user.position) ? user.position : '' }));
    }
  }, [form.department]);

  const [saving, setSaving] = useState(false);
  const positions = ORG[form.department] || [];

  const submit = async () => {
    if (!form.department || !form.position) {
      toast('Vui lòng chọn đầy đủ Bộ phận và Chức vụ', 'error');
      return;
    }
    setSaving(true);
    try {
      await hrEmployeeApi.updateInfo(user.id, {
        ...form,
        // BE nhận epoch millis; gửi 0 khi để trống = xoá ngày vào làm.
        workStartDate: form.workStartDate || 0,
      });
      toast('Đã cập nhật thông tin', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Thông tin — ${user.fullName}`}>
      <div className="space-y-3 py-1">
        <Field label="Bộ phận">
          <select className={selectCls} value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
            <option value="">— Chọn bộ phận —</option>
            {Object.keys(ORG).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>

        <Field label="Chức vụ">
          <select className={selectCls} value={form.position} disabled={!form.department}
            onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
            <option value="">{form.department ? '— Chọn chức vụ —' : '— Chọn bộ phận trước —'}</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="Ngày vào làm việc"
          hint="Căn cứ tính thâm niên & phụ cấp thâm niên. Để trống nếu chưa rõ.">
          <DatePicker
            value={form.workStartDate}
            onChange={v => setForm(f => ({ ...f, workStartDate: v }))}
            placeholder="Chọn ngày vào làm"
            maxDate={new Date()} />
        </Field>

        {form.workStartDate && (
          <p className="text-xs text-muted leading-relaxed">
            Thâm niên được CHỐT khi Chủ bấm “Hoàn tất” phiếu lương của tháng, tính
            theo số năm tròn từ ngày này tới ngày hoàn tất chấm công. Đủ 1 năm được
            2% lương cơ bản, mỗi năm sau +1%, tối đa 10%.
          </p>
        )}

        <p className="text-xs text-muted leading-relaxed">
          Role hưởng lương được đặt tự động theo chức vụ. Nhân viên kiêm nhiệm vẫn
          giữ nguyên các quyền truy cập khác — ví dụ Nhân viên kinh doanh kiêm coi
          kho vẫn vào được màn hình kho nhưng lương luôn tính ở bộ phận Kinh doanh.
        </p>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Lưu</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Create Leave Modal ────────────────────────────────────────────────────────
function CreateLeaveModal({ users, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    userId: '', leaveType: 'PAID', leaveDate: '', leaveEndDate: '',
    leaveDays: '', handoverTo: '', contactPhone: '', note: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.userId || !form.leaveDate) return toast('Chọn nhân viên và ngày nghỉ', 'error');
    setSaving(true);
    try {
      await hrLeaveApi.create({
        userId: Number(form.userId),
        leaveType: form.leaveType,
        leaveDate: new Date(form.leaveDate).getTime(),
        leaveEndDate: form.leaveEndDate ? new Date(form.leaveEndDate).getTime() : new Date(form.leaveDate).getTime(),
        leaveDays: Number(form.leaveDays) || 1,
        handoverTo: form.handoverTo,
        contactPhone: form.contactPhone,
        note: form.note,
      });
      toast('Đã tạo phiếu nghỉ', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tạo phiếu nghỉ" size="lg">
      <div className="space-y-3 py-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nhân viên" required>
            <select className={selectCls} value={form.userId} onChange={e => set('userId', e.target.value)}>
              <option value="">— Chọn —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </Field>
          <Field label="Loại nghỉ">
            <select className={selectCls} value={form.leaveType} onChange={e => set('leaveType', e.target.value)}>
              <option value="PAID">Có lương</option>
              <option value="UNPAID">Không lương</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Từ ngày" required>
            <input type="date" className={inputCls} value={form.leaveDate}
              onChange={e => set('leaveDate', e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <input type="date" className={inputCls} value={form.leaveEndDate}
              onChange={e => set('leaveEndDate', e.target.value)} />
          </Field>
          <Field label="Số ngày nghỉ" required>
            <input type="number" step="0.5" className={inputCls} value={form.leaveDays}
              onChange={e => set('leaveDays', e.target.value)} placeholder="VD: 1, 0.5" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bàn giao cho">
            <input className={inputCls} value={form.handoverTo}
              onChange={e => set('handoverTo', e.target.value)} placeholder="Tên người nhận bàn giao" />
          </Field>
          <Field label="SĐT liên lạc">
            <input className={inputCls} value={form.contactPhone}
              onChange={e => set('contactPhone', e.target.value)} placeholder="090xxxxxxx" />
          </Field>
        </div>
        <Field label="Ghi chú">
          <textarea className={inputCls} rows={2} value={form.note}
            onChange={e => set('note', e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Tạo phiếu</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Create OT Modal ───────────────────────────────────────────────────────────
function CreateOtModal({ users, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    otDate: '', startTime: '18:00', endTime: '22:00', otHours: '',
    reason: '', userIds: [],
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleUser = (id) => setForm(f => ({
    ...f,
    userIds: f.userIds.includes(id) ? f.userIds.filter(x => x !== id) : [...f.userIds, id],
  }));

  const submit = async () => {
    if (!form.otDate || form.userIds.length === 0) return toast('Cần chọn ngày và ít nhất 1 nhân viên', 'error');
    setSaving(true);
    try {
      await hrOtApi.create({
        otDate: new Date(form.otDate).getTime(),
        startTime: form.startTime,
        endTime: form.endTime,
        otHours: Number(form.otHours) || 0,
        reason: form.reason,
        userIds: form.userIds,
      });
      toast('Đã tạo đơn OT', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || t('common', 'error'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tạo đơn OT" size="lg">
      <div className="space-y-3 py-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày OT" required>
            <input type="date" className={inputCls} value={form.otDate}
              onChange={e => set('otDate', e.target.value)} />
          </Field>
          <Field label="Số giờ OT" required>
            <input type="number" step="0.5" className={inputCls} value={form.otHours}
              onChange={e => set('otHours', e.target.value)} placeholder="VD: 4" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu">
            <input type="time" className={inputCls} value={form.startTime}
              onChange={e => set('startTime', e.target.value)} />
          </Field>
          <Field label="Giờ kết thúc">
            <input type="time" className={inputCls} value={form.endTime}
              onChange={e => set('endTime', e.target.value)} />
          </Field>
        </div>
        <Field label="Lý do OT" required>
          <textarea className={inputCls} rows={2} value={form.reason}
            onChange={e => set('reason', e.target.value)} placeholder="Lý do làm thêm giờ…" />
        </Field>
        <Field label={`Nhân viên OT (đã chọn ${form.userIds.length})`} required>
          <div className="max-h-48 overflow-y-auto space-y-1 border border-hairline-2 rounded-xl p-2">
            {users.map(u => {
              const checked = form.userIds.includes(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors
                  ${checked ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28' : 'bg-canvas border border-transparent hover:border-line'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleUser(u.id)}
                    className="w-4 h-4 accent-amber-500 rounded" />
                  <span className={`text-sm font-medium ${checked ? 'text-amber-700 dark:text-amber-300' : 'text-ink'}`}>{u.fullName}</span>
                  {u.department && <span className="text-xs text-muted">({u.department})</span>}
                </label>
              );
            })}
          </div>
        </Field>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={submit} loading={saving} className="flex-1">Tạo đơn OT</PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Import Employees/Salaries Modal ───────────────────────────────────────────
function ImportEmployeesModal({ onClose, onDone }) {
  const [step, setStep] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const res = await hrSalaryApi.importAll(file);
      const body = res?.data || {};
      const d = body.data ?? body;
      setResult({
        updated: d.updated ?? 0,
        skipped: d.skipped ?? 0,
        errors: d.errors || [],
        backfilled: d.workStartDateBackfilled ?? 0,
      });
      setStep('result');
      if ((d.updated ?? 0) > 0) onDone();
    } catch (e) {
      setUploadError(e?.response?.data?.message || e?.response?.data?.data?.message || 'Lỗi import dữ liệu nhân sự');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal open onClose={onClose} title="Import dữ liệu nhân sự"
      subtitle={step === 'upload' ? 'Dùng file Export từ hệ thống — file chỉ import được 1 lần' : 'Kết quả import'}
      size="sm">
      {step === 'upload' ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center">
            {uploading
              ? <div className="w-7 h-7 border-[3px] border-gold border-t-transparent rounded-full animate-spin" />
              : <Upload size={24} className="text-gold" />}
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-ink">{uploading ? 'Đang xử lý...' : 'Chọn file Excel để import'}</p>
            <p className="text-xs text-muted">Hệ thống cập nhật đúng nhân viên theo cột <strong>ID</strong> — không dùng thứ tự dòng.</p>
            <p className="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-1.5">
              ⚠ Chỉ import được file vừa Export, và số lượng nhân viên phải khớp với hiện tại.
            </p>
            <p className="text-xs text-muted">
              Cột <strong>Ngày vào làm</strong> để trống thì hệ thống lấy <strong>ngày import</strong> làm mốc
              tính thâm niên (chỉ với nhân viên chưa có ngày nào).
            </p>
            {uploadError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2.5 text-left">
                <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                <p className="text-xs text-red-600 dark:text-red-300 font-medium">{uploadError}</p>
              </div>
            )}
          </div>
          {!uploading && (
            <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep transition-colors">
              <Upload size={14} /> Chọn file .xlsx
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{result?.updated ?? 0}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Cập nhật thành công</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-500">{result?.skipped ?? 0}</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Bỏ qua / lỗi</p>
            </div>
          </div>
          {result?.backfilled > 0 && (
            /* Ghi dữ liệu mà HR không chủ động yêu cầu → phải nói ra, kèm số
               lượng, để họ biết đường vào sửa lại ai có ngày vào làm thật khác. */
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-3 py-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Đã tự điền <strong>ngày hôm nay</strong> làm ngày vào làm cho{' '}
                <strong>{result.backfilled}</strong> nhân viên còn để trống.
                Ai có ngày vào làm thật khác thì sửa lại ở nút “Bộ phận / Chức vụ”,
                vì con số này quyết định phụ cấp thâm niên.
              </p>
            </div>
          )}
          {result?.errors?.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-1.5">Chi tiết lỗi:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-500 py-0.5 border-b border-red-100 dark:border-red-500/18 last:border-0">{err}</p>
              ))}
            </div>
          )}
          <SecondaryButton onClick={onClose} className="w-full">Đóng</SecondaryButton>
        </div>
      )}
    </Modal>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────
function EmployeesTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [salaryModal, setSalaryModal] = useState(null);
  const [batchModal, setBatchModal] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentSalaryByUser, setCurrentSalaryByUser] = useState({});

  const loadCurrentSalaries = useCallback(() => {
    hrSalaryApi.listCurrent()
      .then(list => {
        const map = {};
        (list || []).forEach(s => { map[s.userId] = s; });
        setCurrentSalaryByUser(map);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminUserApi.list({ q, page, size: 20 });
      setUsers(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được danh sách', 'error'); }
    finally { setLoading(false); }
  }, [q, page]);

  useEffect(() => { loadCurrentSalaries(); }, [loadCurrentSalaries]);

  useEffect(() => { load(); }, [load]);

  const toggleAll = () =>
    setSelected(selected.length === users.length ? [] : users.map(u => u.id));
  const toggleOne = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await hrSalaryApi.exportAll();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const disposition = res.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      downloadBlob(blob, match ? match[1] : 'bang-luong-nhan-su.xlsx');
      toast('Đã xuất file Excel', 'success');
    } catch {
      toast('Lỗi khi export dữ liệu nhân sự', 'error');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className={`${inputCls} pl-8`} value={q}
            onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Tìm nhân viên…" />
        </div>
        {selected.length > 1 && (
          <PrimaryButton onClick={() => setBatchModal(true)}>
            <DollarSign size={14} /> Set lương ({selected.length})
          </PrimaryButton>
        )}
        <SecondaryButton onClick={() => setImportOpen(true)}>
          <Upload size={14} /> Import
        </SecondaryButton>
        <SecondaryButton onClick={handleExport} disabled={exporting}>
          {exporting
            ? <><Loader2 size={14} className="animate-spin" /> Đang xuất...</>
            : <><Download size={14} /> Export</>}
        </SecondaryButton>
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : users.length === 0 ? (
          <EmptyState icon={Users} title="Không có nhân viên" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th><input type="checkbox" checked={selected.length === users.length && users.length > 0}
                  onChange={toggleAll} className="w-4 h-4 accent-amber-500" /></Th>
                <Th>Họ tên</Th>
                <Th>Bộ phận</Th>
                {/* <Th>Phòng ban</Th> */}
                <Th>Chức vụ</Th>
                <Th>Ngày vào làm</Th>
                {/* <Th>Role</Th> */}
                <Th right>Lương hiện tại</Th>
                <Th right>Thao tác</Th>
              </Tr>
            </Thead>
            <tbody>
              {users.map(u => {
                const cs = currentSalaryByUser[u.id];
                return (
                <Tr key={u.id}>
                  <Td><input type="checkbox" checked={selected.includes(u.id)}
                    onChange={() => toggleOne(u.id)} className="w-4 h-4 accent-amber-500" /></Td>
                  <Td>
                    <div className="font-medium text-ink">{u.fullName}</div>
                    <div className="text-xs text-muted">{u.username}</div>
                  </Td>
                  <Td><span className="text-sm">{u.department || '—'}</span></Td>
                  {/* <Td><span className="text-sm">{u.division || '—'}</span></Td> */}
                  <Td><span className="text-sm">{u.position || '—'}</span></Td>
                  <Td>
                    {u.workStartDate ? (
                      <div>
                        <span className="text-sm">{formatDate(u.workStartDate)}</span>
                        <div className="text-xs text-muted">
                          {seniorityYearsOf(u.workStartDate)} năm
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                  </Td>
                  {/* <Td><Badge variant="default">{u.role}</Badge></Td> */}
                  <Td right>
                    {cs ? (
                      <div>
                        <p className="text-sm font-semibold text-ink">{Number(cs.baseSalary || 0).toLocaleString('vi-VN')}đ</p>
                        <Badge variant={cs.status === 'APPROVED' ? 'success' : cs.status === 'REJECTED' ? 'danger' : 'warning'}>
                          {cs.status === 'APPROVED' ? 'Đã duyệt' : cs.status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt'}
                        </Badge>
                      </div>
                    ) : <span className="text-xs text-muted">Chưa nhập</span>}
                  </Td>
                  <Td right>
                    <div className="flex gap-1 justify-end">
                      <SecondaryButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setInfoModal(u)}>
                        <UserCog size={12} /> Bộ phận / Chức vụ
                      </SecondaryButton>
                      <PrimaryButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setSalaryModal(u)}>
                        <DollarSign size={12} /> Lương
                      </PrimaryButton>
                    </div>
                  </Td>
                </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-hairline">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>

      {salaryModal && <SalaryModal user={salaryModal} onClose={() => setSalaryModal(null)} onSaved={() => { load(); loadCurrentSalaries(); }} />}
      {batchModal && <BatchSalaryModal userIds={selected} onClose={() => setBatchModal(false)} onSaved={() => { setBatchModal(false); setSelected([]); loadCurrentSalaries(); }} />}
      {infoModal && <InfoModal user={infoModal} onClose={() => setInfoModal(null)} onSaved={load} />}
      {importOpen && <ImportEmployeesModal onClose={() => setImportOpen(false)} onDone={load} />}
    </div>
  );
}

// ── Leaves Tab ────────────────────────────────────────────────────────────────
function LeavesTab() {
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrLeaveApi.list({ page, size: 20 });
      setLeaves(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được phiếu nghỉ', 'error'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminUserApi.list({ size: 200 }).then(d => setUsers(d.content ?? d)).catch(() => { });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Tạo phiếu nghỉ
        </PrimaryButton>
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : leaves.length === 0 ? (
          <EmptyState icon={Calendar} title="Chưa có phiếu nghỉ nào" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nhân viên</Th>
                <Th>Loại</Th>
                <Th>Từ ngày</Th>
                <Th>Đến ngày</Th>
                <Th>Số ngày</Th>
                <Th>Bàn giao</Th>
                <Th>Ngày tạo</Th>
              </Tr>
            </Thead>
            <tbody>
              {leaves.map(l => (
                <Tr key={l.id}>
                  <Td>
                    <div className="font-medium">{l.userFullName}</div>
                    {l.department && <div className="text-xs text-muted">{l.department}</div>}
                  </Td>
                  <Td>
                    <Badge variant={l.leaveType === 'PAID' ? 'success' : 'warning'}>
                      {LEAVE_TYPE_LABEL[l.leaveType] || l.leaveType}
                    </Badge>
                  </Td>
                  <Td>{formatDate(l.leaveDate)}</Td>
                  <Td>{formatDate(l.leaveEndDate)}</Td>
                  <Td>{l.leaveDays} ngày</Td>
                  <Td>{l.handoverTo || '—'}</Td>
                  <Td>{formatDateTime(l.createdAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-hairline">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>

      {showCreate && <CreateLeaveModal users={users} onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

// ── OT Tab ────────────────────────────────────────────────────────────────────
function OtTab() {
  const toast = useToast();
  const [ots, setOts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrOtApi.list({ page, size: 20 });
      setOts(data.content ?? data);
      setTotalPages(data.totalPages ?? 1);
    } catch { toast('Không tải được đơn OT', 'error'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    adminUserApi.list({ size: 200 }).then(d => setUsers(d.content ?? d)).catch(() => { });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Tạo đơn OT
        </PrimaryButton>
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : ots.length === 0 ? (
          <EmptyState icon={Clock} title="Chưa có đơn OT nào" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Ngày OT</Th>
                <Th>Giờ</Th>
                <Th>Số giờ</Th>
                <Th>Nhân viên</Th>
                <Th>Lý do</Th>
                <Th>Ngày tạo</Th>
              </Tr>
            </Thead>
            <tbody>
              {ots.map(o => (
                <Tr key={o.id}>
                  <Td>{formatDate(o.otDate)}</Td>
                  <Td>{o.startTime} — {o.endTime}</Td>
                  <Td>{o.otHours}h</Td>
                  <Td>
                    <div className="text-sm">
                      {(o.employees || []).map(e => e.fullName).join(', ')}
                    </div>
                  </Td>
                  <Td><span className="text-sm text-muted line-clamp-1">{o.reason}</span></Td>
                  <Td>{formatDateTime(o.createdAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-hairline">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </SectionCard>

      {showCreate && <CreateOtModal users={users} onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

// ── Driver Report Export Modal ────────────────────────────────────────────────
function DriverReportModal({ onClose }) {
  const toast = useToast();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [bikeRate, setBikeRate] = useState('');
  const [truckRate, setTruckRate] = useState('');
  const [exporting, setExporting] = useState(false);

  const fmt = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('vi-VN');
  };

  const handleExport = async () => {
    if (!from || !to) { toast('Chọn khoảng thời gian', 'error'); return; }
    setExporting(true);
    try {
      const params = new URLSearchParams({
        from: String(from),
        to: String(to),
        excludeWarehouse: 'true',
        bikeRatePerKm: bikeRate || '0',
        truckRatePerKm: truckRate || '0',
      });
      const res = await api.get(`/api/admin/users/reports?${params}`, { responseType: 'blob' });
      downloadBlob(res.data, `bao-cao-tai-xe-${from}_${to}.xlsx`);
      toast('Xuất báo cáo thành công', 'success');
      onClose();
    } catch { toast('Lỗi xuất báo cáo', 'error'); }
    finally { setExporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-chrome to-chrome px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Download size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Báo cáo & Lương tài xế</h3>
              <p className="text-white/60 text-[10px]">Xuất file Excel chuyên nghiệp</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date range */}
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">KHOẢNG THỜI GIAN</p>
            <DateRangePicker
              from={from}
              to={to}
              onChange={({ from, to }) => {
                setFrom(from);
                setTo(to);
              }}
              placeholder="Chọn khoảng thời gian"
            />
          </div>

          {/* Salary rates */}
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Lương theo km</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/28 p-3">
                <label className="block text-[11px] font-bold text-sky-700 dark:text-sky-300 mb-1.5">🏍️ Xe máy (đ/km)</label>
                <input type="number" min="0" value={bikeRate} onChange={e => setBikeRate(e.target.value)}
                  placeholder="VD: 2000"
                  className="w-full h-8 px-2 rounded-lg border border-sky-200 dark:border-sky-500/28 text-sm focus:outline-none focus:border-sky-400 bg-surface" />
              </div>
              <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/28 p-3">
                <label className="block text-[11px] font-bold text-orange-700 dark:text-orange-300 mb-1.5">🚛 Xe tải (đ/km)</label>
                <input type="number" min="0" value={truckRate} onChange={e => setTruckRate(e.target.value)}
                  placeholder="VD: 5000"
                  className="w-full h-8 px-2 rounded-lg border border-orange-200 dark:border-orange-500/28 text-sm focus:outline-none focus:border-orange-400 bg-surface" />
              </div>
            </div>
            <p className="text-[10px] text-muted mt-1.5 italic">Để trống = không tính lương km (chỉ thống kê)</p>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-line">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-surface-2 font-medium">Hủy</button>
          <button onClick={handleExport} disabled={exporting || !from || !to}
            className="flex-1 py-2.5 rounded-xl bg-chrome text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-chrome disabled:opacity-40 transition-colors">
            {exporting
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xuất...</>
              : <><Download size={14} /> Xuất Excel</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Payroll Tab — Tính lương hàng tháng ───────────────────────────────────────
const PAYROLL_STATUS_LABEL = {
  DRAFT: { label: 'Đã export, chưa import', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  PENDING_APPROVAL: { label: 'Chờ Owner duyệt', cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  REJECTED: { label: 'Bị từ chối', cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300' },
};

function PayrollStatusBadge({ status }) {
  const cfg = PAYROLL_STATUS_LABEL[status] || { label: status, cls: 'bg-surface-2 text-ink-2' };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

const MONTH_NAMES = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

/** Đọc message lỗi từ response — backend có thể trả JSON (lỗi) dù request xin blob. */
async function readErrorMessage(err, fallback) {
  try {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      const text = await blob.text();
      try { return JSON.parse(text)?.message || fallback; } catch { return text || fallback; }
    }
    return err?.response?.data?.message || fallback;
  } catch { return fallback; }
}

// ── Modal: Tạo phiếu lương (chọn tháng/năm + export) ──────────────────────────
function CreatePayrollModal({ onClose, onExported }) {
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await payrollApi.createAndExport(month, year);
      downloadBlob(res.data, `tinh-luong-${month}-${year}.xlsx`);
      toast('Đã tạo phiếu lương và xuất file Excel. Vui lòng điền thông tin rồi import lại.', 'success');
      onExported();
      onClose();
    } catch (e) {
      const msg = await readErrorMessage(e, 'Lỗi khi tạo phiếu lương');
      toast(msg, 'error');
    } finally { setExporting(false); }
  };

  return (
    <Modal open onClose={onClose} title="Tạo phiếu lương tháng">
      <div className="space-y-4 py-1">
        <p className="text-sm text-muted">
          Hệ thống sẽ export file Excel danh sách nhân viên đã được duyệt lương cơ bản.
          Điền số ngày công, số người phụ thuộc, thưởng, phụ cấp, lương đóng BHXH/BHYT/BHTN
          rồi import lại để tính lương.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tháng" required>
            <select className={selectCls} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{MONTH_NAMES[m]}</option>
              ))}
            </select>
          </Field>
          <Field label="Năm" required>
            <input className={inputCls} type="number" value={year} onChange={e => setYear(Number(e.target.value))} />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 pt-3">
        <SecondaryButton onClick={onClose} className="flex-1">Huỷ</SecondaryButton>
        <PrimaryButton onClick={handleExport} loading={exporting} className="flex-1">
          <Download size={14} /> Tạo & Export Excel
        </PrimaryButton>
      </div>
    </Modal>
  );
}

// ── Modal: Import Excel đã điền → tính lương ──────────────────────────────────
function ImportPayrollModal({ onClose, onDone }) {
  const [step, setStep] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const res = await payrollApi.importBatch(file);
      const body = res?.data || {};
      if (body.success === false) {
        setUploadError(body.message || 'Lỗi import dữ liệu lương');
      } else {
        setResult(body.data || null);
        setStep('result');
        onDone();
      }
    } catch (e) {
      setUploadError(e?.response?.data?.message || 'Lỗi import dữ liệu lương');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal open onClose={onClose} title="Import file tính lương" size="sm">
      {step === 'upload' ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            {uploading
              ? <div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
              : <Calculator size={24} className="text-emerald-600 dark:text-emerald-300" />}
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-ink">{uploading ? 'Đang tính lương...' : 'Chọn file Excel đã điền'}</p>
            <p className="text-xs text-muted">Hệ thống sẽ tự tính BHXH/BHYT/BHTN và thuế TNCN theo luật hiện hành.</p>
            <p className="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-1.5">
              ⚠ Chỉ import được file vừa tạo phiếu lương — mỗi file chỉ import 1 lần.
            </p>
            {uploadError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2.5 text-left">
                <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                <p className="text-xs text-red-600 dark:text-red-300 font-medium">{uploadError}</p>
              </div>
            )}
          </div>
          {!uploading && (
            <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer hover:bg-emerald-700 transition-colors">
              <Upload size={14} /> Chọn file .xlsx
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{result?.employeeCount ?? 0}</p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              Nhân viên đã tính lương — tháng {result?.month}/{result?.year}
            </p>
          </div>
          <p className="text-sm text-muted text-center">
            Phiếu lương đã được gửi cho Owner duyệt. Bạn có thể xem chi tiết ở danh sách bên dưới.
          </p>
          <SecondaryButton onClick={onClose} className="w-full">Đóng</SecondaryButton>
        </div>
      )}
    </Modal>
  );
}

// ── Modal: Xem chi tiết các phiếu lương trong batch ───────────────────────────
function PayrollDetailModal({ batch, onClose }) {
  const toast = useToast();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    payrollApi.getPayslips(batch.id)
      .then(data => setPayslips(Array.isArray(data) ? data : []))
      .catch(() => { toast('Không tải được chi tiết phiếu lương', 'error'); setPayslips([]); })
      .finally(() => setLoading(false));
  }, [batch.id]);

  return (
    <Modal open onClose={onClose} size="2xl"
      title={`Chi tiết phiếu lương — ${MONTH_NAMES[batch.month]}/${batch.year}`}>
      {loading ? <LoadingSpinner /> : payslips.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có dữ liệu" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Nhân viên</Th>
                <Th right>Lương GROSS</Th>
                <Th right>Người phụ thuộc</Th>
                <Th right>Tổng bảo hiểm</Th>
                <Th right>Thu nhập tính thuế</Th>
                <Th right>Thuế TNCN</Th>
                <Th right>Lương NET</Th>
              </Tr>
            </Thead>
            <tbody>
              {payslips.map(p => (
                <Tr key={p.id}>
                  <Td>
                    <div className="font-medium">{p.userFullName}</div>
                    <div className="text-xs text-muted">{p.department || '—'} {p.division ? `· ${p.division}` : ''}</div>
                  </Td>
                  <Td right>{formatCurrency(p.grossSalary)}</Td>
                  <Td right>{p.dependents ?? 0}</Td>
                  <Td right>{formatCurrency(p.totalInsuranceAmount)}</Td>
                  <Td right>{formatCurrency(p.taxableIncome)}</Td>
                  <Td right>{formatCurrency(p.personalIncomeTax)}</Td>
                  <Td right><span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(p.netSalary)}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Modal>
  );
}

function PayrollTab() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailBatch, setDetailBatch] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await payrollApi.listBatches({ size: 50 });
      const list = Array.isArray(data?.content) ? data.content : (Array.isArray(data) ? data : []);
      setBatches(list);
    } catch { toast('Không tải được danh sách phiếu lương', 'error'); setBatches([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (batch) => {
    setDownloadingId(batch.id);
    try {
      const res = await payrollApi.downloadPayslips(batch.id);
      downloadBlob(res.data, `phieu-luong-${batch.month}-${batch.year}.xlsx`);
      toast('Đã tải phiếu lương', 'success');
    } catch (e) {
      const msg = await readErrorMessage(e, 'Lỗi khi tải phiếu lương');
      toast(msg, 'error');
    } finally { setDownloadingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted">
          Tạo phiếu lương tháng → điền file Excel → import để tính lương → chờ Owner duyệt → tải phiếu lương về chi lương.
        </p>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setImportOpen(true)}>
            <Upload size={14} /> Import file đã điền
          </SecondaryButton>
          <PrimaryButton onClick={() => setCreateOpen(true)}>
            <Calculator size={14} /> Tạo phiếu lương
          </PrimaryButton>
        </div>
      </div>

      <SectionCard>
        {loading ? <LoadingSpinner /> : batches.length === 0 ? (
          <EmptyState icon={Calculator} title="Chưa có phiếu lương nào" description="Bấm 'Tạo phiếu lương' để bắt đầu." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Tháng</Th>
                <Th right>Số nhân viên</Th>
                <Th>Trạng thái</Th>
                <Th>Người tạo</Th>
                <Th>Ngày tạo</Th>
                <Th right>Thao tác</Th>
              </Tr>
            </Thead>
            <tbody>
              {batches.map(b => (
                <Tr key={b.id}>
                  <Td><span className="font-medium">{MONTH_NAMES[b.month]}/{b.year}</span></Td>
                  <Td right>{b.employeeCount ?? '—'}</Td>
                  <Td><PayrollStatusBadge status={b.status} />
                    {b.rejectReason && <p className="text-xs text-red-500 mt-1 max-w-[200px]">{b.rejectReason}</p>}
                  </Td>
                  <Td>{b.createdByName || '—'}</Td>
                  <Td>{formatDateTime(b.createdAt)}</Td>
                  <Td right>
                    <div className="flex gap-1.5 justify-end">
                      {(b.status === 'PENDING_APPROVAL' || b.status === 'APPROVED') && (
                        <SecondaryButton className="!px-2.5 !py-1.5 text-xs" onClick={() => setDetailBatch(b)}>
                          <Eye size={12} /> Xem
                        </SecondaryButton>
                      )}
                      {b.status === 'APPROVED' && (
                        <PrimaryButton className="!px-2.5 !py-1.5 text-xs"
                          loading={downloadingId === b.id}
                          onClick={() => handleDownload(b)}>
                          <Download size={12} /> Tải phiếu lương
                        </PrimaryButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {createOpen && <CreatePayrollModal onClose={() => setCreateOpen(false)} onExported={load} />}
      {importOpen && <ImportPayrollModal onClose={() => setImportOpen(false)} onDone={load} />}
      {detailBatch && <PayrollDetailModal batch={detailBatch} onClose={() => setDetailBatch(null)} />}
    </div>
  );
}


// ── Nhóm tab "Phiếu nghỉ" ─────────────────────────────────────────────────────
// Hai nguồn phiếu khác hẳn nhau nên tách làm hai bảng thay vì trộn chung:
//   · ĐƠN NHÂN VIÊN  — nhân viên tự gửi trên app, OWNER duyệt, có tác động
//                      trực tiếp lên bảng chấm công khi tính lương.
//   · PHIẾU HR TẠO   — bản ghi nghỉ phép do HR nhập tay (kèm bàn giao, SĐT
//                      liên lạc), mang tính lưu hồ sơ, không qua bước duyệt.
// Đơn nhân viên đặt trước vì đó là việc cần xử lý hằng ngày.
function LeavesTabGroup() {
  const { role } = useAuth();

  // Trang /hr/manage mở cho cả HR và SUPER_ACCOUNTANT, nhưng API duyệt đơn chỉ
  // nhận OWNER/ADMIN. Ẩn hẳn tab thay vì để họ bấm vào rồi nhận 403 — quyền
  // thật vẫn nằm ở backend, đây chỉ là cho khớp giao diện.
  const canReview = role === 'OWNER' || role === 'ADMIN';

  const [sub, setSub] = useState(canReview ? 'requests' : 'hr');

  const SUB_TABS = [
    ...(canReview ? [{ id: 'requests', label: 'Đơn nhân viên', icon: FileText }] : []),
    { id: 'hr', label: 'Phiếu HR tạo', icon: Calendar },
  ];

  // Chỉ còn một tab thì thanh tab là thừa.
  return (
    <div className="space-y-4">
      {SUB_TABS.length > 1 && <TabBar tabs={SUB_TABS} active={sub} onChange={setSub} />}
      {sub === 'requests' && canReview && <EmployeeRequestsPanel />}
      {sub === 'hr' && <LeavesTab />}
    </div>
  );
}

export default function HrPage() {
  const { t } = useLang();
  const [tab, setTab] = useState('employees');
  const [showDriverReport, setShowDriverReport] = useState(false);

  const LEAVE_TYPE_LABEL = { PAID: t('hr', 'leave_paid'), UNPAID: t('hr', 'leave_unpaid') };

  const TABS = [
    { id: 'employees', label: 'Quản lý nhân viên', icon: Users },
    { id: 'payroll', label: 'Tính lương', icon: Calculator },
    { id: 'leaves', label: 'Phiếu nghỉ', icon: Calendar },
    { id: 'ot', label: 'Phiếu OT', icon: Clock },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader icon={UserCog} title="Nhân sự" subtitle="Quản lý lương, nghỉ phép, tăng ca" />
        <button onClick={() => setShowDriverReport(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-chrome text-white text-sm font-semibold hover:bg-chrome transition-colors shadow-sm mt-1">
          <Download size={14} /> Báo cáo tài xế
        </button>
      </div>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'payroll' && <PayrollTab />}
      {tab === 'leaves' && <LeavesTabGroup />}
      {tab === 'ot' && <OtTab />}
      {showDriverReport && <DriverReportModal onClose={() => setShowDriverReport(false)} />}
    </div>
  );
}