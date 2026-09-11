// src/pages/tools/MisaCatalogTab.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Download, Trash2, Search, AlertTriangle, CheckCircle2,
  FileSpreadsheet, Loader2, Edit2, X, Check, ChevronLeft, Package,
  ArrowRight,
} from 'lucide-react';
import * as XLSX from 'xlsx/xlsx.mjs';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';

// ── API ──────────────────────────────────────────────────────────────────────

const misaCatalogApi = {
  list: () => api.get('/api/tools/misa-catalog').then(r => r.data?.data || r.data),
  importCatalog: (rows) => api.post('/api/tools/misa-catalog/import', rows).then(r => r.data?.data || r.data),
  update: (id, b) => api.put(`/api/tools/misa-catalog/${id}`, b).then(r => r.data?.data || r.data),
  deleteOne: (id) => api.delete(`/api/tools/misa-catalog/${id}`),
  deleteAll: () => api.delete('/api/tools/misa-catalog/all'),
  processInvoice: (rows) => api.post('/api/tools/misa-catalog/process-invoice', rows).then(r => r.data?.data || r.data),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(n);
}

// ── MISA Export ──────────────────────────────────────────────────────────────

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

// ── MISA Export ──────────────────────────────────────────────────────────────

function misaRowToArray(row) {
  const soHoaDon = String(row.soHoaDon || '');
  const tenKH = row.tenKhachHang || '';
  const dienGiai = tenKH ? `Bán hàng cho ${tenKH} theo hóa đơn ${soHoaDon}` : '';

  // Lấy giá trị VAT, loại bỏ ký tự % nếu có
  let vatPercent = row.vatPercent || '';
  if (typeof vatPercent === 'string') {
    vatPercent = vatPercent.replace(/%/g, '').trim();
  }

  return [
    '',             // A: Hiển thị trên sổ
    0,              // B: Hình thức bán hàng
    0,              // C: Phương thức thanh toán
    1,              // D: Kiêm phiếu xuất kho
    '',             // E: XK vào khu phi thuế quan
    1,              // F: Lập kèm hóa đơn
    1,              // G: Đã lập hóa đơn
    row.ngayHachToan || '',   // H: Ngày hạch toán
    row.ngayChungTu || '',    // I: Ngày chứng từ
    soHoaDon,                 // J: Số chứng từ
    '',             // K: Số phiếu xuất
    '',             // L: Lý do xuất
    row.mauSoHd || '',        // M: Mẫu số HĐ
    row.kyHieuHd || '',       // N: Ký hiệu HĐ
    soHoaDon,                 // O: Số hóa đơn
    row.ngayHoaDon || '',     // P: Ngày hóa đơn
    row.maKhachHang || '',    // Q: Mã khách hàng
    tenKH,                    // R: Tên khách hàng
    row.diaChi || '',         // S: Địa chỉ
    row.maSoThue || '',       // T: Mã số thuế
    dienGiai,                 // U: Diễn giải
    '', '', '', '',           // V-Y
    row.maHang || '',         // Z: Mã hàng
    row.tenHang || '',        // AA: Tên hàng
    '',                       // AB: Hàng khuyến mại
    row.tkTienNo || '131',    // AC: TK Tiền/Nợ
    row.tkDoanhThuCo || '5111', // AD: TK Doanh thu/Có
    row.dvt || 'Kg',          // AE: ĐVT
    row.soLuong ?? '',        // AF: Số lượng
    '',                       // AG: Đơn giá sau thuế
    row.donGia ?? '',         // AH: Đơn giá
    row.thanhTien ?? '',      // AI: Thành tiền
    '',                       // AJ: Thành tiền quy đổi
    '', '', '', '',           // AK-AN: CK
    '', '', '', '',           // AO-AR: Thuế XK
    vatPercent,               // AS: % thuế GTGT (chỉ lấy số, không có %)
    '',                       // AT: Tỷ lệ tính thuế
    row.tienThue ?? '',       // AU: Tiền thuế GTGT
    '',                       // AV: Tiền thuế GTGT quy đổi
    '', '',                   // AW-AX: TK thuế, HH không TH
    row.kho || '',            // AY: Kho
    row.tkGiaVon || '',       // AZ: TK giá vốn
    row.tkKho || '',          // BA: TK Kho
    '', '', '',               // BB-BD
  ];
}

