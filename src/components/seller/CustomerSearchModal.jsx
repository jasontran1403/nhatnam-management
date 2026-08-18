import { useLang } from '../../context/LangContext';
import { useState, useEffect, useRef } from 'react';
import {
  Search, X, UserCheck, Plus, MapPin, Phone, User,
  Building2, ArrowLeft, CheckCircle2, XCircle, Loader2,
  Trash2, Star, Copy, Check, AlertCircle,
} from 'lucide-react';
import { customerApi } from '../../api/services';
import { useToast } from '../common/Toast';
import DatePicker from '../ui/DatePicker';
import AddressSelect from '../common/AddressSelect';
import PickupToggle, { PICKUP_AT_WAREHOUSE } from '../common/PickupToggle';

// ── Sanitize customer code ────────────────────────────────────────
function sanitizeCode(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 30);
}

// ── Shared Field ─────────────────────────────────────────────────
function Field({ label, required, error, hint, ...props }) {
  return (
    <div>
      <label className="text-[11px] text-muted mb-1 block font-medium">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {!required && <span className="text-faint ml-1 font-normal">(tuỳ chọn)</span>}
      </label>
      <input
        className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none bg-surface transition-colors
          ${error
            ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4 focus:border-red-400'
            : 'border-line focus:border-gold'
          }`}
        {...props}
      />
      {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
      {hint && !error && <p className="text-[10px] text-faint mt-0.5">{hint}</p>}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{children}</p>;
}

// ── CustomerCode Input ────────────────────────────────────────────
function CustomerCodeInput({ value, onChange, error }) {
  const { t } = useLang();
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = sanitizeCode(e.target.value);
    onChange(val);
    setAvailable(null);
    if (!val || val.length < 2) return;
    setChecking(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await customerApi.checkCode(val);
        setAvailable(!res.data?.data?.exists);
      } catch { setAvailable(null); }
      finally { setChecking(false); }
    }, 500);
  };

  return (
    <div>
      <label className="text-[11px] text-muted mb-1 block font-medium">
        {t('customer', 'customer')}<span className="text-red-400 ml-0.5">*</span>
      </label>
      <div className="relative">
        <input
          type="text" value={value} onChange={handleChange}
          placeholder="VD: NOK-01, KLE, ABC123"
          maxLength={30}
          className={`w-full px-3 py-2 pr-8 rounded-lg border text-xs focus:outline-none font-mono tracking-wider transition-colors
            ${error
              ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4'
              : available === true
                ? 'border-emerald-400 focus:border-emerald-400'
                : 'border-line focus:border-gold'
            }`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {checking && <Loader2 size={12} className="text-muted animate-spin" />}
          {!checking && available === true && <CheckCircle2 size={12} className="text-emerald-500" />}
          {!checking && available === false && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>
      {error
        ? <p className="text-[10px] text-red-400 mt-0.5">{error}</p>
        : available === true
          ? <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">Mã có thể sử dụng</p>
          : available === false
            ? <p className="text-[10px] text-red-400 mt-0.5">Mã đã được sử dụng</p>
            : <p className="text-[10px] text-faint mt-0.5">Chữ hoa, số, dấu - hoặc _. Tối đa 30 ký tự.</p>
      }
    </div>
  );
}

// ── Receiver Card ─────────────────────────────────────────────────
function ReceiverCard({ receiver, index, isOnly, errors, required, onCopyFromAbove, onChange, onRemove, onSetDefault }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyFromAbove();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-all
      ${receiver.isDefault
        ? 'border-gold/60 bg-gold-tint'
        : 'border-line bg-surface'
      }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-ink">Người nhận #{index + 1}</span>
          {required && <span className="text-[9px] text-red-400">*</span>}
          {receiver.isDefault && (
            <span className="text-[9px] bg-gold/20 text-gold rounded-full px-1.5 py-0.5 font-semibold">
              Mặc định
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-muted hover:text-gold hover:bg-surface-2 transition-colors text-[10px] font-medium">
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            {copied ? 'Đã copy' : 'Copy'}
          </button>
          {!receiver.isDefault && (
            <button type="button" onClick={onSetDefault}
              className="p-1 rounded-md text-faint hover:text-gold hover:bg-surface-2 transition-colors">
              <Star size={12} />
            </button>
          )}
          {!isOnly && (
            <button type="button" onClick={onRemove}
              className="p-1 rounded-md text-faint hover:text-red-400 hover:bg-red-50 dark:bg-red-500/10 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <PickupToggle
          checked={receiver.receiverAddress === PICKUP_AT_WAREHOUSE}
          onChange={on => {
            onChange('receiverAddress', on ? PICKUP_AT_WAREHOUSE : '');
            onChange('provinceName', '');
            onChange('wardName', '');
          }}
        />

        {/* Bật "nhận tại kho" thì khoá hết ô bên dưới — không có gì để nhập, và cho sửa
            sẽ sinh ra bản ghi mâu thuẫn. */}
        <input type="text" placeholder="Số nhà, tên đường *"
          value={receiver.receiverAddress === PICKUP_AT_WAREHOUSE ? '' : receiver.receiverAddress}
          onChange={e => onChange('receiverAddress', e.target.value)}
          disabled={receiver.receiverAddress === PICKUP_AT_WAREHOUSE}
          className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none transition-colors
            disabled:bg-surface-2 disabled:text-faint disabled:cursor-not-allowed
            ${errors?.receiverAddress ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4' : 'border-line focus:border-gold'}`} />

        {receiver.receiverAddress !== PICKUP_AT_WAREHOUSE && (
          <AddressSelect
            compact
            province={receiver.provinceName}
            ward={receiver.wardName}
            onChange={(prov, w) => { onChange('provinceName', prov); onChange('wardName', w); }}
            error={errors?.wardName}
          />
        )}
        {errors?.receiverAddress && <p className="text-[10px] text-red-400 mt-0.5">{errors.receiverAddress}</p>}
      </div>
      <div>
        <input type="text" placeholder="Tên người nhận (tuỳ chọn)"
          value={receiver.receiverName}
          onChange={e => onChange('receiverName', e.target.value)}
          className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none transition-colors
            ${errors?.receiverName ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4' : 'border-line focus:border-gold'}`} />
        {errors?.receiverName && <p className="text-[10px] text-red-400 mt-0.5">{errors.receiverName}</p>}
      </div>
      <div>
        <input type="text" placeholder="Số điện thoại (tuỳ chọn)"
          value={receiver.receiverPhone}
          onChange={e => onChange('receiverPhone', e.target.value)}
          className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none transition-colors
            ${errors?.receiverPhone ? 'border-red-400 bg-red-50/40 dark:bg-red-500/4' : 'border-line focus:border-gold'}`} />
        {errors?.receiverPhone && <p className="text-[10px] text-red-400 mt-0.5">{errors.receiverPhone}</p>}
      </div>
    </div>
  );
}

// ── Extract server error ──────────────────────────────────────────
function extractServerError(err) {
  if (err?.response?.data) {
    const body = err.response.data;
    if (body?.message && typeof body.message === 'string') return body.message;
    if (body?.errors && Array.isArray(body.errors))
      return body.errors.map(e => e.defaultMessage || e.message).join(', ');
  }
  return err?.message || 'Đã xảy ra lỗi, vui lòng thử lại';
}

// ── Validate receiver duplicates ──────────────────────────────────
function validateReceiverDuplicates(receivers, mainPhone) {
  const errors = receivers.map(() => ({}));
  let ok = true;
  const norm = (s) => (s || '').trim().replace(/\s+/g, '');
  const normAddr = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  for (let i = 0; i < receivers.length; i++) {
    for (let j = i + 1; j < receivers.length; j++) {
      const pi = norm(receivers[i].receiverPhone);
      const pj = norm(receivers[j].receiverPhone);
      const ai = normAddr(receivers[i].receiverAddress);
      const aj = normAddr(receivers[j].receiverAddress);

      if (pi && pj && pi === pj) {
        const isMain = norm(mainPhone) === pi;
        errors[i].receiverPhone = errors[i].receiverPhone ||
          (isMain ? 'Chỉ 1 người nhận được dùng SĐT chính' : `Trùng SĐT với người nhận #${j + 1}`);
        errors[j].receiverPhone = errors[j].receiverPhone ||
          (isMain ? 'Chỉ 1 người nhận được dùng SĐT chính' : `Trùng SĐT với người nhận #${i + 1}`);
        ok = false;
      }
      if (ai && aj && ai === aj) {
        errors[i].receiverAddress = errors[i].receiverAddress || `Trùng địa chỉ với người nhận #${j + 1}`;
        errors[j].receiverAddress = errors[j].receiverAddress || `Trùng địa chỉ với người nhận #${i + 1}`;
        ok = false;
      }
    }
  }
  return { ok, errors };
}

