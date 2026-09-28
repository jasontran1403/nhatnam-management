// src/pages/tools/ToolsPage.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, Plus, Hash, Upload, Download, Users, ShoppingCart, Database,
  FileText, X, AlertTriangle, CheckCircle2, Pencil, Search, Trash2, ChevronLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx/xlsx.mjs';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import DateRangePicker from '../../components/ui/DateRangePicker';
import MisaCatalogTab from './MisaCatalogTab';

const toolApi = {
  getData: () => api.get('/api/tools/data').then(r => r.data?.data || r.data),
  addInvoice: (d) => api.post('/api/tools/invoice-detail', d).then(r => r.data?.data || r.data),
  addInvoiceBatch: (list) => api.post('/api/tools/invoice-detail/batch', list).then(r => r.data?.data || r.data),
  lookupInvoiceBatch: (list) => api.post('/api/tools/invoice-detail/lookup', list).then(r => r.data?.data || r.data),
  checkDuplicate: (orderNumber) => api.get('/api/tools/invoice-detail/exists', { params: { orderNumber } }).then(r => r.data?.data),
  renumber: (d) => api.post('/api/tools/renumber', d),
  updateSoChungTu: (id, soChungTu) => api.post(`/api/tools/receipt/${id}/so-chung-tu`, { soChungTu }),
  importTracking: (rows) => api.post('/api/tools/import/tracking', rows).then(r => r.data?.data || r.data),
  importSales: (rows) => api.post('/api/tools/import/sales', rows).then(r => r.data?.data || r.data),
  importCustomers: (rows) => api.post('/api/tools/import/customers', rows).then(r => r.data?.data || r.data),
  setConfig: (key, value) => api.post('/api/tools/config', { key, value }),
  listTracking: (q, page = 0, size = 500) => api.get('/api/tools/tracking', { params: { q, page, size } }).then(r => r.data?.data || r.data),
  updateTracking: (id, body) => api.put(`/api/tools/tracking/${id}`, body),
  deleteTracking: (id) => api.delete(`/api/tools/tracking/${id}`),
  listSales: (q, page = 0, size = 500) => api.get('/api/tools/sales', { params: { q, page, size } }).then(r => r.data?.data || r.data),
  updateSales: (id, body) => api.put(`/api/tools/sales/${id}`, body),
  deleteSales: (id) => api.delete(`/api/tools/sales/${id}`),
  listCustomers: (q, page = 0, size = 500) => api.get('/api/tools/customers', { params: { q, page, size } }).then(r => r.data?.data || r.data),
  updateCustomer: (id, body) => api.put(`/api/tools/customers/${id}`, body),
  deleteCustomer: (id) => api.delete(`/api/tools/customers/${id}`),
  listInvoiceDetails: (q, page = 0, size = 500) => api.get('/api/tools/invoice-details', { params: { q, page, size } }).then(r => r.data?.data || r.data),
  deleteInvoiceDetail: (id) => api.delete(`/api/tools/invoice-details/${id}`),
  listMisaOrders: (params) => api.get('/api/tools/misa-orders', { params }).then(r => r.data?.data || r.data),
  generateMisaData: (orderIds) => api.post('/api/tools/misa-generate', orderIds).then(r => r.data?.data || r.data),
  clearTracking: () => api.delete('/api/tools/clear/tracking'),
  clearSales: () => api.delete('/api/tools/clear/sales'),
  clearCustomers: () => api.delete('/api/tools/clear/customers'),
  clearInvoiceDetails: () => api.delete('/api/tools/clear/invoice-details'),
  clearReceipts: () => api.delete('/api/tools/clear/receipts'),
  /** Xóa cả phiếu đặt hàng đã nhập và phiếu thu — dùng cho nút Xóa tất cả ở tab Phiếu đặt hàng. */
  clearInvoiceAndReceipts: () => api.delete('/api/tools/clear/invoice-and-receipts'),
};

/** Excel serial date → dd/MM/yyyy */
function excelDateToStr(v) {
  if (typeof v === 'number' && v > 30000 && v < 100000) {
    const d = new Date((v - 25569) * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  return String(v ?? '');
}

function normalizeCell(v, isDateCol) {
  if (v == null) return '';
  if (isDateCol) return excelDateToStr(v);
  return String(v);
}

function fmtMoney(v) {
  if (!v) return '';
  return new Intl.NumberFormat('vi-VN').format(Number(v));
}

const RECEIPT_HEADERS = [
  'Hiển thị trên sổ', 'Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ',
  'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ', 'Lý do nộp', 'Diễn giải lý do nộp',
  'Người nộp', 'Nhân viên thu', 'Kèm theo', 'Loại tiền', 'Tỷ giá', 'Diễn giải',
  'TK Nợ', 'TK Có', 'Số tiền', 'Quy đổi', 'Đối tượng', 'TK ngân hàng',
];

function receiptToRow(r) {
  return [
    '', r.ngayHachToan, r.ngayChungTu, r.soChungTu,
    r.maDoiTuong, r.tenDoiTuong, r.diaChi || '', r.lyDoNop || '', r.dienGiaiLyDoNop || '',
    '', '', '', r.loaiTien || 'VND', '', '',
    r.tkNo || '1111', r.tkCo || '131', r.soTien || '', '', '', '',
  ];
}

// ── DRAG & DROP ────────────────────────────────────────────────────────────
function FileDropZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) { alert('Chỉ chấp nhận file .xlsx'); return; }
    onFile(f);
  };
  return (
    <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${dragging ? 'border-gold bg-gold/5' : 'border-line-soft hover:border-gold/40'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}>
      <Upload size={24} className="mx-auto text-muted mb-2" />
      <p className="text-sm text-muted">Click chọn file hoặc kéo thả file .xlsx vào đây</p>
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
}