const handleInvoiceFile = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';

  if (catalog.length === 0) {
    toast('Chưa có danh mục hàng hóa! Import danh mục trước.', 'error');
    return;
  }

  setImportingInvoice(true);
  try {
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const rawRows = [];
    const invoiceRows = [];
    for (let i = 1; i < json.length; i++) {
      const r = json[i];
      const maHang = String(r[16] ?? '').trim();
      if (!maHang) continue;

      // Lấy VAT, loại bỏ % nếu có
      let vatPercent = String(r[27] ?? '').trim();
      vatPercent = vatPercent.replace(/%/g, '').trim();

      const rawRow = {
        sttHoaDon: String(r[0] ?? ''),
        mauSoHd: String(r[3] ?? ''),
        kyHieuHd: String(r[4] ?? ''),
        soHoaDon: String(r[5] ?? ''),
        ngayHoaDon: String(r[6] ?? ''),
        maKhachHang: String(r[7] ?? ''),
        tenKhachHang: String(r[8] ?? ''),
        diaChi: String(r[9] ?? ''),
        maSoThue: String(r[10] ?? ''),
        hinhThucTT: String(r[12] ?? ''),
        maHang,
        tenHang: String(r[17] ?? ''),
        dvt: String(r[20] ?? ''),
        soLuong: Number(r[21]) || 0,
        donGia: Number(r[23]) || 0,
        thanhTien: Number(r[24]) || 0,
        vatPercent,   // Đã loại bỏ %
        tienThue: Number(r[29]) || 0,
      };

      rawRows.push(rawRow);
      invoiceRows.push(rawRow);
    }

    if (invoiceRows.length === 0) {
      toast('File không có dữ liệu hóa đơn hợp lệ', 'error');
      return;
    }

    setRawInvoiceData(rawRows);

    const result = await misaCatalogApi.processInvoice(invoiceRows);
    setInvoiceResult(result);
    const unmatched = result.filter(r => r.matchNote);
    toast(`Đã xử lý ${result.length} dòng${unmatched.length > 0 ? ` (${unmatched.length} không match)` : ''}`, 'success');
  } catch (err) {
    toast(err?.response?.data?.message || 'Lỗi xử lý hóa đơn', 'error');
  } finally {
    setImportingInvoice(false);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function MisaCatalogTab() {
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [importingCatalog, setImportingCatalog] = useState(false);
  const [importingInvoice, setImportingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [rawInvoiceData, setRawInvoiceData] = useState(null);

  const catalogFileRef = useRef(null);
  const invoiceFileRef = useRef(null);

  // ── Load catalog ──
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try { setCatalog(await misaCatalogApi.list()); }
    catch { toast('Lỗi tải danh mục', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 1: Import danh mục hàng hóa
  // ════════════════════════════════════════════════════════════════════════════

  const handleCatalogFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportingCatalog(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Layout file danh mục:
      // A(0)=Id, B(1)=Mã hàng, C(2)=Tên hàng hóa, D(3)=ĐVT, E(4)=VAT(%),
      // F(5)=Mã TS, G(6)=Mã hàng trong MISA, H(7)=Tên hàng trong MISA,
      // I(8)=Kho, J(9)=TK Kho, K(10)=TK Giá vốn
      const rows = [];
      for (let i = 1; i < json.length; i++) {
        const r = json[i];
        const code = String(r[1] ?? '').trim();
        const name = String(r[2] ?? '').trim();
        if (!code || !name) continue;
        rows.push({
          productCode: code,                            // B: Mã hàng
          productName: name,                            // C: Tên hàng hóa
          originalUnit: String(r[3] ?? '').trim(),       // D: ĐVT
          vatPercent: String(r[4] ?? '').trim(),       // E: VAT(%)
          taxCode: String(r[5] ?? '').trim(),       // F: Mã TS
          misaCategory: String(r[6] ?? '').trim(),       // G: Mã hàng trong MISA
          misaProductName: String(r[7] ?? '').trim(),       // H: Tên hàng trong MISA
          kho: String(r[8] ?? '').trim(),       // I: Kho
          tkKho: String(r[9] ?? '').trim(),       // J: TK Kho
          tkGiaVon: String(r[10] ?? '').trim(),      // K: TK Giá vốn
        });
      }

      if (rows.length === 0) {
        toast('File không có dữ liệu hợp lệ', 'error');
        return;
      }

      const result = await misaCatalogApi.importCatalog(rows);
      toast(`Đã import ${result.imported} mới, cập nhật ${result.updated}, lỗi ${result.failed}`, 'success');
      loadCatalog();
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi import', 'error');
    } finally {
      setImportingCatalog(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 2: Import báo cáo hóa đơn FPT → MISA
  // ════════════════════════════════════════════════════════════════════════════

  const handleInvoiceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (catalog.length === 0) {
      toast('Chưa có danh mục hàng hóa! Import danh mục trước.', 'error');
      return;
    }

    setImportingInvoice(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const rawRows = [];
      const invoiceRows = [];
      for (let i = 1; i < json.length; i++) {
        const r = json[i];
        const maHang = String(r[16] ?? '').trim();
        if (!maHang) continue;

        const rawRow = {
          sttHoaDon: String(r[0] ?? ''),
          mauSoHd: String(r[3] ?? ''),
          kyHieuHd: String(r[4] ?? ''),
          soHoaDon: String(r[5] ?? ''),
          ngayHoaDon: String(r[6] ?? ''),
          maKhachHang: String(r[7] ?? ''),
          tenKhachHang: String(r[8] ?? ''),
          diaChi: String(r[9] ?? ''),
          maSoThue: String(r[10] ?? ''),
          hinhThucTT: String(r[12] ?? ''),
          maHang,
          tenHang: String(r[17] ?? ''),
          dvt: String(r[20] ?? ''),
          soLuong: Number(r[21]) || 0,
          donGia: Number(r[23]) || 0,
          thanhTien: Number(r[24]) || 0,
          vatPercent: String(r[27] ?? ''),
          tienThue: Number(r[29]) || 0,
        };

        rawRows.push(rawRow);
        invoiceRows.push(rawRow);
      }

      if (invoiceRows.length === 0) {
        toast('File không có dữ liệu hóa đơn hợp lệ', 'error');
        return;
      }

      setRawInvoiceData(rawRows);

      const result = await misaCatalogApi.processInvoice(invoiceRows);
      setInvoiceResult(result);
      const unmatched = result.filter(r => r.matchNote);
      toast(`Đã xử lý ${result.length} dòng${unmatched.length > 0 ? ` (${unmatched.length} không match)` : ''}`, 'success');
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi xử lý hóa đơn', 'error');
    } finally {
      setImportingInvoice(false);
    }
  };

  // ── Export MISA xlsx ──
  const exportMisa = () => {
    if (!invoiceResult?.length) return;
    const wb = XLSX.utils.book_new();
    const sheetRows = [MISA_HEADERS, ...invoiceResult.map(misaRowToArray)];
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);

    const textCols = [9, 14];
    for (let r = 1; r <= invoiceResult.length; r++) {
      for (const c of textCols) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr] && ws[addr].v !== '') {
          ws[addr].t = 's';
          ws[addr].z = '@';
        }
      }
    }

    ws['!cols'] = MISA_HEADERS.map((_, i) =>
      textCols.includes(i) ? { wch: 16, numFmt: '@' } : { wch: 16 }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'BanHang');
    XLSX.writeFile(wb, `MISA_BanHang_FPT_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('Đã export file MISA', 'success');
  };

  // ── Delete all catalog ──
  const handleDeleteAll = async () => {
    if (!confirm('Xoá toàn bộ danh mục? Hành động này không thể hoàn tác.')) return;
    try {
      await misaCatalogApi.deleteAll();
      setCatalog([]);
      toast('Đã xoá toàn bộ danh mục', 'success');
    } catch { toast('Lỗi xoá', 'error'); }
  };

  // ── Inline edit kg_per_unit ──
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(item.kgPerUnit != null ? String(item.kgPerUnit) : '');
  };
  const saveEdit = async (item) => {
    try {
      const val = editValue.trim() === '' ? null : parseFloat(editValue);
      await misaCatalogApi.update(item.id, { kgPerUnit: val, parseNote: val != null ? null : item.parseNote });
      setCatalog(prev => prev.map(c => c.id === item.id
        ? { ...c, kgPerUnit: val, parseNote: val != null ? null : c.parseNote } : c));
      toast('Đã cập nhật', 'success');
    } catch { toast('Lỗi', 'error'); }
    setEditingId(null);
  };

  // ── Filter catalog ──
  const filtered = catalog.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.productName?.toLowerCase().includes(q)
      || c.productCode?.toLowerCase().includes(q)
      || c.misaCategory?.toLowerCase().includes(q)
      || c.misaProductName?.toLowerCase().includes(q);
  });

  const unparsed = catalog.filter(c => c.kgPerUnit == null);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Invoice result preview — 2 columns comparison
  // ════════════════════════════════════════════════════════════════════════════

  if (invoiceResult && rawInvoiceData) {
    const unmatched = invoiceResult.filter(r => r.matchNote);

    const rawHeaders = ['STT HĐ', 'Mã KH', 'Tên KH', 'Địa chỉ', 'MST', 'Mã hàng', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', '% VAT', 'Tiền thuế'];
    const rawKeys = ['sttHoaDon', 'maKhachHang', 'tenKhachHang', 'diaChi', 'maSoThue', 'maHang', 'tenHang', 'dvt', 'soLuong', 'donGia', 'thanhTien', 'vatPercent', 'tienThue'];

    const processedHeaders = ['Mã KH', 'Tên KH', 'Địa chỉ', 'Mã hàng MISA', 'Tên hàng MISA', 'ĐVT', 'SL (kg)', 'Đơn giá', 'Thành tiền', 'Ghi chú'];
    const processedKeys = ['maKhachHang', 'tenKhachHang', 'diaChi', 'maHang', 'tenHang', 'dvt', 'soLuong', 'donGia', 'thanhTien', 'matchNote'];

    return (
      <div className="p-4 sm:p-6 space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setInvoiceResult(null); setRawInvoiceData(null); }}
              className="flex items-center gap-1 text-sm text-muted hover:text-ink font-medium">
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-ink">Đối chiếu dữ liệu hóa đơn</h2>
              <p className="text-xs text-muted">
                {invoiceResult.length} dòng
                {unmatched.length > 0 && <span className="text-amber-600 ml-2">⚠ {unmatched.length} không match</span>}
              </p>
            </div>
          </div>
          <button onClick={exportMisa}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong transition shadow-sm">
            <Download size={15} /> Export XLSX
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Raw FPT data */}
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="bg-canvas px-4 py-2 border-b border-line">
              <h3 className="text-sm font-semibold text-ink">📄 Dữ liệu gốc từ file FPT</h3>
              <p className="text-xs text-muted">{rawInvoiceData.length} dòng</p>
            </div>
            <div className="overflow-x-auto">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-canvas z-10">
                    <tr>
                      {rawHeaders.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted border-b border-line whitespace-nowrap text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawInvoiceData.map((r, idx) => (
                      <tr key={idx} className="border-b border-line-soft hover:bg-canvas/50">
                        {rawKeys.map(key => (
                          <td key={key} className="px-2 py-1.5 max-w-[120px] truncate">
                            {typeof r[key] === 'number' ? fmt(r[key]) : r[key] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Processed MISA data */}
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="bg-canvas px-4 py-2 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">✅ Dữ liệu đã xử lý (MISA format)</h3>
                <p className="text-xs text-muted">{invoiceResult.length} dòng</p>
              </div>
              <ArrowRight size={16} className="text-gold" />
            </div>
            <div className="overflow-x-auto">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-canvas z-10">
                    <tr>
                      {processedHeaders.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted border-b border-line whitespace-nowrap text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceResult.map((r, idx) => (
                      <tr key={idx} className={`border-b border-line-soft hover:bg-canvas/50 ${r.matchNote ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                        {processedKeys.map(key => {
                          if (key === 'matchNote') {
                            return (
                              <td key={key} className="px-2 py-1.5">
                                {r.matchNote && (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 whitespace-nowrap">{r.matchNote}</span>
                                )}
                              </td>
                            );
                          }
                          return (
                            <td key={key} className="px-2 py-1.5 max-w-[120px] truncate">
                              {typeof r[key] === 'number' ? fmt(r[key]) : r[key] || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: Main view
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24">

      {/* ── Section 1: Danh mục ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <Package size={18} className="text-gold" /> Danh mục hàng hóa MISA
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {catalog.length} sản phẩm
              {unparsed.length > 0 && (
                <span className="text-amber-600 ml-2">· {unparsed.length} chưa có quy cách</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {catalog.length > 0 && (
              <button onClick={handleDeleteAll}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-500 rounded-xl border border-red-200 hover:bg-red-50 transition">
                <Trash2 size={13} /> Xoá tất cả
              </button>
            )}
            <button onClick={() => catalogFileRef.current?.click()} disabled={importingCatalog}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gold rounded-xl hover:bg-gold-strong transition shadow-sm disabled:opacity-50">
              {importingCatalog ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importingCatalog ? 'Đang import...' : 'Import danh mục'}
            </button>
            <input ref={catalogFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleCatalogFile} />
          </div>
        </div>

        {catalog.length > 0 && (
          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-line rounded-xl outline-none focus:border-gold" />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Đang tải...</span>
          </div>
        ) : catalog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted gap-3 border-2 border-dashed border-line rounded-2xl">
            <FileSpreadsheet size={32} strokeWidth={1} />
            <p className="text-sm">Chưa có danh mục. Import file "Danh mục hàng hóa" để bắt đầu.</p>
          </div>
        ) : (
          <div className="border border-line rounded-xl overflow-x-auto">
            <div className="max-h-[30vh] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-canvas z-10">
                  <tr className="bg-canvas">
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line">Mã hàng</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line">Tên sản phẩm</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line">ĐVT gốc</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted border-b border-line">Quy cách (kg)</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line">Mã hàng MISA</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line">Tên hàng MISA</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted border-b border-line">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => (
                    <tr key={c.id} className={`border-b border-line-soft hover:bg-canvas/50
                      ${c.kgPerUnit == null ? 'bg-amber-50/50 dark:bg-amber-900/5' : ''}`}>
                      <td className="px-3 py-2 text-muted">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{c.productCode}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate font-medium">{c.productName}</td>
                      <td className="px-3 py-2">{c.originalUnit}</td>
                      <td className="px-3 py-2 text-right">
                        {editingId === c.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input value={editValue} onChange={e => setEditValue(e.target.value)}
                              className="w-20 px-2 py-1 text-xs text-right border border-gold rounded-lg outline-none"
                              autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit(c)} />
                            <button onClick={() => saveEdit(c)} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                              <Check size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-0.5 text-muted hover:bg-surface-2 rounded">
                              <X size={12} />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 cursor-pointer group" onClick={() => startEdit(c)}>
                            <span className={`tabular-nums font-medium ${c.kgPerUnit != null ? 'text-ink' : 'text-amber-600'}`}>
                              {c.kgPerUnit != null ? fmt(c.kgPerUnit) : '—'}
                            </span>
                            <Edit2 size={10} className="opacity-0 group-hover:opacity-60 text-muted" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {c.misaCategory || <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-emerald-700 dark:text-emerald-400 font-medium">
                        {c.misaProductName || <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[180px] truncate">
                        {c.parseNote && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-1">
                            <AlertTriangle size={10} /> {c.parseNote}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 2: Hóa đơn FPT ──────────────────────────────────────── */}
      <section className="space-y-3 pt-2 border-t border-line-soft">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-gold" /> Xử lý hóa đơn FPT → MISA
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Import file báo cáo chi tiết hóa đơn FPT, tự động quy đổi sang kg và format MISA
            </p>
          </div>
          <button onClick={() => invoiceFileRef.current?.click()} disabled={importingInvoice || catalog.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gold rounded-xl hover:bg-gold-strong transition shadow-sm disabled:opacity-50">
            {importingInvoice ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importingInvoice ? 'Đang xử lý...' : 'Import hóa đơn FPT'}
          </button>
          <input ref={invoiceFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInvoiceFile} />
        </div>

        {catalog.length === 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-sm text-amber-700">
            <AlertTriangle size={15} />
            Import danh mục hàng hóa trước để có thể xử lý hóa đơn.
          </div>
        )}
      </section>
    </div>
  );
}