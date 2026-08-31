// src/pages/tools/ToolsPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, Plus, Hash, Upload, Download, Users, ShoppingCart,
  FileText, X, AlertTriangle, CheckCircle2, Pencil, Search, Trash2, ChevronLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx/xlsx.mjs';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';

const toolApi = {
  getData: () => api.get('/api/tools/data').then(r => r.data?.data || r.data),
  addInvoice: (d) => api.post('/api/tools/invoice-detail', d).then(r => r.data?.data || r.data),
  checkDuplicate: (orderNumber) => api.get('/api/tools/invoice-detail/exists', { params: { orderNumber } }).then(r => r.data?.data),
  renumber: (d) => api.post('/api/tools/renumber', d),
  updateSoChungTu: (id, soChungTu) => api.post(`/api/tools/receipt/${id}/so-chung-tu`, { soChungTu }),
  importTracking: (rows) => api.post('/api/tools/import/tracking', rows).then(r => r.data?.data || r.data),
  importSales: (rows) => api.post('/api/tools/import/sales', rows).then(r => r.data?.data || r.data),
  importCustomers: (rows) => api.post('/api/tools/import/customers', rows).then(r => r.data?.data || r.data),
  setConfig: (key, value) => api.post('/api/tools/config', { key, value }),
  // CRUD with pagination
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
  // Clear all
  clearTracking: () => api.delete('/api/tools/clear/tracking'),
  clearSales: () => api.delete('/api/tools/clear/sales'),
  clearCustomers: () => api.delete('/api/tools/clear/customers'),
  clearInvoiceDetails: () => api.delete('/api/tools/clear/invoice-details'),
  clearReceipts: () => api.delete('/api/tools/clear/receipts'),
};