// ── PhoneCheckInput ───────────────────────────────────────────────
function PhoneCheckInput({ value, onChange, placeholder, className }) {
  const [checking, setChecking] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setDuplicate(null);
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.trim().length < 6) return;
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await customerApi.checkReceiverPhone(val.trim());
        setDuplicate(res.data?.data?.exists ? true : false);
      } catch { setDuplicate(null); }
      finally { setChecking(false); }
    }, 500);
  };

  return (
    <div>
      <div className="relative">
        <input type="text" placeholder={placeholder} value={value} onChange={handleChange}
          className={`${className} pr-8`} />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {checking && <Loader2 size={11} className="text-muted animate-spin" />}
          {!checking && duplicate === false && <CheckCircle2 size={11} className="text-emerald-500" />}
          {!checking && duplicate === true && <XCircle size={11} className="text-red-400" />}
        </div>
      </div>
      {!checking && duplicate === true && (
        <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
          <AlertCircle size={9} /> SĐT này đã được đăng ký cho người nhận khác
        </p>
      )}
      {!checking && duplicate === false && value.trim().length >= 6 && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">SĐT có thể sử dụng</p>
      )}
    </div>
  );
}



// ── InlineForm ────────────────────────────────────────────────────
function InlineForm({ form, onChange, onSave, onCancel, saving, phoneError }) {
  return (
    <div className="border border-gold/40 rounded-xl p-3 space-y-2 bg-gold-tint">
      <div className="space-y-1.5">
        <PickupToggle
          checked={form.receiverAddress === PICKUP_AT_WAREHOUSE}
          onChange={on => {
            onChange('receiverAddress', on ? PICKUP_AT_WAREHOUSE : '');
            onChange('provinceName', '');
            onChange('wardName', '');
          }}
        />

        <input type="text" placeholder="Số nhà, tên đường *"
          value={form.receiverAddress === PICKUP_AT_WAREHOUSE ? '' : form.receiverAddress}
          onChange={e => onChange('receiverAddress', e.target.value)}
          disabled={form.receiverAddress === PICKUP_AT_WAREHOUSE}
          className="w-full px-3 py-2 rounded-lg border border-line text-xs focus:outline-none focus:border-gold
                     disabled:bg-surface-2 disabled:text-faint disabled:cursor-not-allowed" />

        {form.receiverAddress !== PICKUP_AT_WAREHOUSE && (
          <AddressSelect
            compact
            province={form.provinceName}
            ward={form.wardName}
            onChange={(prov, w) => { onChange('provinceName', prov); onChange('wardName', w); }}
          />
        )}
      </div>
      <input type="text" placeholder="Tên người nhận (tuỳ chọn)" value={form.receiverName}
        onChange={e => onChange('receiverName', e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-line text-xs focus:outline-none focus:border-gold" />
      <PhoneCheckInput value={form.receiverPhone} onChange={val => onChange('receiverPhone', val)}
        placeholder="Số điện thoại (tuỳ chọn)"
        className="w-full px-3 py-2 rounded-lg border border-line text-xs focus:outline-none focus:border-gold" />
      {phoneError && <p className="text-[10px] text-red-400 -mt-1">{phoneError}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg border border-line text-muted text-xs font-medium">Huỷ</button>
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-gold text-white text-xs font-bold disabled:opacity-60">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}

// ── Create Customer Step ──────────────────────────────────────────
function CreateCustomerStep({ onBack, onCreated, toast }) {
  const { t } = useLang();
  const [customerType, setCustomerType] = useState('RETAIL');
  const [form, setForm] = useState({
    customerCode: '',
    name: '', phone: '', email: '',
    contactName: '',
    companyName: '', taxCode: '', companyPhone: '', companyAddress: '',
    pricingType: 'RETAIL_PRICE',
    contractName: '',
    // Ngày sinh nhật — BẮT BUỘC với khách lẻ (backend từ chối nếu thiếu).
    birthday: null,
  });
  // Tên trên hợp đồng MẶC ĐỊNH = tên công ty (COMPANY) / họ tên (RETAIL).
  // Chừng nào user chưa tự sửa ô này, nó tự bám theo tên khách. Sửa 1 lần → dừng bám.
  const [contractTouched, setContractTouched] = useState(false);
  const [receivers, setReceivers] = useState([
    { receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '', isDefault: true }
  ]);
  const [errors, setErrors] = useState({});
  const [receiverErrors, setReceiverErrors] = useState([{}]);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const isCompany = customerType === 'COMPANY';
  const contractDefault = (isCompany ? form.companyName : form.name)?.trim() || '';

  // Đổi loại khách (RETAIL ↔ COMPANY) → tên hợp đồng bám theo tên tương ứng
  // (chỉ khi user chưa tự sửa ô này)
  useEffect(() => {
    if (contractTouched) return;
    setForm(p => ({ ...p, contractName: (isCompany ? p.companyName : p.name) || '' }));
  }, [customerType, contractTouched, isCompany]);

  const setField = (key, val) => {
    setForm(p => {
      const next = { ...p, [key]: val };
      // Tự điền tên hợp đồng theo tên khách/tên công ty khi user chưa tự sửa ô đó
      if (!contractTouched && (key === 'name' || key === 'companyName')) {
        const isCo = customerType === 'COMPANY';
        if ((isCo && key === 'companyName') || (!isCo && key === 'name')) {
          next.contractName = val;
        }
      }
      return next;
    });
    if (errors[key]) setErrors(p => ({ ...p, [key]: '' }));
  };

  const addReceiver = () => {
    setReceivers(prev => [...prev, { receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '', isDefault: false }]);
    setReceiverErrors(prev => [...prev, {}]);
  };

  const removeReceiver = (idx) => {
    if (receivers.length === 1) return;
    setReceivers(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (prev[idx].isDefault && next.length > 0) next[0] = { ...next[0], isDefault: true };
      return next;
    });
    setReceiverErrors(prev => prev.filter((_, i) => i !== idx));
  };

  const updateReceiver = (idx, key, val) => {
    setReceivers(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
    if (receiverErrors[idx]?.[key])
      setReceiverErrors(prev => prev.map((e, i) => i === idx ? { ...e, [key]: '' } : e));
    if (key === 'receiverPhone' || key === 'receiverAddress')
      setReceiverErrors(prev => prev.map((e, i) => i !== idx ? { ...e, [key]: '' } : e));
  };

  const setDefault = (idx) =>
    setReceivers(prev => prev.map((r, i) => ({ ...r, isDefault: i === idx })));

  const copyFromAbove = (idx) => {
    const name = isCompany ? form.contactName : form.name;
    const phone = isCompany ? form.companyPhone : form.phone;
    setReceivers(prev => prev.map((r, i) =>
      i === idx ? { ...r, receiverName: name || r.receiverName, receiverPhone: phone || r.receiverPhone } : r
    ));
  };

  const validate = () => {
    const errs = {};
    let ok = true;

    // Mã KH bắt buộc với mọi loại
    if (!form.customerCode.trim()) { errs.customerCode = t('common', 'required'); ok = false; }

    if (isCompany) {
      // COMPANY bắt buộc: tên công ty, MST, email
      if (!form.companyName.trim()) { errs.companyName = t('common', 'required'); ok = false; }
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { errs.email = 'Email không hợp lệ'; ok = false; }

      // Receiver là tuỳ chọn cho cả khách lẻ và công ty
    } else {
      // RETAIL: tên và SĐT đều tuỳ chọn — để trống sẽ lưu là "Khách vãng lai"
      // Email optional — chỉ validate format nếu có nhập
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { errs.email = 'Email không hợp lệ'; ok = false; }
    }

    setErrors(errs);

    // Validate receiver fields
    const rErrs = receivers.map(() => ({}));

    // Chỉ địa chỉ là bắt buộc nếu có điền bất kỳ field nào
    receivers.forEach((r, i) => {
      const anyFilled = r.receiverName.trim() || r.receiverPhone.trim() || r.receiverAddress.trim();
      if (anyFilled) {
        if (!r.receiverAddress.trim()) { rErrs[i].receiverAddress = 'Địa chỉ là bắt buộc'; ok = false; }
      }
    });

    // PHẢI CÓ ÍT NHẤT MỘT ĐỊA CHỈ NHẬN HÀNG (cả khách lẻ lẫn công ty).
    // Không có địa chỉ thì đơn của khách này không giao được, và quy tắc thu tiền
    // theo vùng cũng không xác định được — mọi đơn sẽ bị coi là ngoài địa bàn.
    // Khách nhận tại kho thì bấm nút "Nhận tại kho" để điền sẵn địa chỉ đó.
    const hasAnyAddress = receivers.some(r => r.receiverAddress.trim());
    if (!hasAnyAddress) {
      rErrs[0] = { ...rErrs[0], receiverAddress: 'Cần ít nhất 1 địa chỉ nhận hàng' };
      ok = false;
    }

    // BẮT BUỘC CHỌN PHƯỜNG/XÃ cho mọi dòng có địa chỉ.
    // Quy tắc COD tra theo đúng cặp (tỉnh, phường) — thiếu phường thì đơn của khách này
    // luôn rơi vào diện phải thu tiền trước, kho không giao được mà không ai hiểu vì sao.
    receivers.forEach((r, i) => {
      if (!r.receiverAddress.trim()) return;
      // Nhận tại kho không có địa chỉ giao nên không cần tỉnh/phường.
      if (r.receiverAddress === PICKUP_AT_WAREHOUSE) return;
      if (!r.provinceName) { rErrs[i].wardName = 'Vui lòng chọn tỉnh/thành phố'; ok = false; }
      else if (!r.wardName) { rErrs[i].wardName = 'Vui lòng chọn Phường/Xã/Đặc khu'; ok = false; }
    });

    const mainPhone = form.companyPhone;
    const filledReceivers = receivers.filter(r =>
      r.receiverName.trim() || r.receiverPhone.trim() || r.receiverAddress.trim()
    );
    const { ok: dupOk, errors: dupErrors } = validateReceiverDuplicates(filledReceivers, mainPhone);
    if (!dupOk) {
      ok = false;
      let fi = 0;
      receivers.forEach((r, i) => {
        const anyFilled = r.receiverName.trim() || r.receiverPhone.trim() || r.receiverAddress.trim();
        if (anyFilled) { rErrs[i] = { ...rErrs[i], ...dupErrors[fi] }; fi++; }
      });
    }


    setReceiverErrors(rErrs);
    return ok;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast('Vui lòng kiểm tra lại thông tin bắt buộc', 'warning');
      return;
    }
    setSaving(true);
    try {
      // Chỉ gửi receiver đã điền ít nhất địa chỉ
      const validReceivers = receivers.filter(r => r.receiverAddress.trim());

      const payload = {
        customerType,
        customerCode: form.customerCode.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        name: isCompany ? (form.contactName.trim() || null) : (form.name.trim() || null),
        contactName: isCompany ? (form.contactName.trim() || null) : (form.name.trim() || null),
        companyName: form.companyName.trim() || null,
        taxCode: form.taxCode.trim() || null,
        companyPhone: form.companyPhone.trim() || null,
        companyAddress: form.companyAddress.trim() || null,
        pricingType: form.pricingType || 'RETAIL_PRICE',
        // Tên trên hợp đồng — gửi '' để BE hiểu là dùng tên mặc định
        contractName: form.contractName.trim(),
        // Chỉ khách lẻ mới có sinh nhật; khách công ty gửi null để BE khỏi lưu rác.
        birthday: isCompany ? null : form.birthday,
        discountRate: 0,
        // Khách doanh nghiệp do seller tạo → luôn ngầm định là khách riêng (không có toggle).
        // Khách cá nhân → theo lựa chọn của seller (Khách chung / Khách riêng).
        assignPrivate: isCompany ? true : isPrivate,
        receiverInfos: validReceivers.map((r, i) => ({
          receiverName: r.receiverName.trim(),
          receiverPhone: r.receiverPhone.trim(),
          receiverAddress: r.receiverAddress.trim(),
          // Tỉnh/phường chọn từ danh mục — "Nhận tại kho" không có nên gửi null.
          provinceName: r.receiverAddress === PICKUP_AT_WAREHOUSE ? null : (r.provinceName || null),
          wardName: r.receiverAddress === PICKUP_AT_WAREHOUSE ? null : (r.wardName || null),
          isDefault: r.isDefault || i === 0,
        })),
      };

      const res = await customerApi.createB2b(payload);
      if (res.data?.code !== 900) {
        toast(res.data?.message || 'Lỗi khi tạo khách hàng', 'error');
        return;
      }
      toast('Tạo khách hàng thành công', 'success');
      onCreated(res.data?.data);
    } catch (err) {
      toast(extractServerError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Type toggle */}
      <div className="px-4 py-3 border-b border-line-soft shrink-0">
        <div className="flex rounded-xl border border-line overflow-hidden text-xs">
          {[
            ['RETAIL', <User size={11} />, t('customer', 'individual')],
            ['COMPANY', <Building2 size={11} />, t('customer', 'company')],
          ].map(([type, icon, label], i) => (
            <button key={type} type="button"
              onClick={() => { setCustomerType(type); setErrors({}); setReceiverErrors([{}]); setIsPrivate(false); }}
              className={`flex-1 py-2 font-medium transition-colors flex items-center justify-center gap-1.5
                ${i > 0 ? 'border-l border-line' : ''}
                ${customerType === type ? 'bg-gold text-white' : 'text-muted hover:bg-surface-2'}`}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        <CustomerCodeInput
          value={form.customerCode}
          onChange={val => setField('customerCode', val)}
          error={errors.customerCode}
        />

        {isCompany ? (
          <>
            <SectionLabel>Thông tin công ty</SectionLabel>
            <Field label="Tên công ty" required error={errors.companyName}
              placeholder="Công ty TNHH ABC"
              value={form.companyName} onChange={e => setField('companyName', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mã số thuế" error={errors.taxCode}
                placeholder="0123456789"
                value={form.taxCode} onChange={e => setField('taxCode', e.target.value)} />
              <Field label="Địa chỉ công ty" error={errors.companyAddress}
                placeholder="123 Nguyễn Văn A, Q.1"
                value={form.companyAddress} onChange={e => setField('companyAddress', e.target.value)} />
            </div>
            <Field label="Email" error={errors.email}
              placeholder="contact@company.com" type="email"
              value={form.email} onChange={e => setField('email', e.target.value)} />

            {/* Loại giá */}
            <div>
              <label className="text-[11px] text-muted mb-1 block font-medium">Loại giá</label>
              <div className="flex rounded-xl border border-line overflow-hidden text-xs">
                {[
                  ['RETAIL_PRICE', 'Bán lẻ (giá gốc)'],
                  ['WHOLESALE_PRICE', 'Bán sỉ (khung giá)'],
                ].map(([val, label], i) => (
                  <button key={val} type="button"
                    onClick={() => setField('pricingType', val)}
                    className={`flex-1 py-2 font-medium transition-colors
                      ${i > 0 ? 'border-l border-line' : ''}
                      ${form.pricingType === val ? 'bg-gold text-white' : 'text-muted hover:bg-surface-2'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>) : (
          <>
            <SectionLabel>Thông tin khách hàng</SectionLabel>
            <div className="flex rounded-xl border border-line overflow-hidden text-xs">
              {[
                { val: false, label: '👥 Khách chung', hint: 'Mọi seller đều thấy' },
                { val: true, label: '🔒 Khách riêng', hint: 'Chỉ bạn quản lý' },
              ].map(({ val, label, hint }, i) => (
                <button key={String(val)} type="button"
                  onClick={() => setIsPrivate(val)}
                  className={`flex-1 py-2 font-medium transition-colors flex flex-col items-center gap-0.5
        ${i > 0 ? 'border-l border-line' : ''}
        ${isPrivate === val ? 'bg-gold text-white' : 'text-muted hover:bg-surface-2'}`}>
                  <span>{label}</span>
                  <span className={`text-[9px] font-normal ${isPrivate === val ? 'text-white/80' : 'text-faint'}`}>{hint}</span>
                </button>
              ))}
            </div>
            <Field label="Họ tên" error={errors.name}
              placeholder="Nguyễn Văn A (tuỳ chọn)"
              value={form.name} onChange={e => setField('name', e.target.value)} />
            <Field label="Số điện thoại" error={errors.phone}
              placeholder="0912345678 (tuỳ chọn)"
              value={form.phone} onChange={e => setField('phone', e.target.value)} />

            {/* NGÀY SINH — bắt buộc với khách lẻ. Backend từ chối tạo khách RETAIL
                thiếu trường này, nên không có ô nhập thì người dùng bế tắc. */}
            <div>
              <label className="text-[11px] text-muted mb-1 block font-medium">
                Ngày sinh nhật
              </label>
              <DatePicker
                value={form.birthday}
                onChange={v => setField('birthday', v)}
                placeholder="Chọn ngày sinh nhật"
                maxDate={new Date()}
              />
            </div>

            <Field label="Email" error={errors.email}
              placeholder="email@example.com" type="email"
              value={form.email} onChange={e => setField('email', e.target.value)} />
            <Field label="Mã số thuế" error={errors.taxCode}
              placeholder="0123456789 (tuỳ chọn)"
              value={form.taxCode} onChange={e => setField('taxCode', e.target.value)} />

            {/* Loại giá */}
            <div>
              <label className="text-[11px] text-muted mb-1 block font-medium">Loại giá</label>
              <div className="flex rounded-xl border border-line overflow-hidden text-xs">
                {[
                  ['RETAIL_PRICE', 'Bán lẻ (giá gốc)'],
                  ['WHOLESALE_PRICE', 'Bán sỉ (khung giá)'],
                ].map(([val, label], i) => (
                  <button key={val} type="button"
                    onClick={() => setField('pricingType', val)}
                    className={`flex-1 py-2 font-medium transition-colors
                      ${i > 0 ? 'border-l border-line' : ''}
                      ${form.pricingType === val ? 'bg-gold text-white' : 'text-muted hover:bg-surface-2'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── TÊN TRÊN HỢP ĐỒNG ──────────────────────────────────────────────
            Mặc định = tên công ty (COMPANY) / họ tên (RETAIL), tự điền theo khi gõ.
            Sửa tay → ngừng tự điền, dùng đúng tên đã nhập. */}
        <Field label="Tên trên hợp đồng" error={errors.contractName}
          placeholder={contractDefault || 'Tên công ty / tên khách hàng'}
          value={form.contractName}
          onChange={e => { setContractTouched(true); setField('contractName', e.target.value); }} />
        <p className="text-[10px] text-faint -mt-1">
          {contractTouched && form.contractName.trim()
            ? 'Đang dùng tên riêng cho hợp đồng.'
            : `Mặc định theo ${isCompany ? 'tên công ty' : 'tên khách hàng'}. Sửa nếu hợp đồng ký tên khác.`}
        </p>

        {/* Địa chỉ giao hàng — bắt buộc với COMPANY, tuỳ chọn với RETAIL */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {/* Địa chỉ giao hàng — tuỳ chọn cho mọi loại khách */}
            <SectionLabel>Địa chỉ giao hàng</SectionLabel>
            <span className="text-[9px] text-faint">(tuỳ chọn)</span>
          </div>
          <button type="button" onClick={addReceiver}
            className="flex items-center gap-1 text-gold text-[11px] font-semibold hover:text-gold-deep transition-colors">
            <Plus size={12} /> Thêm
          </button>
        </div>

        <div className="space-y-2">
          {receivers.map((r, idx) => (
            <ReceiverCard
              key={idx}
              receiver={r}
              index={idx}
              isOnly={receivers.length === 1}
              errors={receiverErrors[idx]}
              required={false}
              onCopyFromAbove={() => copyFromAbove(idx)}
              onChange={(key, val) => updateReceiver(idx, key, val)}
              onRemove={() => removeReceiver(idx)}
              onSetDefault={() => setDefault(idx)}
            />
          ))}
        </div>

        {!isCompany && (
          <p className="text-[10px] text-faint italic">
            💡 Khách cá nhân có thể bỏ qua địa chỉ giao hàng nếu mua tại công ty.
          </p>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-line-soft flex gap-2 shrink-0">
        <button type="button" onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-line text-muted text-sm font-medium hover:bg-surface-2 transition-colors">
          Huỷ
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-deep disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={14} className="animate-spin" />Đang lưu...</> : 'Tạo khách hàng'}
        </button>
      </div>
    </div>
  );
}

// ── Receiver Step ─────────────────────────────────────────────────
function ReceiverStep({ customer, onSelectReceiver, onSkip, toast }) {
  const [receiverInfos, setReceiverInfos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '' });
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [customerMeta, setCustomerMeta] = useState({ discountRate: 0, invoiceDays: -1 });

  const isCompany = customer.customerType === 'COMPANY';

  useEffect(() => {
    customerApi.getReceiverInfos(customer.id)
      .then(res => {
        const payload = res.data?.data || {};
        const list = Array.isArray(payload) ? payload : (payload.receiverInfos || []);
        const discountRate = payload.discountRate ?? 0;
        const invoiceDays = payload.invoiceDays ?? -1;
        setCustomerMeta({ discountRate, invoiceDays });
        setReceiverInfos(list);
        const def = list.find(r => r.isDefault) || list[0];
        if (def) setSelectedId(def.id);
      })
      .catch(() => setReceiverInfos([]))
      .finally(() => setLoading(false));
  }, [customer.id]);

  const resetForm = () => {
    setForm({ receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '' });
    setShowAdd(false);
    setEditingId(null);
    setPhoneError('');
  };

  const handleFormChange = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (key === 'receiverPhone') setPhoneError('');
  };

  const checkPhoneDuplicate = async (phone) => {
    try {
      const res = await customerApi.checkReceiverPhone(phone.trim());
      return res.data?.data?.exists === true;
    } catch { return false; }
  };

  const handleAdd = async () => {
    if (!form.receiverAddress.trim()) {
      toast('Vui lòng nhập địa chỉ nhận hàng', 'warning');
      return;
    }
    // Bắt buộc tỉnh/thành + phường/xã cho địa chỉ giao thật (trừ "Nhận tại kho").
    if (form.receiverAddress !== PICKUP_AT_WAREHOUSE) {
      if (!form.provinceName) { toast('Vui lòng chọn Tỉnh/Thành phố', 'warning'); return; }
      if (!form.wardName)     { toast('Vui lòng chọn Phường/Xã/Đặc khu', 'warning'); return; }
    }
    if (form.receiverPhone.trim()) {
      const isDuplicate = await checkPhoneDuplicate(form.receiverPhone);
      if (isDuplicate) {
        setPhoneError('SĐT này đã được đăng ký cho người nhận khác trong hệ thống');
        toast('SĐT người nhận đã tồn tại', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await customerApi.addReceiverInfo(customer.id, {
        receiverName: form.receiverName.trim() || null,
        receiverPhone: form.receiverPhone.trim() || null,
        receiverAddress: form.receiverAddress.trim(),
        provinceName: form.provinceName || null,
        wardName: form.wardName || null,
      });
      const saved = res.data?.data;
      setReceiverInfos(prev => [...prev, saved]);
      setSelectedId(saved.id);
      toast('Đã thêm người nhận', 'success');
      resetForm();
    } catch (err) {
      toast(extractServerError(err), 'error');
    } finally { setSaving(false); }
  };

  const handleEdit = async (id) => {
    if (!form.receiverAddress.trim()) {
      toast('Vui lòng nhập địa chỉ nhận hàng', 'warning');
      return;
    }
    // Bắt buộc tỉnh/thành + phường/xã cho địa chỉ giao thật (trừ "Nhận tại kho").
    if (form.receiverAddress !== PICKUP_AT_WAREHOUSE) {
      if (!form.provinceName) { toast('Vui lòng chọn Tỉnh/Thành phố', 'warning'); return; }
      if (!form.wardName)     { toast('Vui lòng chọn Phường/Xã/Đặc khu', 'warning'); return; }
    }
    const currentInfo = receiverInfos.find(r => r.id === id);
    const phoneChanged = (currentInfo?.receiverPhone || '').trim() !== form.receiverPhone.trim();
    if (phoneChanged && form.receiverPhone.trim()) {
      const isDuplicate = await checkPhoneDuplicate(form.receiverPhone);
      if (isDuplicate) {
        setPhoneError('SĐT này đã được đăng ký cho người nhận khác trong hệ thống');
        toast('SĐT người nhận đã tồn tại', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const isPickup = form.receiverAddress === PICKUP_AT_WAREHOUSE;
      const res = await customerApi.updateReceiverInfo(customer.id, id, {
        receiverName: form.receiverName.trim() || null,
        receiverPhone: form.receiverPhone.trim() || null,
        receiverAddress: form.receiverAddress.trim(),
        provinceName: isPickup ? null : (form.provinceName || null),
        wardName: isPickup ? null : (form.wardName || null),
      });
      setReceiverInfos(prev => prev.map(r => r.id === id ? res.data?.data : r));
      toast('Đã cập nhật', 'success');
      resetForm();
    } catch (err) {
      toast(extractServerError(err), 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (receiverInfos.length === 1) {
      toast('Phải có ít nhất 1 người nhận', 'warning');
      return;
    }
    try {
      await customerApi.deleteReceiverInfo(customer.id, id);
      setReceiverInfos(prev => {
        const next = prev.filter(r => r.id !== id);
        if (selectedId === id && next.length > 0) setSelectedId(next[0].id);
        return next;
      });
      toast('Đã xóa', 'success');
    } catch (err) { toast(extractServerError(err), 'error'); }
  };

  const handleSetDefault = async (id) => {
    try {
      await customerApi.setDefaultReceiverInfo(customer.id, id);
      setReceiverInfos(prev => prev.map(r => ({ ...r, isDefault: r.id === id })));
      setSelectedId(id);
      toast('Đã đặt làm mặc định', 'success');
    } catch (err) { toast(extractServerError(err), 'error'); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setForm({
      receiverName: r.receiverName,
      receiverPhone: r.receiverPhone || '',
      receiverAddress: r.receiverAddress || '',
      provinceName: r.provinceName || '',
      wardName: r.wardName || '',
    });
    setShowAdd(false);
    setPhoneError('');
  };

  const handleConfirm = () => {
    const chosen = receiverInfos.find(r => r.id === selectedId);
    onSelectReceiver(chosen || null);
  };

  const canConfirm = true; // receiver tuỳ chọn cho mọi loại khách

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-3 bg-canvas border-b border-line-soft shrink-0 space-y-2">
        {/* Tên + mã */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">
              {customer.companyName || customer.name || 'Khách vãng lai'}
            </span>

            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
      ${customer.customerType === 'COMPANY'
                  ? 'bg-blue-100 dark:bg-blue-500/18 text-blue-700 dark:text-blue-300'
                  : 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300'
                }`}
            >
              {customer.customerType === 'COMPANY'
                ? '🏢 Khách công ty'
                : '👤 Khách cá nhân'}
            </span>
          </div>
          <p className="text-[11px] text-muted">Mã KH: #{customer.customerCode} · {customer.phone}</p>
        </div>

        {/* Chiết khấu + Xuất hóa đơn */}
        <div className="flex flex-wrap gap-2">
          {/* Chiết khấu */}
          {customerMeta.discountRate > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                Chiết khấu {customerMeta.discountRate}%
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-line">
              <span className="text-[10px] text-muted">Không chiết khấu</span>
            </div>
          )}

          {/* Xuất hóa đơn */}
          {customerMeta.invoiceDays === -1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-line">
              <span className="text-[10px] text-muted">Không xuất hóa đơn</span>
            </div>
          )}
          {customerMeta.invoiceDays === 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/28">
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-300">Xuất HĐ ngay trong ngày</span>
            </div>
          )}
          {customerMeta.invoiceDays > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/28">
              <span className="text-[10px] font-bold text-violet-600 dark:text-violet-300">
                Xuất HĐ sau {customerMeta.invoiceDays} ngày
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {receiverInfos.length === 0 && !showAdd && (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mb-4">
                  <User size={28} className="text-faint" />
                </div>
                <p className="text-ink font-medium">Chưa có thông tin người nhận</p>
                <p className="text-[13px] text-muted mt-1">
                  {isCompany
                    ? "Bạn có thể thêm hoặc xác nhận để tiếp tục"
                    : "Bạn có thể thêm hoặc xác nhận để tiếp tục"}
                </p>
              </div>
            )}

            {receiverInfos.map((r) => (
              <div key={r.id}>
                {editingId === r.id ? (
                  <InlineForm form={form} onChange={handleFormChange}
                    onSave={() => handleEdit(r.id)} onCancel={resetForm}
                    saving={saving} phoneError={phoneError} />
                ) : (
                  <div onClick={() => setSelectedId(r.id)}
                    className={`flex items-start gap-3 px-3 py-3 rounded-xl border transition-all cursor-pointer group
                      ${selectedId === r.id
                        ? 'border-gold bg-gold-tint'
                        : 'border-line hover:border-gold/50 hover:bg-canvas'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors
                      ${selectedId === r.id ? 'border-gold bg-gold' : 'border-faint'}`}>
                      {selectedId === r.id && <div className="w-1.5 h-1.5 rounded-full bg-surface" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-ink truncate">
                          {r.receiverAddress || '—'}
                        </p>
                        {r.isDefault && (
                          <span className="text-[9px] bg-gold/20 text-gold rounded-full px-1.5 py-0.5 font-semibold shrink-0">
                            Mặc định
                          </span>
                        )}
                      </div>
                      {(r.wardName || r.provinceName) && (
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          {[r.wardName, r.provinceName].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {r.receiverName && (
                        <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                          <User size={9} className="shrink-0" />{r.receiverName}
                        </p>
                      )}
                      {r.receiverPhone && (
                        <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                          <Phone size={9} className="shrink-0" />{r.receiverPhone}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => startEdit(r)}
                        className="p-1 rounded-md hover:bg-surface-2 text-faint hover:text-muted transition-colors"
                        title="Chỉnh sửa">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {!r.isDefault && (
                        <button onClick={() => handleSetDefault(r.id)}
                          className="p-1 rounded-md hover:bg-gold-tint text-faint hover:text-gold transition-colors"
                          title="Đặt làm mặc định">
                          <Star size={11} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(r.id)}
                        className="p-1 rounded-md hover:bg-red-50 dark:bg-red-500/10 text-faint hover:text-red-400 transition-colors"
                        title="Xóa">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {showAdd && (
              <InlineForm form={form} onChange={handleFormChange}
                onSave={handleAdd} onCancel={resetForm}
                saving={saving} phoneError={phoneError} />
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-line-soft space-y-2 shrink-0">
        {!showAdd && !editingId && (
          <button
            onClick={() => {
              // resetForm() KHÔNG dùng ở đây được: chính nó set showAdd = false,
              // nên gọi sau setShowAdd(true) sẽ đóng lại ngay form vừa mở —
              // đúng triệu chứng "bấm nút không có gì xảy ra".
              setForm({ receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '' });
              setPhoneError('');
              setEditingId(null);
              setShowAdd(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-line text-xs text-muted hover:border-gold hover:text-gold transition-colors">
            <Plus size={13} /> Thêm người nhận mới
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={onSkip}
            className="flex-1 py-2.5 rounded-xl border border-line text-muted text-sm font-medium hover:bg-surface-2 transition-colors">
            Bỏ qua
          </button>

          <button
            onClick={handleConfirm}
            disabled={!canConfirm || showAdd || editingId}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-bold hover:bg-gold-deep disabled:opacity-40 transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────
export default function CustomerSearchModal({ open, onClose, onSelect, selected }) {
  const { t } = useLang();
  const toast = useToast();
  const [step, setStep] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setQuery(''); setResults([]); setSearching(false);

    /*
     * ĐÃ CHỌN KHÁCH THÌ MỞ THẲNG BƯỚC NGƯỜI NHẬN.
     *
     * Bấm vào tên khách trong giỏ hàng là để XEM LẠI / ĐỔI thông tin giao hàng của
     * chính khách đó, không phải để chọn khách khác. Trước đây modal luôn về bước tìm
     * kiếm, nên thao tác đó trông như hệ thống vừa quên mất khách đang chọn.
     *
     * Vẫn đổi khách được: nút mũi tên quay lại ở header đưa về bước tìm kiếm.
     */
    if (selected?.id) {
      setSelectedCustomer(selected);
      setStep('receiver');
      return;
    }

    setSelectedCustomer(null);
    setStep('search');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, selected]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await customerApi.searchB2b(query);
        setResults(res.data?.data?.content || res.data?.data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query]);

  const handleSelectCustomer = (c) => { setSelectedCustomer(c); setStep('receiver'); };
  const handleSelectReceiver = (receiver) => { onSelect({ ...selectedCustomer, selectedReceiver: receiver }); onClose(); };
  const handleSkipReceiver = () => { onSelect({ ...selectedCustomer, selectedReceiver: null }); onClose(); };
  const handleCreated = (newCustomer) => { setSelectedCustomer(newCustomer); setStep('receiver'); };

  const titles = { search: 'Chọn khách hàng', receiver: 'Người nhận hàng', create: 'Tạo khách hàng mới' };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface w-full sm:rounded-2xl sm:max-w-md flex flex-col shadow-2xl animate-fadeIn overflow-hidden"
        style={{ maxHeight: '88vh', height: '88vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-line-soft shrink-0">
          <div className="flex items-center gap-2">
            {(step === 'receiver' || step === 'create') && (
              <button onClick={() => setStep('search')}
                className="p-1 rounded-lg text-muted hover:bg-surface-2 transition-colors">
                <ArrowLeft size={15} />
              </button>
            )}
            <h2 className="font-semibold text-ink text-sm">{titles[step]}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2">
            <X size={17} />
          </button>
        </div>

        {/* Step: Search */}
        {step === 'search' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-line-soft shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input ref={inputRef} type="text" placeholder="Tìm theo tên, mã KH, SĐT..."
                  value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:border-gold bg-canvas" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {searching ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              ) : results.length === 0 && query.trim() ? (
                <div className="flex flex-col items-center py-10 text-muted gap-2">
                  <span className="text-2xl">🔍</span>
                  <p className="text-sm">Không tìm thấy khách hàng</p>
                  <button onClick={() => setStep('create')}
                    className="mt-1 text-xs text-gold font-semibold hover:underline">
                    + Tạo khách hàng mới
                  </button>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-faint gap-2">
                  <Search size={28} strokeWidth={1} />
                  <p className="text-sm">Nhập để tìm kiếm</p>
                </div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {results.map((c) => {
                    const isLocked = c.isActive === false;
                    return (
                      <button key={c.id}
                        onClick={() => {
                          if (isLocked) { toast('Khách hàng tạm ngưng tạo đơn mới', 'error'); return; }
                          handleSelectCustomer(c);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                          ${isLocked ? 'bg-red-50/30 dark:bg-red-500/4 hover:bg-red-50/50 dark:bg-red-500/5 border-l-2 border-red-400' : 'hover:bg-canvas'}`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
                          ${isLocked ? 'bg-red-100 dark:bg-red-500/18 text-red-400' : c.customerType === 'COMPANY' ? 'bg-blue-100 dark:bg-blue-500/18 text-blue-500' : 'bg-gold-tint text-gold'}`}>
                          {c.customerType === 'COMPANY' ? <Building2 size={16} /> : (c.contactName || c.name || 'K')[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-semibold truncate ${isLocked ? 'text-red-500' : 'text-ink'}`}>
                              {c.contactName || c.name || c.companyName || 'Khách vãng lai'}
                            </p>
                            {isLocked && (
                              <span className="text-[9px] bg-red-100 dark:bg-red-500/18 text-red-500 border border-red-200 dark:border-red-500/28 rounded-full px-1.5 py-0.5 font-semibold shrink-0 whitespace-nowrap">
                                Tạm khóa
                              </span>
                            )}
                          </div>
                          <p className={`text-xs truncate ${isLocked ? 'text-red-400' : 'text-muted'}`}>
                            {c.customerCode} · {c.phone}
                            {c.customerType === 'COMPANY' && c.companyName && ` · ${c.companyName}`}
                          </p>
                          {!isLocked && c.discountRate > 0 && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-medium">Chiết khấu {c.discountRate}%</span>
                          )}
                        </div>
                        {selected?.id === c.id && !isLocked && (
                          <UserCheck size={15} className="text-gold shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-line-soft shrink-0">
              <button onClick={() => setStep('create')}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-line text-xs text-muted hover:border-gold hover:text-gold transition-colors">
                <Plus size={13} /> Tạo khách hàng mới
              </button>
            </div>
          </div>
        )}

        {step === 'create' && (
          <CreateCustomerStep onBack={() => setStep('search')} onCreated={handleCreated} toast={toast} />
        )}

        {step === 'receiver' && selectedCustomer && (
          <ReceiverStep customer={selectedCustomer} onSelectReceiver={handleSelectReceiver}
            onSkip={handleSkipReceiver} toast={toast} />
        )}
      </div>
    </div>
  );
}