// ── IMPORT MODAL ───────────────────────────────────────────────────────────
function ImportModal({ title, expectedHeaders, dateColumns = [], headerRowIndex = 0, onImport, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const parseFile = async (file) => {
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length <= headerRowIndex) { setError('File trống hoặc không đủ dòng header'); return; }
      const headers = raw[headerRowIndex].map(h => String(h).trim());
      const missing = expectedHeaders.filter(eh => !headers.some(h => h === eh));
      if (missing.length > 0) { setError(`File thiếu cột: ${missing.join(', ')}`); return; }
      const dataRows = raw.slice(headerRowIndex + 1).filter(r => r.some(c => c !== ''));
      const parsed = dataRows.map(r => {
        const obj = {};
        expectedHeaders.forEach(h => {
          const ci = headers.indexOf(h);
          const raw = ci >= 0 ? r[ci] : '';
          obj[h] = normalizeCell(raw, dateColumns.includes(h));
        });
        return obj;
      });
      setRows(parsed);
    } catch (e) { setError('Không thể đọc file: ' + e.message); }
  };

  const handleImport = async () => {
    if (!rows?.length) return;
    setLoading(true);
    try {
      const result = await onImport(rows);
      toast(`Import: ${result.imported} dòng mới, bỏ qua ${result.skipped} dòng trùng`, 'success');
      onClose();
    } catch (e) { toast('Lỗi import: ' + (e?.response?.data?.message || e.message), 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-line-soft shrink-0">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Upload size={15} className="text-gold" />{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <FileDropZone onFile={parseFile} />
          {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}
          {rows && <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"><CheckCircle2 size={14} />Đọc được {rows.length} dòng (trùng sẽ tự bỏ qua)</div>}
          <p className="text-[10px] text-muted">Cần header: <span className="font-mono">{expectedHeaders.join(', ')}</span></p>
        </div>
        <div className="p-5 border-t border-line-soft flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted">Huỷ</button>
          <button onClick={handleImport} disabled={!rows || loading}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-50">
            {loading ? 'Đang import...' : `Import ${rows?.length || 0} dòng`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AUTO FORMAT DATE ──────────────────────────────────────────────────────────
// Input: "29426" → "29/04/2026", "8826" → "08/08/2026"
function autoFormatDate(raw) {
  const digits = raw.replace(/\D/g, '');
  // Chỉ format khi đúng 8 chữ số: ddmmyyyy
  if (digits.length !== 8) return raw;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${dd}/${mm}/${yyyy}`;
}

// ── BATCH ADD INVOICE MODAL ──────────────────────────────────────────────
function BatchAddInvoiceModal({ onClose, onAdded }) {
  const toast = useToast();
  const [order, setOrder] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const orderRef = useRef();

  // ─── Check trùng ─────────────────────────────────────────────────────
  // Danh sách mã đơn đã có trong batch (lowercase để so sánh ignore-case)
  const allOrderNumbers = useMemo(
    () => groups.flatMap(g => g.items.map(i => i.orderNumber.toLowerCase())),
    [groups]
  );

  // Các token đã "hoàn chỉnh" trong input — chỉ tính các token ĐÃ CÓ dấu phẩy/xuống dòng phía sau.
  // Token cuối cùng (chưa có dấu phẩy) đang được gõ → bỏ qua, tránh báo lỗi nhầm khi user
  // đang gõ "NĐ-00453" và chuẩn bị gõ tiếp thành "NĐ-004535".
  const completedTokens = useMemo(() => {
    const parts = order.split(/[,\n]/);
    return parts.slice(0, -1).map(s => s.trim()).filter(Boolean);
  }, [order]);

  // Tính lỗi trùng trong input + trùng với batch
  const dupErrors = useMemo(() => {
    const seen = new Set();
    const dupsInInput = [];
    const dupsInBatch = [];
    for (const token of completedTokens) {
      const key = token.toLowerCase();
      if (seen.has(key)) {
        dupsInInput.push(token);
      } else if (allOrderNumbers.includes(key)) {
        dupsInBatch.push(token);
      }
      seen.add(key);
    }
    return {
      dupsInInput: [...new Set(dupsInInput)],
      dupsInBatch: [...new Set(dupsInBatch)],
    };
  }, [completedTokens, allOrderNumbers]);

  const hasDupError = dupErrors.dupsInInput.length > 0 || dupErrors.dupsInBatch.length > 0;

  // ─── Add to batch: gọi lookup-only, không lưu DB ─────────────────────
  const addToBatch = async () => {
    const trimDate = date.trim();
    const rawAmount = amount.replace(/\D/g, '');
    if (!order.trim() || !rawAmount || !trimDate) { toast('Nhập đủ 3 trường', 'error'); return; }

    const formattedDate = autoFormatDate(trimDate);
    // Lấy TẤT CẢ token (kể cả token cuối đang gõ) — vì bấm nút = chốt hết
    const orderNumbers = order.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
    if (orderNumbers.length === 0) { toast('Số phiếu ĐH không hợp lệ', 'error'); return; }

    // ─── Check trùng NGAY TRONG INPUT (kể cả token cuối) ───────────────
    const seen = new Set();
    const dupInInput = [];
    for (const o of orderNumbers) {
      const key = o.toLowerCase();
      if (seen.has(key)) dupInInput.push(o);
      seen.add(key);
    }
    if (dupInInput.length > 0) {
      toast(`Trùng trong lần nhập: ${[...new Set(dupInInput)].join(', ')}`, 'error');
      return;  // ← return sớm
    }

    // ─── Check trùng với danh sách chờ (kể cả token cuối) ──────────────
    const dupInBatch = orderNumbers.filter(o => allOrderNumbers.includes(o.toLowerCase()));
    if (dupInBatch.length > 0) {
      toast(`Đã có trong danh sách: ${[...new Set(dupInBatch)].join(', ')}`, 'error');
      return;  // ← return sớm
    }

    // ... phần còn lại (tạo group, gọi lookup, v.v.) giữ nguyên
    const groupId = Math.random().toString(36).slice(2, 8);
    const newGroup = {
      groupId,
      date: formattedDate,
      amountRaw: rawAmount,
      amountDisplay: amount,
      items: orderNumbers.map((o, idx) => ({
        orderNumber: o,
        groupLeader: idx === 0,
        value: null, customerName: null, fInv: null, fInv7: null, errorNote: null, looked: false,
      })),
    };

    setOrder(''); setAmount(''); setDate('');
    orderRef.current?.focus();
    setGroups(prev => [...prev, newGroup]);
    setSubmitting(true);

    try {
      const reqs = newGroup.items.map((item, idx) => ({
        orderNumber: item.orderNumber,
        amount: idx === 0 ? Number(rawAmount) : 0,
        invoiceDate: formattedDate,
      }));
      const results = await toolApi.lookupInvoiceBatch(reqs);

      setGroups(prev => prev.map(g => {
        if (g.groupId !== groupId) return g;
        return {
          ...g,
          items: g.items.map(item => {
            const res = results.find(r => r.orderNumber === item.orderNumber);
            if (!res) return item;
            return {
              ...item,
              value: res.value,
              customerName: res.customerName,
              tenKhachHangFull: res.tenKhachHangFull,
              fInv: res.finv,
              fInv7: res.finv7,
              errorNote: res.errorNote,
              looked: true,
            };
          }),
        };
      }));
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lookup', 'error');
      setGroups(prev => prev.filter(g => g.groupId !== groupId));
    } finally {
      setSubmitting(false);
    }
  };

  const removeGroup = (groupId) => setGroups(prev => prev.filter(g => g.groupId !== groupId));

  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);

  const handleSave = async () => {
    if (groups.length === 0) { toast('Chưa có phiếu nào', 'error'); return; }
    setSubmitting(true);
    try {
      for (const g of groups) {
        const reqs = g.items.map((item, idx) => ({
          orderNumber: item.orderNumber,
          amount: idx === 0 ? Number(g.amountRaw) : 0,
          invoiceDate: g.date,
        }));
        await toolApi.addInvoiceBatch(reqs);
      }
      toast(`Đã lưu ${totalItems} đơn vào database`, 'success');
      onAdded?.();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi lưu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtInput = (v) => { const d = v.replace(/\D/g, ''); return d ? new Intl.NumberFormat('vi-VN').format(Number(d)) : ''; };
  const fmtVnd = (v) => {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (isNaN(n)) return '—';
    return n.toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl flex flex-col"
        style={{ width: '80dvw', maxHeight: '80dvh', height: '80dvh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line-soft shrink-0">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Plus size={15} className="text-gold" />Nhập Chi tiết invoice (Batch)
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>

        {/* Input row */}
        <div className="p-4 border-b border-line-soft shrink-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Số phiếu đặt hàng</label>
              <input ref={orderRef} value={order}
                onChange={e => setOrder(e.target.value.replace(/[^\p{L}\p{N}\-,\s]/gu, ''))}
                onKeyDown={e => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    const pos = e.target.selectionStart;
                    const before = order.slice(0, pos);
                    const after = order.slice(pos);
                    if (/[\p{L}\p{N}]$/u.test(before)) {
                      const next = before + ', ' + after;
                      setOrder(next);
                      setTimeout(() => orderRef.current?.setSelectionRange(pos + 2, pos + 2), 0);
                    }
                  } else if (e.key === 'Enter' && !hasDupError) addToBatch();
                }}
                placeholder="NĐ-00452 hoặc NĐ-00452, NĐ-00453"
                className={`w-full px-3 py-2 rounded-xl border text-sm bg-canvas focus:outline-none focus:ring-2 font-mono
                  ${hasDupError ? 'border-red-400 focus:ring-red-300' : 'border-line focus:ring-gold/40'}`} />
              {dupErrors.dupsInInput.length > 0 && (
                <p className="text-[10px] text-red-500 mt-1">
                  Trùng trong lần nhập: {dupErrors.dupsInInput.join(', ')}
                </p>
              )}
              {dupErrors.dupsInBatch.length > 0 && (
                <p className="text-[10px] text-red-500 mt-1">
                  Đã có trong danh sách: {dupErrors.dupsInBatch.join(', ')}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Số tiền (tổng nhóm)</label>
              <input value={amount} onChange={e => setAmount(fmtInput(e.target.value))}
                placeholder="8,500,000"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40"
                onKeyDown={e => e.key === 'Enter' && !hasDupError && addToBatch()} />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Ngày (nhập tắt: 29042026→29/04/2026)</label>
              <input value={date}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d/]/g, '');
                  const digits = raw.replace(/\D/g, '');
                  if (digits.length === 8 && !raw.includes('/')) setDate(autoFormatDate(digits));
                  else if (digits.length < 8 && raw.includes('/')) setDate(digits);
                  else setDate(raw);
                }}
                placeholder="29042026 hoặc 29/04/2026"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40"
                onKeyDown={e => e.key === 'Enter' && !hasDupError && addToBatch()} />
            </div>
          </div>
          <button onClick={addToBatch} disabled={loading || hasDupError}
            className="w-full py-2 rounded-xl bg-surface border border-gold/50 text-gold text-sm font-semibold hover:bg-gold/5 disabled:opacity-50 disabled:cursor-not-allowed">
            + Thêm vào danh sách
          </button>
        </div>

        {/* Groups table — scrollable */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-2 border-b border-line-soft shrink-0">
            <p className="text-xs text-muted font-semibold">
              Danh sách chờ nhập ({totalItems} đơn, {groups.length} nhóm)
            </p>
          </div>

          <div className="flex-1 overflow-auto px-4 py-3">
            {groups.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                Thêm phiếu vào danh sách để bắt đầu
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-canvas z-10">
                  <tr className="text-muted uppercase text-[10px] tracking-wide">
                    <th className="px-2 py-1.5 text-left w-8">#</th>
                    <th className="px-2 py-1.5 text-left">Mã đơn</th>
                    <th className="px-2 py-1.5 text-left">Tiền đơn (tracking)</th>
                    <th className="px-2 py-1.5 text-left">Tổng nhóm</th>
                    <th className="px-2 py-1.5 text-left">Đã nhập</th>
                    <th className="px-2 py-1.5 text-left">Ngày</th>
                    <th className="px-2 py-1.5 text-left">Khách hàng</th>
                    <th className="px-2 py-1.5 text-left">F.INV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {groups.map((g, groupIdx) => {
                    const groupValueSum = g.items.reduce((s, i) => {
                      const v = Number(i.value) || 0;
                      return s + v;
                    }, 0);

                    // Delta = Tổng nhóm - Đã nhập
                    const amountNum = Number(g.amountRaw) || 0;
                    const delta = groupValueSum - amountNum;
                    const absDelta = Math.abs(delta);
                    const allLooked = g.items.every(i => i.looked);
                    const showRed = allLooked && absDelta >= 10000;
                    const showGreen = allLooked && absDelta < 10000;

                    const firstCust = g.items[0]?.customerName;
                    const rowCount = g.items.length;
                    const stripeClass = groupIdx % 2 === 0
                      ? 'bg-canvas/40 dark:bg-canvas/40'
                      : 'bg-surface dark:bg-surface';

                    const itemRows = g.items.map((item, itemIdx) => {
                      const isDiffCust = firstCust && item.customerName && item.customerName !== firstCust;
                      const noFInv = item.looked && !item.fInv;
                      const hasError = item.errorNote || isDiffCust || noFInv;
                      const isFirst = itemIdx === 0;

                      return (
                        <tr key={`${g.groupId}-${item.orderNumber}`}>
                          <td className={`px-2 py-1.5 text-muted font-mono`}>
                            {isFirst && (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-gold shrink-0" title="Đầu nhóm" />
                              </span>
                            )}
                          </td>
                          <td className={`px-2 py-1.5 font-mono font-semibold text-ink`}>{item.orderNumber}</td>
                          <td className={`px-2 py-1.5 text-left text-muted font-mono`}>
                            {item.looked
                              ? (item.value ? fmtVnd(item.value) : <span className="text-muted/50">—</span>)
                              : <span className="text-muted/50">—</span>}
                          </td>

                          {isFirst && (
                            <td rowSpan={rowCount}
                              className={`px-2 py-1.5 text-left font-mono font-semibold align-middle
                                ${showRed ? 'text-red-600 dark:text-red-400'
                                  : showGreen ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-ink'}`}>
                              {item.looked ? fmtVnd(groupValueSum) : ''}
                            </td>
                          )}

                          {isFirst && (
                            <td rowSpan={rowCount}
                              className={`px-2 py-1.5 text-left font-mono font-semibold align-middle
                                ${showRed ? 'text-red-600 dark:text-red-400'
                                  : showGreen ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gold'}`}>
                              {fmtVnd(g.amountRaw)}
                            </td>
                          )}

                          {isFirst && (
                            <td rowSpan={rowCount}
                              className={`px-2 py-1.5 text-left text-muted align-middle`}>
                              {g.date}
                            </td>
                          )}

                          <td className={`px-2 py-1.5`}>
                            {item.looked && item.customerName ? (
                              <span className={isDiffCust ? 'text-red-500 italic font-semibold' : 'text-ink'}>
                                {item.customerName}
                                {isDiffCust && <span className="ml-1 text-[9px]">(khác nhóm!)</span>}
                              </span>
                            ) : <span className="text-muted/50">—</span>}
                          </td>
                          <td className={`px-2 py-1.5`}>
                            {item.looked ? (
                              item.fInv
                                ? <span className="font-mono text-emerald-600">{item.fInv}</span>
                                : <span className="text-red-500 italic">Không có F.INV</span>
                            ) : <span className="text-muted/50">—</span>}
                          </td>
                        </tr>
                      );
                    });

                    const sepRow = (
                      <tr key={`sep-${g.groupId}`} className={stripeClass}>
                        <td colSpan={8} className="px-2 py-0.5 border-t-2 border-gold/20">
                          <button onClick={() => removeGroup(g.groupId)}
                            className="text-[10px] text-red-400 hover:text-red-500 hover:underline float-right">
                            Xóa nhóm
                          </button>
                        </td>
                      </tr>
                    );

                    return [...itemRows, sepRow];
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line-soft flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted">
            Huỷ
          </button>
          <button onClick={handleSave}
            disabled={totalItems === 0 || submitting}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Đang lưu...' : `✓ Lưu vào database (${totalItems} đơn · ${groups.length} nhóm)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── INVOICE DETAILS VIEW MODAL ─────────────────────────────────────────────
function InvoiceDetailsViewModal({ onClose, onDataChanged }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchTimeout = useRef();
  const scrollRef = useRef();
  const searchRef = useRef('');

  const fetchPage = useCallback(async (q, p, append) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await toolApi.listInvoiceDetails(q || '', p, 500);
      const content = res.content || [];
      if (append) setRows(prev => [...prev, ...content]);
      else setRows(content);
      setTotal(res.total || 0);
      setHasMore(res.hasMore || false);
      setPage(p);
    } catch { toast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchPage('', 0, false); }, [fetchPage, refreshKey]);

  const handleSearch = (v) => {
    setSearch(v); searchRef.current = v;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchPage(v, 0, false), 600);
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loadingMore || !hasMore) return;
    const el = scrollRef.current;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight * 0.7) {
      fetchPage(searchRef.current, page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchPage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận xóa dòng này?')) return;
    try {
      await toolApi.deleteInvoiceDetail(id);
      toast('Đã xóa', 'success');
      setRows(prev => prev.filter(r => r.id !== id));
      setTotal(t => t - 1);
    } catch { toast('Lỗi xóa', 'error'); }
  };

  const handleClearAll = async () => {
    if (!confirm('Xóa toàn bộ phiếu đã nhập + phiếu thu? Không thể hoàn tác.')) return;
    try {
      await toolApi.clearInvoiceAndReceipts();
      toast('Đã xóa tất cả', 'success');
      fetchPage('', 0, false);
      onDataChanged?.();
    } catch { toast('Lỗi', 'error'); }
  };

  const handleAdded = () => {
    setRefreshKey(k => k + 1);
    onDataChanged?.();
  };

  const fmtVnd = (v) => {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (isNaN(n)) return '—';
    return n.toLocaleString('vi-VN') + ' đ';
  };

  // Nhóm rows theo groupId
  const groupedRows = useMemo(() => {
    const groups = new Map();
    for (const r of rows) {
      const gid = r.groupId || `_${r.id}`;
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid).push(r);
    }
    return [...groups.values()];
  }, [rows]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl flex flex-col" style={{ width: '85dvw', height: '85dvh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line-soft shrink-0">
          <h3 className="text-sm font-bold text-ink">
            Phiếu đặt hàng đã nhập <span className="text-muted font-normal">({total} dòng{rows.length < total ? `, đang hiện ${rows.length}` : ''})</span>
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBatchAdd(true)}
              className="px-2.5 py-1 rounded-lg bg-gold/10 text-gold text-[10px] font-semibold hover:bg-gold/20 flex items-center gap-1">
              <Plus size={11} />Nhập chi tiết invoice
            </button>
            <button onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-semibold hover:bg-red-100">
              <Trash2 size={11} className="inline mr-1" />Xóa tất cả
            </button>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Tìm kiếm..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-line text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 w-56" />
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
          </div>
        </div>

        {/* Table */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <span className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                <span className="text-xs text-muted">Đang tải...</span>
              </div>
            </div>
          ) : groupedRows.length === 0 ? (
            <div className="p-12 text-center text-muted text-xs">
              {search ? `Không tìm thấy "${search}"` : 'Chưa có dữ liệu'}
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-canvas z-10">
                <tr className="text-muted uppercase text-[10px] tracking-wide">
                  <th className="px-2 py-1.5 text-left w-8">#</th>
                  <th className="px-2 py-1.5 text-left">Mã đơn</th>
                  <th className="px-2 py-1.5 text-left">Tiền đơn (tracking)</th>
                  <th className="px-2 py-1.5 text-left">Tổng nhóm</th>
                  <th className="px-2 py-1.5 text-left">Đã nhập</th>
                  <th className="px-2 py-1.5 text-left">Ngày</th>
                  <th className="px-2 py-1.5 text-left">Khách hàng</th>
                  <th className="px-2 py-1.5 text-left">F.INV</th>
                  <th className="px-2 py-1.5 text-left">Ghi chú lỗi</th>
                  <th className="px-2 py-1.5 text-center w-16">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {groupedRows.map((items, groupIdx) => {
                  const groupValueSum = items.reduce((s, i) => {
                    const v = Number(i.value) || 0;
                    return s + v;
                  }, 0);
                  const amountNum = Number(items[0]?.amount) || 0;
                  const delta = groupValueSum - amountNum;
                  const absDelta = Math.abs(delta);
                  const showRed = absDelta >= 10000;
                  const showGreen = absDelta < 10000;
                  const firstCust = items[0]?.customerName;
                  const rowCount = items.length;
                  const stripeClass = groupIdx % 2 === 0
                    ? 'bg-canvas/40 dark:bg-canvas/40'
                    : 'bg-surface dark:bg-surface';

                  const itemRows = items.map((item, itemIdx) => {
                    const isFirst = itemIdx === 0;
                    const isDiffCust = firstCust && item.customerName && item.customerName !== firstCust;
                    const hasError = item.errorNote || isDiffCust;
                    const bgClass = hasError ? 'bg-red-50 dark:bg-red-500/10' : stripeClass;

                    return (
                      <tr key={item.id} className={bgClass}>
                        <td className="px-2 py-1.5 text-muted font-mono">
                          {isFirst && (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-gold shrink-0" title="Đầu nhóm" />
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-mono font-semibold text-ink">{item.orderNumber}</td>
                        <td className="px-2 py-1.5 text-left text-muted font-mono">
                          {item.value ? fmtVnd(item.value) : <span className="text-muted/50">—</span>}
                        </td>

                        {isFirst && (
                          <td rowSpan={rowCount}
                            className={`px-2 py-1.5 text-left font-mono font-semibold align-middle
                              ${showRed ? 'text-red-600 dark:text-red-400'
                                : showGreen ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-ink'}`}>
                            {fmtVnd(groupValueSum)}
                          </td>
                        )}

                        {isFirst && (
                          <td rowSpan={rowCount}
                            className={`px-2 py-1.5 text-left font-mono font-semibold align-middle
                              ${showRed ? 'text-red-600 dark:text-red-400'
                                : showGreen ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-gold'}`}>
                            {fmtVnd(item.amount)}
                          </td>
                        )}

                        {isFirst && (
                          <td rowSpan={rowCount} className="px-2 py-1.5 text-left text-muted align-middle">
                            {item.invoiceDate}
                          </td>
                        )}

                        <td className="px-2 py-1.5">
                          {item.tenKhachHangFull || item.customerName ? (
                            <span className={isDiffCust ? 'text-red-500 italic font-semibold' : 'text-ink'}>
                              {item.tenKhachHangFull || item.customerName}
                              {isDiffCust && <span className="ml-1 text-[9px]">(khác nhóm!)</span>}
                            </span>
                          ) : <span className="text-muted/50">—</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {item.fInv
                            ? <span className="font-mono text-emerald-600">{item.fInv}</span>
                            : <span className="text-red-500 italic">Không có F.INV</span>}
                        </td>
                        <td className="px-2 py-1.5 text-red-500 text-[10px] max-w-[300px]">
                          <span className="line-clamp-2" title={item.errorNote || ''}>{item.errorNote || ''}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => handleDelete(item.id)}
                            className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-semibold hover:bg-red-100">
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  });

                  return itemRows;
                })}
              </tbody>
            </table>
          )}
          {loadingMore && <div className="p-4 text-center"><span className="inline-flex items-center gap-2 text-xs text-muted"><span className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />Đang tải thêm...</span></div>}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-line-soft shrink-0 flex items-center justify-between bg-canvas rounded-b-2xl">
          <span className="text-[10px] text-muted">Hiển thị {rows.length} / {total.toLocaleString('vi-VN')}</span>
          {hasMore && <span className="text-[10px] text-gold">↓ Cuộn để tải thêm</span>}
        </div>
      </div>

      {showBatchAdd && (
        <BatchAddInvoiceModal
          onClose={() => setShowBatchAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

function EditableSoChungTu({ value, receiptId, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef();
  const toast = useToast();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const save = async () => {
    if (val.trim() === value) { setEditing(false); return; }
    try {
      await toolApi.updateSoChungTu(receiptId, val.trim());
      toast('Đã cập nhật số chứng từ + auto tăng các dòng sau', 'success');
      onSaved?.();
    } catch (e) { toast('Lỗi: ' + (e?.response?.data?.message || e.message), 'error'); setVal(value); }
    setEditing(false);
  };

  if (!editing) {
    return (
      <span className="cursor-pointer group flex items-center gap-1" onClick={() => setEditing(true)}>
        <span className="font-mono">{value}</span>
        <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition" />
      </span>
    );
  }
  return (
    <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
      className="w-28 px-1.5 py-0.5 rounded border border-gold text-xs font-mono bg-canvas focus:outline-none" />
  );
}

// ── DATA VIEW MODAL ────────────────────────────────────────────────────────
const PAGE_SIZE = 500;
const SCROLL_THRESHOLD = 0.7;

function DataViewModal({ title, columns, fetchFn, updateFn, deleteFn, clearFn, onClose,
  importConfig, extraHeaderButton }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [showImport, setShowImport] = useState(false);
  const searchTimeout = useRef();
  const scrollRef = useRef();
  const searchRef = useRef('');

  const fetchPage = useCallback(async (q, p, append) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetchFn(q || '', p, PAGE_SIZE);
      const content = res.content || [];
      if (append) { setRows(prev => [...prev, ...content]); } else { setRows(content); }
      setTotal(res.total || 0);
      setHasMore(res.hasMore || false);
      setPage(p);
    } catch { toast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [fetchFn]);

  useEffect(() => { fetchPage('', 0, false); }, [fetchPage]);

  const handleSearch = (v) => {
    setSearch(v); searchRef.current = v;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { fetchPage(v, 0, false); }, 600);
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loadingMore || !hasMore) return;
    const el = scrollRef.current;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight * SCROLL_THRESHOLD) {
      fetchPage(searchRef.current, page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchPage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const startEdit = (row) => { setEditId(row.id); setEditRow({ ...row }); };
  const cancelEdit = () => { setEditId(null); setEditRow({}); };
  const saveEdit = async () => {
    try {
      const { id, ...body } = editRow;
      await updateFn(id, body);
      toast('Đã lưu', 'success');
      setEditId(null);
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...body } : r));
    } catch (e) { toast('Lỗi: ' + (e?.response?.data?.message || e.message), 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xác nhận xóa dòng này?')) return;
    try {
      await deleteFn(id);
      toast('Đã xóa', 'success');
      setRows(prev => prev.filter(r => r.id !== id));
      setTotal(t => t - 1);
    } catch { toast('Lỗi xóa', 'error'); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl flex flex-col" style={{ width: '85dvw', height: '85dvh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-line-soft shrink-0">
          <h3 className="text-sm font-bold text-ink">{title} <span className="text-muted font-normal">({total} dòng{rows.length < total ? `, đang hiện ${rows.length}` : ''})</span></h3>
          <div className="flex items-center gap-2">
            {extraHeaderButton}
            {importConfig && (
              <button onClick={() => setShowImport(true)}
                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 text-[10px] font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 flex items-center gap-1">
                <Upload size={11} />Import
              </button>
            )}
            {clearFn && <button onClick={async () => {
              if (!confirm('Xóa toàn bộ dữ liệu? Không thể hoàn tác.')) return;
              try { await clearFn(); toast('Đã xóa tất cả', 'success'); fetchPage('', 0, false); } catch { toast('Lỗi', 'error'); }
            }} className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-semibold hover:bg-red-100">
              <Trash2 size={11} className="inline mr-1" />Xóa tất cả
            </button>}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Tìm kiếm..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-line text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 w-56" />
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gradient-to-r from-canvas to-surface">
                <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold uppercase tracking-wider border-b-2 border-gold/20 w-10">#</th>
                {columns.map(c => <th key={c} className="px-3 py-2.5 text-left text-[10px] text-muted font-bold uppercase tracking-wider whitespace-nowrap border-b-2 border-gold/20">{c}</th>)}
                <th className="px-3 py-2.5 text-center text-[10px] text-muted font-bold uppercase tracking-wider border-b-2 border-gold/20 w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={columns.length + 2} className="p-12 text-center">
                <div className="flex flex-col items-center gap-2"><span className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /><span className="text-xs text-muted">Đang tải...</span></div>
              </td></tr>
                : rows.length === 0 ? <tr><td colSpan={columns.length + 2} className="p-12 text-center text-muted">{search ? `Không tìm thấy "${search}"` : 'Không có dữ liệu'}</td></tr>
                  : rows.map((row, idx) => {
                    const isEditing = editId === row.id;
                    return (
                      <tr key={row.id} className={`border-b border-line-soft/50 transition-colors ${isEditing ? 'bg-gold/5' : idx % 2 === 0 ? 'bg-surface' : 'bg-canvas/50'} hover:bg-gold/5`}>
                        <td className="px-3 py-2 text-muted font-mono text-[10px]">{idx + 1}</td>
                        {columns.map(c => (
                          <td key={c} className="px-3 py-2 max-w-[220px]">
                            {isEditing
                              ? <input value={editRow[c] || ''} onChange={e => setEditRow(p => ({ ...p, [c]: e.target.value }))}
                                className="w-full px-2 py-1 rounded-lg border border-gold/50 text-xs bg-surface focus:outline-none focus:ring-1 focus:ring-gold/40" />
                              : <span className="truncate block" title={row[c] || ''}>{row[c] || ''}</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={saveEdit} className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-semibold hover:bg-emerald-600">Lưu</button>
                              <button onClick={cancelEdit} className="px-2 py-1 rounded-lg bg-surface border border-line text-[10px] text-muted hover:bg-canvas">Huỷ</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {updateFn && <button onClick={() => startEdit(row)} className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 text-[10px] font-semibold hover:bg-blue-100">Sửa</button>}
                              <button onClick={() => handleDelete(row.id)} className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 text-[10px] font-semibold hover:bg-red-100">Xóa</button>
                            </div>
                          )}
                        </td>
                      </tr>);
                  })}
              {loadingMore && <tr><td colSpan={columns.length + 2} className="p-4 text-center"><span className="inline-flex items-center gap-2 text-xs text-muted"><span className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />Đang tải thêm...</span></td></tr>}
              {!hasMore && rows.length > 0 && !loading && (
                <tr><td colSpan={columns.length + 2} className="p-2 text-center text-[10px] text-muted">— Hết dữ liệu —</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-line-soft shrink-0 flex items-center justify-between bg-canvas rounded-b-2xl">
          <span className="text-[10px] text-muted">Hiển thị {rows.length} / {total.toLocaleString('vi-VN')}</span>
          {hasMore && <span className="text-[10px] text-gold">↓ Cuộn để tải thêm</span>}
        </div>
      </div>

      {showImport && importConfig && (
        <ImportModal
          title={importConfig.title}
          expectedHeaders={importConfig.expectedHeaders}
          dateColumns={importConfig.dateColumns || []}
          headerRowIndex={importConfig.headerRowIndex || 0}
          onImport={importConfig.onImport}
          onClose={() => { setShowImport(false); fetchPage('', 0, false); }}
        />
      )}
    </div>
  );
}

// ── IMPORT CONFIGS + DATA VIEW CONFIG ────────────────────────────────────────
const IMPORT_CONFIGS = {
  tracking: {
    title: 'Import Theo dõi Invoice',
    expectedHeaders: ['Date', 'Invoice', 'Customer', 'Value', 'F.Inv', 'COD'],
    dateColumns: ['Date'],
    headerRowIndex: 0,
    onImport: toolApi.importTracking,
  },
  sales: {
    title: 'Import Bán hàng',
    expectedHeaders: ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Số hóa đơn', 'Khách hàng', 'Diễn giải', 'Tổng tiền hàng', 'Tiền chiết khấu', 'Tiền thuế GTGT', 'Tổng tiền thanh toán', 'Đã lập hóa đơn', 'Đã xuất hàng', 'Loại chứng từ'],
    dateColumns: ['Ngày hạch toán', 'Ngày chứng từ'],
    headerRowIndex: 1,
    onImport: toolApi.importSales,
  },
  customers: {
    title: 'Import Khách hàng',
    expectedHeaders: ['Mã khách hàng', 'Tên khách hàng', 'Địa chỉ', 'Nhóm KH, NCC', 'Mã số thuế', 'Điện thoại', 'Ngừng theo dõi'],
    dateColumns: [],
    headerRowIndex: 1,
    onImport: toolApi.importCustomers,
  },
};

const DATA_VIEW_CONFIG = {
  tracking: {
    title: 'Theo dõi Invoice',
    columns: ['Date', 'Invoice', 'Customer', 'Value', 'F.Inv', 'COD'],
    fetchFn: toolApi.listTracking, updateFn: toolApi.updateTracking, deleteFn: toolApi.deleteTracking,
    clearFn: toolApi.clearTracking,
    importConfig: IMPORT_CONFIGS.tracking,
  },
  sales: {
    title: 'Bán hàng',
    columns: ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Số hóa đơn', 'Khách hàng',
      'Diễn giải', 'Tổng tiền hàng', 'Tiền chiết khấu', 'Tiền thuế GTGT',
      'Tổng tiền thanh toán', 'Đã lập hóa đơn', 'Đã xuất hàng', 'Loại chứng từ'],
    fetchFn: toolApi.listSales, updateFn: toolApi.updateSales, deleteFn: toolApi.deleteSales,
    clearFn: toolApi.clearSales,
    importConfig: IMPORT_CONFIGS.sales,
  },
  customers: {
    title: 'Khách hàng',
    columns: ['Mã khách hàng', 'Tên khách hàng', 'Địa chỉ', 'Nhóm KH, NCC', 'Mã số thuế', 'Điện thoại', 'Ngừng theo dõi'],
    fetchFn: toolApi.listCustomers, updateFn: toolApi.updateCustomer, deleteFn: toolApi.deleteCustomer,
    clearFn: toolApi.clearCustomers,
    importConfig: IMPORT_CONFIGS.customers,
  },
  invoiceDetails: {
    title: 'Phiếu đặt hàng đã nhập',
    columns: ['STT', 'Mã đơn', 'Tiền đơn (tracking)', 'Tổng nhóm', 'Đã nhập', 'Ngày', 'Khách hàng', 'F.INV', 'Ghi chú lỗi'],
    fetchFn: toolApi.listInvoiceDetails, updateFn: null, deleteFn: toolApi.deleteInvoiceDetail,
    clearFn: toolApi.clearInvoiceAndReceipts,
  },
};

// ── INVOICE DETAILS MODAL ──────────────────────────────────────────────────
function InvoiceDetailsModal({ onClose, onDataChanged }) {
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAdded = () => {
    setRefreshKey(k => k + 1);
    onDataChanged?.();
  };

  const config = DATA_VIEW_CONFIG.invoiceDetails;

  return (
    <>
      <DataViewModal
        key={refreshKey}
        {...config}
        onClose={onClose}
        extraHeaderButton={
          <button onClick={() => setShowBatchAdd(true)}
            className="px-2.5 py-1 rounded-lg bg-gold/10 text-gold text-[10px] font-semibold hover:bg-gold/20 flex items-center gap-1">
            <Plus size={11} />Nhập chi tiết invoice
          </button>
        }
      />
      {showBatchAdd && (
        <BatchAddInvoiceModal
          onClose={() => setShowBatchAdd(false)}
          onAdded={handleAdded}
        />
      )}
    </>
  );
}

// ── TOOLS NAV WRAPPER ──────────────────────────────────────────────────────
export default function ToolsPageWrapper() {
  const [tab, setTab] = useState('receipt');
  const navigate = useNavigate();

  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch { }
  const role = user?.role ?? 'seller';
  const ROLE_PATHS = {
    OWNER: '/owner/dashboard', ADMIN: '/admin/dashboard', SUPERADMIN: '/admin/dashboard',
    SELLER: '/seller/dashboard', SUPER_SELLER: '/seller/dashboard',
    ACCOUNTANT: '/accountant/dashboard', SUPER_ACCOUNTANT: '/super-accountant/dashboard',
    WAREHOUSE: '/warehouse/dashboard', SUPER_WAREHOUSE: '/warehouse/dashboard',
  };
  const backPath = ROLE_PATHS[role] || '/seller/dashboard';

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-4 border-b border-line-soft bg-surface">
        <button onClick={() => navigate(backPath)}
          className="flex items-center gap-1 text-sm text-muted hover:text-ink font-medium">
          <ChevronLeft size={16} /> Dashboard
        </button>
        <div className="flex gap-1 bg-canvas rounded-xl p-1 border border-line-soft">
          {[{ key: 'receipt', label: 'Phiếu thu', icon: FileSpreadsheet },
          { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart },
          { key: 'misa', label: 'Misa', icon: Database }].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap
                  ${tab === t.key ? 'bg-gold text-white shadow-sm' : 'text-muted hover:text-ink hover:bg-surface'}`}>
                <Icon size={15} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div key={tab} className="animate-fadeIn">
          {tab === 'receipt' && <ToolsReceiptPage />}
          {tab === 'orders' && <ToolsOrdersPage />}
          {tab === 'misa' && <MisaCatalogTab />}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}

// ── MISA EXPORT HEADERS ────────────────────────────────────────────────────
const MISA_HEADERS = [
  'Hiển thị trên sổ', 'Hình thức bán hàng', 'Phương thức thanh toán', 'Kiêm phiếu xuất kho',
  'XK vào khu phi thuế quan và các TH được coi như XK', 'Lập kèm hóa đơn', 'Đã lập hóa đơn',
  'Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Số phiếu xuất', 'Lý do xuất',
  'Mẫu số HĐ', 'Ký hiệu HĐ', 'Số hóa đơn', 'Ngày hóa đơn',
  'Mã khách hàng', 'Tên khách hàng', 'Địa chỉ', 'Mã số thuế', 'Diễn giải',
  'Nộp vào TK', 'NV bán hàng', 'Loại tiền', 'Tỷ giá',
  'Mã hàng', 'Tên hàng', 'Hàng khuyến mại',
  'TK Tiền/Chi phí/Nợ', 'TK Doanh thu/Có', 'ĐVT', 'Số lượng', 'Đơn giá sau thuế', 'Đơn giá',
  'Thành tiền', 'Thành tiền quy đổi',
  'Tỷ lệ CK (%)', 'Tiền chiết khấu', 'Tiền chiết khấu quy đổi', 'TK chiết khấu',
  'Giá tính thuế XK', '% thuế XK', 'Tiền thuế XK', 'TK thuế XK',
  '% thuế GTGT', 'Tỷ lệ tính thuế (Thuế suất KHAC)', 'Tiền thuế GTGT', 'Tiền thuế GTGT quy đổi',
  'TK thuế GTGT', 'HH không TH trên tờ khai thuế GTGT',
  'Kho', 'TK giá vốn', 'TK Kho', 'Đơn giá vốn', 'Tiền vốn', 'Hàng hóa giữ hộ/bán hộ',
];

function misaRowToArray(row) {
  return [
    '', '', '', '', '', '', '',
    row.ngayHachToan || '', row.ngayChungTu || '', row.soChungTu || '',
    '', '', '', '', '', '',
    row.maKhachHang || '', row.tenKhachHang || '', row.diaChi || '', row.maSoThue || '',
    row.dienGiai || '', '', '', '', '',
    row.maHang || '', row.tenHang || '', '',
    row.tkTienNo || '131', row.tkDoanhThuCo || '5111',
    row.dvt || 'Kg', row.soLuong ?? '', '', row.donGia ?? '',
    row.thanhTien ?? '', '',
    // Vị trí AK-AN (Chiết khấu) & AW (TK thuế GTGT): mặc định cứng theo yêu cầu nghiệp vụ MISA
    //   AK "Tỷ lệ CK (%)" = 0 · AN "TK chiết khấu" = 5211 · AW "TK thuế GTGT" = 33311
    // Cùng convention với misaRowToArray bên MisaCatalogTab.jsx.
    0, '', '', '5211',
    '', '', '', '',
    '', '', '', '',
    '33311', '',
    '', '', '', '', '',
  ];
}

// ── ToolsOrdersPage ────────────────────────────────────────────────────────
function ToolsOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selected, setSelected] = useState(new Set());

  const [misaData, setMisaData] = useState(null);
  const [generating, setGenerating] = useState(false);

  const fetchOrders = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: 50 };
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (statusFilter) params.status = statusFilter;
      const res = await toolApi.listMisaOrders(params);
      const content = res.content || [];
      if (p === 0) setOrders(content);
      else setOrders(prev => [...prev, ...content]);
      setTotal(res.total || 0);
      setHasMore(res.hasMore || false);
      setPage(p);
    } catch (e) { toast('Lỗi tải đơn hàng: ' + (e?.response?.data?.message || e.message), 'error'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => { fetchOrders(0); }, [fetchOrders]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map(o => o.id)));
  };

  const handleGenerate = async () => {
    if (selected.size === 0) { toast('Chọn ít nhất 1 đơn', 'warning'); return; }
    setGenerating(true);
    try {
      const data = await toolApi.generateMisaData([...selected]);
      let counter = 1;
      data.forEach(row => { row.soChungTu = String(counter).padStart(7, '0'); counter++; });
      setMisaData(data);
    } catch (e) { toast('Lỗi tạo data: ' + (e?.response?.data?.message || e.message), 'error'); }
    finally { setGenerating(false); }
  };

  if (misaData) {
    return <MisaDataPreview data={misaData} onBack={() => setMisaData(null)} />;
  }

  const filteredOrders = customerFilter
    ? orders.filter(o => (o.customerName || '').toLowerCase().includes(customerFilter.toLowerCase()))
    : orders;

  const STATUS_OPTIONS = [
    { value: '', label: 'Tất cả' },
    { value: 'PENDING', label: 'Chờ xử lý' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'PREPARING', label: 'Đang chuẩn bị' },
    { value: 'READY', label: 'Sẵn sàng' },
    { value: 'DELIVERING', label: 'Đang giao' },
    { value: 'DELIVERED', label: 'Đã giao' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={22} className="text-gold" />
          <div>
            <h1 className="text-lg font-bold text-ink">Đơn hàng → MISA Export</h1>
            <p className="text-xs text-muted">Chọn đơn hàng, tạo data và export Excel theo layout MISA</p>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={selected.size === 0 || generating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong shadow-sm disabled:opacity-50">
          {generating ? 'Đang tạo...' : `Tạo data (${selected.size})`}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }}
          placeholder="Chọn khoảng ngày"
        />
        <div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 h-[38px]">
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}
            placeholder="Tìm khách hàng..."
            className="pl-8 pr-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 w-52 h-[38px]" />
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-line-soft overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-canvas">
              <th className="px-3 py-2.5 text-left w-10">
                <input type="checkbox" checked={selected.size > 0 && selected.size === filteredOrders.length}
                  onChange={toggleAll} className="accent-gold" />
              </th>
              <th className="px-3 py-2.5 text-left text-muted font-semibold">Mã đơn</th>
              <th className="px-3 py-2.5 text-left text-muted font-semibold">Khách hàng</th>
              <th className="px-3 py-2.5 text-left text-muted font-semibold">Trạng thái</th>
              <th className="px-3 py-2.5 text-right text-muted font-semibold">Tổng tiền</th>
              <th className="px-3 py-2.5 text-left text-muted font-semibold">Ngày tạo</th>
              <th className="px-3 py-2.5 text-center text-muted font-semibold">SP</th>
            </tr>
          </thead>
          <tbody>
            {loading && orders.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted">Đang tải...</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted">Không có đơn hàng</td></tr>
            ) : filteredOrders.map((o, idx) => {
              const isSelected = selected.has(o.id);
              const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : '';
              return (
                <tr key={o.id} onClick={() => toggleSelect(o.id)}
                  className={`border-t border-line-soft cursor-pointer transition-colors ${isSelected ? 'bg-gold/10' : idx % 2 === 0 ? 'bg-surface' : 'bg-canvas/50'} hover:bg-gold/5`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={isSelected} onChange={() => { }} className="accent-gold" />
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-ink">{o.orderCode}</td>
                  <td className="px-3 py-2 text-ink">{o.customerName || 'Khách vãng lai'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                      ${o.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : o.status === 'CANCELLED' ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300'
                          : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(o.finalAmount)}</td>
                  <td className="px-3 py-2 text-muted">{dateStr}</td>
                  <td className="px-3 py-2 text-center text-muted">{o.itemCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button onClick={() => fetchOrders(page + 1)} disabled={loading}
          className="w-full py-2 text-center text-xs text-gold font-semibold hover:underline disabled:opacity-50">
          {loading ? 'Đang tải...' : 'Tải thêm'}
        </button>
      )}
      <p className="text-[10px] text-muted text-center">Hiển thị {filteredOrders.length} / {total} đơn hàng · Đã chọn {selected.size}</p>
    </div>
  );
}

// ── MISA Data Preview Page ─────────────────────────────────────────────────
function MisaDataPreview({ data: initialData, onBack }) {
  const toast = useToast();
  const [rows, setRows] = useState(initialData);

  const updateSoChungTu = useCallback((idx, value) => {
    setRows(prev => {
      const next = [...prev];
      const prefix = value.replace(/\d+$/, '');
      const numPart = value.substring(prefix.length);
      const numLen = numPart.length || 7;
      let startNum = parseInt(numPart, 10);
      if (isNaN(startNum)) startNum = 1;

      for (let i = idx; i < next.length; i++) {
        next[i] = { ...next[i], soChungTu: prefix + String(startNum).padStart(numLen, '0') };
        startNum++;
      }
      return next;
    });
  }, []);

  const handleExport = () => {
    if (!rows?.length) { toast('Chưa có dữ liệu', 'error'); return; }
    const wb = XLSX.utils.book_new();
    const sheetRows = [MISA_HEADERS, ...rows.map(misaRowToArray)];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = MISA_HEADERS.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, 'BanHang');
    XLSX.writeFile(wb, `MISA_BanHang_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Đã export file Excel', 'success');
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted hover:text-ink font-medium">
            <ChevronLeft className="cursor-pointer hover:text-ink" size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-ink">Xem trước data MISA</h1>
            <p className="text-xs text-muted">{rows.length} dòng · Click vào ô "Số chứng từ" để chỉnh sửa (tự tăng từ dòng đó)</p>
          </div>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm">
          <Download size={14} /> Export XLSX
        </button>
      </div>

      <div className="bg-surface rounded-xl border border-line-soft overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-canvas">
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold w-10 sticky left-0 bg-canvas z-10">#</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap">Mã đơn</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap">Ngày HT</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap">Ngày CT</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap bg-gold/10">Số chứng từ</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap" style={{ minWidth: 140 }}>Khách hàng</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap" style={{ minWidth: 180 }}>Diễn giải</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap" style={{ minWidth: 140 }}>Mã hàng</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap" style={{ minWidth: 160 }}>Tên hàng</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap">TK Nợ</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap">TK Có</th>
              <th className="px-3 py-2.5 text-left text-[10px] text-muted font-bold whitespace-nowrap">ĐVT</th>
              <th className="px-3 py-2.5 text-right text-[10px] text-muted font-bold whitespace-nowrap">Số lượng</th>
              <th className="px-3 py-2.5 text-right text-[10px] text-muted font-bold whitespace-nowrap">Đơn giá</th>
              <th className="px-3 py-2.5 text-right text-[10px] text-muted font-bold whitespace-nowrap">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={`border-t border-line-soft ${idx % 2 === 0 ? 'bg-surface' : 'bg-canvas/50'} hover:bg-gold/5`}>
                <td className="px-3 py-2 text-muted font-mono sticky left-0 bg-inherit">{idx + 1}</td>
                <td className="px-3 py-2 font-mono text-ink whitespace-nowrap">{row.orderCode}</td>
                <td className="px-3 py-2 text-muted whitespace-nowrap">{row.ngayHachToan}</td>
                <td className="px-3 py-2 text-muted whitespace-nowrap">{row.ngayChungTu}</td>
                <td className="px-3 py-2 bg-gold/5">
                  <MisaSoChungTuEditor value={row.soChungTu} idx={idx} onUpdate={updateSoChungTu} />
                </td>
                <td className="px-3 py-2 text-ink truncate" style={{ maxWidth: 200 }} title={row.tenKhachHang}>{row.tenKhachHang}</td>
                <td className="px-3 py-2 text-muted truncate" style={{ maxWidth: 240 }} title={row.dienGiai}>{row.dienGiai}</td>
                <td className="px-3 py-2 font-mono">{row.maHang}</td>
                <td className="px-3 py-2">{row.tenHang}</td>
                <td className="px-3 py-2 font-mono text-center">{row.tkTienNo}</td>
                <td className="px-3 py-2 font-mono text-center">{row.tkDoanhThuCo}</td>
                <td className="px-3 py-2 text-center">{row.dvt}</td>
                <td className="px-3 py-2 text-right font-mono">{Number(row.soLuong).toFixed(3)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtMoney(row.donGia)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmtMoney(row.thanhTien)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Inline editable Số chứng từ for MISA preview ──────────────────────────
function MisaSoChungTuEditor({ value, idx, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const save = () => {
    if (val.trim() && val.trim() !== value) {
      onUpdate(idx, val.trim());
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <span className="cursor-pointer group flex items-center gap-1" onClick={() => setEditing(true)}>
        <span className="font-mono text-ink">{value}</span>
        <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition" />
      </span>
    );
  }
  return (
    <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
      className="w-28 px-1.5 py-0.5 rounded border border-gold text-xs font-mono bg-canvas focus:outline-none" />
  );
}

// ── Phiếu thu page (đã đơn giản hóa, giống File 2) ────────────────────────
function ToolsReceiptPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewModal, setViewModal] = useState(null);
  const [doneRow, setDoneRow] = useState('');

  const load = useCallback(async () => {
    try { const d = await toolApi.getData(); setData(d); setDoneRow(d.doneUpToRow || ''); }
    catch { toast('Không thể tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSetDone = async (val) => { setDoneRow(val); try { await toolApi.setConfig('done_up_to_row', val); } catch { } };

  const handleExport = () => {
    if (!data?.receipts?.length) { toast('Chưa có dữ liệu', 'error'); return; }
    const wb = XLSX.utils.book_new();
    const rows = [RECEIPT_HEADERS, ...data.receipts.map(receiptToRow)];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = RECEIPT_HEADERS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Mẫu import phiếu thu');
    XLSX.writeFile(wb, 'Mau_import_phieu_thu.xlsx');
  };

  const doneRowNum = parseInt(doneRow) || 0;
  const receipts = data?.receipts || [];

  return (
    <div className="p-4 sm:p-6 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={22} className="text-gold" />
          <div>
            <h1 className="text-lg font-bold text-ink">Công cụ tạo Phiếu thu</h1>
            <p className="text-xs text-muted">{data ? `${receipts.length} phiếu | Theo dõi: ${data.trackingCount} | Bán hàng: ${data.salesCount} | KH: ${data.customerCount}` : 'Đang tải...'}</p>
          </div>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 shadow-sm">
          <Download size={14} /> Export XLSX
        </button>
      </div>

      {/* Các nút chức năng — đã bỏ "Đổi số chứng từ", "Nhập chi tiết invoice", và các nút Import riêng */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setViewModal('invoiceDetails')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line-soft text-sm font-semibold text-ink hover:bg-canvas shadow-sm"><FileText size={14} className="text-indigo-500" />Xem phiếu ĐH đã nhập</button>
        <button onClick={() => setViewModal('tracking')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line-soft text-sm font-semibold text-ink hover:bg-canvas shadow-sm"><FileText size={14} className="text-purple-500" />Theo dõi Invoice</button>
        <button onClick={() => setViewModal('sales')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line-soft text-sm font-semibold text-ink hover:bg-canvas shadow-sm"><ShoppingCart size={14} className="text-amber-500" />Bán hàng</button>
        <button onClick={() => setViewModal('customers')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line-soft text-sm font-semibold text-ink hover:bg-canvas shadow-sm"><Users size={14} className="text-teal-500" />Khách hàng</button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Đã làm đến dòng:</span>
        <input type="number" value={doneRow} onChange={e => handleSetDone(e.target.value)} placeholder="0"
          className="w-20 px-2 py-1 rounded-lg border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono text-center" />
        <span className="text-xs text-muted">/ {receipts.length}</span>
      </div>

      <div className="bg-surface rounded-xl border border-line-soft overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="bg-canvas">
            <th className="px-2 py-2 text-left text-muted font-semibold w-8">#</th>
            {RECEIPT_HEADERS.map((h, i) => <th key={i} className="px-2 py-2 text-left text-muted font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={22} className="p-8 text-center text-muted">Đang tải...</td></tr>
              : receipts.length === 0 ? <tr><td colSpan={22} className="p-8 text-center text-muted">Chưa có dữ liệu. Mở "Xem phiếu ĐH đã nhập" → "Nhập chi tiết invoice" để bắt đầu.</td></tr>
                : receipts.map((r, i) => {
                  const row = receiptToRow(r);
                  const isDone = (i + 1) <= doneRowNum;
                  return (
                    <tr key={r.id} className={`border-t border-line-soft ${isDone ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'hover:bg-canvas'}`}>
                      <td className="px-2 py-1.5 text-muted font-mono">{i + 1}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className={`px-2 py-1.5 whitespace-nowrap ${ci === 17 ? 'font-mono font-semibold text-right' : ''}`}>
                          {ci === 3
                            ? <EditableSoChungTu value={cell} receiptId={r.id} onSaved={load} />
                            : ci === 17 ? fmtMoney(cell) : cell}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Modal "Phiếu đặt hàng đã nhập" — có nút "Nhập chi tiết invoice" */}
      {viewModal === 'invoiceDetails' && (
        <InvoiceDetailsViewModal
          onClose={() => { setViewModal(null); load(); }}
          onDataChanged={load}
        />
      )}

      {/* Modal Theo dõi Invoice / Bán hàng / Khách hàng — có nút Import bên trong */}
      {viewModal && viewModal !== 'invoiceDetails' && DATA_VIEW_CONFIG[viewModal] && (
        <DataViewModal {...DATA_VIEW_CONFIG[viewModal]} onClose={() => { setViewModal(null); load(); }} />
      )}
    </div>
  );
}