/** Excel serial date → dd/MM/yyyy (Excel epoch = 30/12/1899) */
function excelDateToStr(v) {
  if (typeof v === 'number' && v > 30000 && v < 100000) {
    const d = new Date((v - 25569) * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  return String(v ?? '');
}

/** Normalize cell: nếu là số serial date → convert, nếu ko → string */
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
    r.maDoiTuong, r.tenDoiTuong, r.diaChi || '', '', r.dienGiaiLyDoNop || '',
    '', '', '', r.loaiTien || 'VND', '', r.dienGiai || '',
    r.tkNo || '1111', r.tkCo || '131', r.soTien || '', '', r.doiTuong || '', '',
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
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

// ── RENUMBER MODAL ─────────────────────────────────────────────────────────
function RenumberModal({ onSubmit, onClose }) {
  const [oldDoc, setOldDoc] = useState('');
  const [newDoc, setNewDoc] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-line-soft">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Hash size={15} className="text-gold" />Đổi số chứng từ</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs text-muted mb-1 block">Số chứng từ cũ</label>
            <input value={oldDoc} onChange={e => setOldDoc(e.target.value)} placeholder="PT00002353" className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono" /></div>
          <div><label className="text-xs text-muted mb-1 block">Số chứng từ mới</label>
            <input value={newDoc} onChange={e => setNewDoc(e.target.value)} placeholder="PT00003000" className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono" /></div>
        </div>
        <div className="p-5 border-t border-line-soft flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted">Huỷ</button>
          <button onClick={() => { onSubmit(oldDoc.trim(), newDoc.trim()); onClose(); }} disabled={!oldDoc.trim() || !newDoc.trim()}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold disabled:opacity-50">Áp dụng</button>
        </div>
      </div>
    </div>
  );
}

// ── ADD INVOICE MODAL (with duplicate warning) ─────────────────────────────
function AddInvoiceModal({ onClose, onAdded }) {
  const toast = useToast();
  const [order, setOrder] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [dupWarning, setDupWarning] = useState(null); // { orderNumber, amount, date }
  const orderRef = useRef();

  const doAdd = async (orderNumber, amountStr, dateStr) => {
    setLoading(true);
    try {
      const rawAmount = amountStr.replace(/\D/g, '');
      const res = await toolApi.addInvoice({ orderNumber, amount: Number(rawAmount), invoiceDate: dateStr });
      setResults(prev => [res, ...prev]);
      setOrder(''); setAmount(''); setDate('');
      onAdded?.();
      orderRef.current?.focus();
    } catch (e) { toast('Lỗi: ' + (e?.response?.data?.message || e.message), 'error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!order.trim() || !amount.trim() || !date.trim()) { toast('Nhập đủ 3 trường', 'error'); return; }
    // Check duplicate
    try {
      const exists = await toolApi.checkDuplicate(order.trim());
      if (exists) {
        setDupWarning({ orderNumber: order.trim(), amount, date: date.trim() });
        return;
      }
    } catch {}
    doAdd(order.trim(), amount, date.trim());
  };

  const fmtInput = (v) => { const d = v.replace(/\D/g, ''); return d ? new Intl.NumberFormat('vi-VN').format(Number(d)) : ''; };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-line-soft shrink-0">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2"><Plus size={15} className="text-gold" />Nhập Chi tiết invoice</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-muted mb-1 block">Số phiếu đặt hàng</label>
              <input ref={orderRef} value={order} onChange={e => setOrder(e.target.value)} placeholder="20094"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono"
                onKeyDown={e => e.key === 'Enter' && handleAdd()} /></div>
            <div><label className="text-xs text-muted mb-1 block">Số tiền</label>
              <input value={amount} onChange={e => setAmount(fmtInput(e.target.value))} placeholder="1,370,304"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40"
                onKeyDown={e => e.key === 'Enter' && handleAdd()} /></div>
            <div><label className="text-xs text-muted mb-1 block">Ngày (d/m/yy)</label>
              <input value={date} onChange={e => setDate(e.target.value)} placeholder="3/5/26"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-gold/40"
                onKeyDown={e => e.key === 'Enter' && handleAdd()} /></div>
          </div>
          <button onClick={handleAdd} disabled={loading}
            className="w-full py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-50">
            {loading ? 'Đang xử lý...' : 'Thêm & Lookup'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pt-0 space-y-1">
          <p className="text-xs text-muted font-semibold mb-1">Kết quả ({results.length})</p>
          {results.map((r, i) => (
            <div key={i} className={`rounded-lg p-2 text-xs border ${r.errorNote ? 'border-amber-200 dark:border-amber-500/28 bg-amber-50 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/28 bg-emerald-50 dark:bg-emerald-500/10'}`}>
              <span className="font-mono font-semibold">{r.orderNumber}</span>
              <span className="ml-2">{fmtMoney(r.amount)} đ</span>
              <span className="ml-2 text-muted">{r.invoiceDate}</span>
              {r.errorNote && <p className="mt-0.5 text-amber-700 dark:text-amber-300 flex items-center gap-1"><AlertTriangle size={11} />{r.errorNote}</p>}
              {!r.errorNote && <span className="ml-2 text-emerald-600">✓ Tạo phiếu thu OK</span>}
            </div>
          ))}
        </div>

        {/* Duplicate warning */}
        {dupWarning && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-2xl">
            <div className="bg-surface rounded-xl shadow-lg p-5 max-w-sm mx-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-600"><AlertTriangle size={18} /><span className="text-sm font-bold">Số phiếu trùng!</span></div>
              <p className="text-xs text-ink">Số phiếu <span className="font-mono font-bold">{dupWarning.orderNumber}</span> đã được nhập trước đó. Bạn vẫn muốn nhập lại?</p>
              <div className="flex gap-2">
                <button onClick={() => setDupWarning(null)} className="flex-1 py-2 rounded-lg border border-line-soft text-sm text-muted">Huỷ</button>
                <button onClick={() => { const d = dupWarning; setDupWarning(null); doAdd(d.orderNumber, d.amount, d.date); }}
                  className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold">Vẫn nhập</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── INLINE EDITABLE CELL ───────────────────────────────────────────────────
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

// ── DATA VIEW MODAL (search / edit / delete / infinite scroll) ─────────────
const PAGE_SIZE = 500;
const SCROLL_THRESHOLD = 0.7;

function DataViewModal({ title, columns, fetchFn, updateFn, deleteFn, clearFn, onClose }) {
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
  const searchTimeout = useRef();
  const scrollRef = useRef();
  const searchRef = useRef('');

  const fetchPage = useCallback(async (q, p, append) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetchFn(q || '', p, PAGE_SIZE);
      const content = res.content || [];
      if (append) {
        setRows(prev => [...prev, ...content]);
      } else {
        setRows(content);
      }
      setTotal(res.total || 0);
      setHasMore(res.hasMore || false);
      setPage(p);
    } catch { toast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [fetchFn]);

  // Initial load
  useEffect(() => { fetchPage('', 0, false); }, [fetchPage]);

  // Debounced search
  const handleSearch = (v) => {
    setSearch(v);
    searchRef.current = v;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchPage(v, 0, false);
    }, 600);
  };

  // Infinite scroll — trigger at 70%
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loadingMore || !hasMore) return;
    const el = scrollRef.current;
    const scrolled = el.scrollTop + el.clientHeight;
    const threshold = el.scrollHeight * SCROLL_THRESHOLD;
    if (scrolled >= threshold) {
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
      // Update row in place
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line-soft shrink-0">
          <h3 className="text-sm font-bold text-ink">{title} <span className="text-muted font-normal">({total} dòng{rows.length < total ? `, đang hiện ${rows.length}` : ''})</span></h3>
          <div className="flex items-center gap-2">
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
        {/* Table with scroll */}
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
        {/* Footer */}
        <div className="px-5 py-2 border-t border-line-soft shrink-0 flex items-center justify-between bg-canvas rounded-b-2xl">
          <span className="text-[10px] text-muted">Hiển thị {rows.length} / {total.toLocaleString('vi-VN')}</span>
          {hasMore && <span className="text-[10px] text-gold">↓ Cuộn để tải thêm</span>}
        </div>
      </div>
    </div>
  );
}

const DATA_VIEW_CONFIG = {
  tracking: {
    title: 'Theo dõi Invoice',
    columns: ['Date', 'Invoice', 'Customer', 'Value', 'F.Inv', 'COD'],
    fetchFn: toolApi.listTracking, updateFn: toolApi.updateTracking, deleteFn: toolApi.deleteTracking,
    clearFn: toolApi.clearTracking,
  },
  sales: {
    title: 'Bán hàng',
    columns: ['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Số hóa đơn', 'Khách hàng', 'Diễn giải', 'Tổng tiền hàng', 'Tiền chiết khấu', 'Tiền thuế GTGT', 'Tổng tiền thanh toán', 'Đã lập hóa đơn', 'Đã xuất hàng', 'Loại chứng từ'],
    fetchFn: toolApi.listSales, updateFn: toolApi.updateSales, deleteFn: toolApi.deleteSales,
    clearFn: toolApi.clearSales,
  },
  customers: {
    title: 'Khách hàng',
    columns: ['Mã khách hàng', 'Tên khách hàng', 'Địa chỉ', 'Nhóm KH, NCC', 'Mã số thuế', 'Điện thoại', 'Ngừng theo dõi'],
    fetchFn: toolApi.listCustomers, updateFn: toolApi.updateCustomer, deleteFn: toolApi.deleteCustomer,
    clearFn: toolApi.clearCustomers,
  },
  invoiceDetails: {
    title: 'Phiếu đặt hàng đã nhập',
    columns: ['STT', 'Số phiếu ĐH', 'Số tiền', 'Ngày', 'Ghi chú lỗi'],
    fetchFn: toolApi.listInvoiceDetails, updateFn: null, deleteFn: toolApi.deleteInvoiceDetail,
    clearFn: toolApi.clearInvoiceDetails,
  },
};

// ── TOOLS NAV WRAPPER ──────────────────────────────────────────────────────
export default function ToolsPageWrapper() {
  const [tab, setTab] = useState('receipt');
  const navigate = useNavigate();

  // Detect role → back to correct dashboard
  let user = null;
  try { user = JSON.parse(localStorage.getItem('user')); } catch {}
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
      {/* Nav bar */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-4 border-b border-line-soft bg-surface">
        <button onClick={() => navigate(backPath)}
          className="flex items-center gap-1 text-sm text-muted hover:text-ink font-medium">
          <ChevronLeft size={16} /> Dashboard
        </button>
        <div className="flex gap-1 bg-canvas rounded-xl p-1 border border-line-soft">
          {[{ key: 'receipt', label: 'Phiếu thu', icon: FileSpreadsheet },
            { key: 'orders', label: 'Đơn hàng', icon: ShoppingCart }].map(t => {
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

      {/* Content with fade transition */}
      <div className="flex-1 min-h-0 relative">
        <div key={tab} className="animate-fadeIn">
          {tab === 'receipt' && <ToolsReceiptPage />}
          {tab === 'orders' && (
            <div className="flex items-center justify-center h-full p-12">
              <div className="text-center space-y-3">
                <ShoppingCart size={48} className="mx-auto text-muted/30" />
                <p className="text-lg font-semibold text-muted">Xử lý Đơn hàng</p>
                <p className="text-sm text-muted">Tính năng đang được phát triển...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fadeIn { animation: fadeIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}

// ── Phiếu thu page (was the old default export) ───────────────────────────
function ToolsReceiptPage() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRenumber, setShowRenumber] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [importModal, setImportModal] = useState(null);
  const [viewModal, setViewModal] = useState(null); // 'tracking' | 'sales' | 'customers'
  const [doneRow, setDoneRow] = useState('');

  const load = useCallback(async () => {
    try { const d = await toolApi.getData(); setData(d); setDoneRow(d.doneUpToRow || ''); }
    catch { toast('Không thể tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRenumber = async (oldDoc, newDoc) => {
    try { await toolApi.renumber({ oldPrefix: oldDoc, newPrefix: newDoc }); toast('Đã đổi số chứng từ', 'success'); load(); }
    catch (e) { toast('Lỗi: ' + (e?.response?.data?.message || e.message), 'error'); }
  };

  const handleSetDone = async (val) => { setDoneRow(val); try { await toolApi.setConfig('done_up_to_row', val); } catch {} };

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

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowRenumber(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line-soft text-sm font-semibold text-ink hover:bg-canvas shadow-sm"><Hash size={14} className="text-blue-500" />Đổi số chứng từ</button>
        <button onClick={() => setShowAddInvoice(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong shadow-sm"><Plus size={14} />Nhập Chi tiết invoice</button>
        <button onClick={() => setViewModal('invoiceDetails')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line-soft text-sm font-semibold text-ink hover:bg-canvas shadow-sm"><FileText size={14} className="text-indigo-500" />Xem phiếu ĐH đã nhập</button>
        <div className="flex rounded-xl overflow-hidden border border-line-soft shadow-sm">
          <button onClick={() => setImportModal('tracking')} className="flex items-center gap-1.5 px-3 py-2 bg-surface text-sm font-semibold text-ink hover:bg-canvas"><Upload size={12} className="text-purple-500" />Import</button>
          <button onClick={() => setViewModal('tracking')} className="flex items-center gap-1.5 px-3 py-2 bg-surface text-sm font-semibold text-ink hover:bg-canvas border-l border-line-soft"><FileText size={12} className="text-purple-500" />Theo dõi Invoice</button>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-line-soft shadow-sm">
          <button onClick={() => setImportModal('sales')} className="flex items-center gap-1.5 px-3 py-2 bg-surface text-sm font-semibold text-ink hover:bg-canvas"><Upload size={12} className="text-amber-500" />Import</button>
          <button onClick={() => setViewModal('sales')} className="flex items-center gap-1.5 px-3 py-2 bg-surface text-sm font-semibold text-ink hover:bg-canvas border-l border-line-soft"><ShoppingCart size={12} className="text-amber-500" />Bán hàng</button>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-line-soft shadow-sm">
          <button onClick={() => setImportModal('customers')} className="flex items-center gap-1.5 px-3 py-2 bg-surface text-sm font-semibold text-ink hover:bg-canvas"><Upload size={12} className="text-teal-500" />Import</button>
          <button onClick={() => setViewModal('customers')} className="flex items-center gap-1.5 px-3 py-2 bg-surface text-sm font-semibold text-ink hover:bg-canvas border-l border-line-soft"><Users size={12} className="text-teal-500" />Khách hàng</button>
        </div>
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
            : receipts.length === 0 ? <tr><td colSpan={22} className="p-8 text-center text-muted">Chưa có dữ liệu. Nhập Chi tiết invoice để bắt đầu.</td></tr>
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

      {showRenumber && <RenumberModal onSubmit={handleRenumber} onClose={() => setShowRenumber(false)} />}
      {showAddInvoice && <AddInvoiceModal onClose={() => setShowAddInvoice(false)} onAdded={load} />}
      {importModal === 'tracking' && <ImportModal title="Import Theo dõi Invoice" expectedHeaders={['Date','Invoice','Customer','Value','F.Inv','COD']} dateColumns={['Date']} onImport={toolApi.importTracking} onClose={() => { setImportModal(null); load(); }} />}
      {importModal === 'sales' && <ImportModal title="Import Bán hàng" expectedHeaders={['Ngày hạch toán','Ngày chứng từ','Số chứng từ','Số hóa đơn','Khách hàng','Diễn giải','Tổng tiền hàng','Tiền chiết khấu','Tiền thuế GTGT','Tổng tiền thanh toán','Đã lập hóa đơn','Đã xuất hàng','Loại chứng từ']} dateColumns={['Ngày hạch toán','Ngày chứng từ']} headerRowIndex={1} onImport={toolApi.importSales} onClose={() => { setImportModal(null); load(); }} />}
      {importModal === 'customers' && <ImportModal title="Import Khách hàng" expectedHeaders={['Mã khách hàng','Tên khách hàng','Địa chỉ','Nhóm KH, NCC','Mã số thuế','Điện thoại','Ngừng theo dõi']} headerRowIndex={1} onImport={toolApi.importCustomers} onClose={() => { setImportModal(null); load(); }} />}
      {viewModal && DATA_VIEW_CONFIG[viewModal] && (
        <DataViewModal {...DATA_VIEW_CONFIG[viewModal]} onClose={() => { setViewModal(null); load(); }} />
      )}
    </div>
  );
}