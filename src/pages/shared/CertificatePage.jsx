/**
 * CertificatePage.jsx — Quản lý giấy chứng nhận sản phẩm
 * Dùng chung cho role: OWNER, OPERATOR
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Award, Plus, Trash2, Eye, X, ChevronLeft,
  FileText, ImageIcon, Calendar, Upload, Package,
  AlertTriangle, Loader2, ExternalLink, Search,
} from 'lucide-react';
import { certificateApi } from '../../api/certificateApi';
import { useToast } from '../../components/common/Toast';
import {
  PageHeader, LoadingSpinner, EmptyState,
  PrimaryButton, SecondaryButton, DangerButton,
  Field, inputCls,
} from '../../components/ui';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const fileUrl = (path) => path ? `${BASE_URL}/api/auth${path}` : null;

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('vi-VN');
}

// sort: không hạn (null) → lên đầu, rồi hạn xa nhất → gần nhất
function sortCerts(certs) {
  return [...certs].sort((a, b) => {
    if (!a.expiredAt && !b.expiredAt) return 0;
    if (!a.expiredAt) return -1;
    if (!b.expiredAt) return 1;
    return b.expiredAt - a.expiredAt;
  });
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <p className="text-ink text-sm leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onCancel}>Hủy</SecondaryButton>
          <DangerButton onClick={onConfirm}>Xóa</DangerButton>
        </div>
      </div>
    </div>
  );
}

// ── PDF Viewer (dùng pdfjs-dist qua CDN) ─────────────────────────────────────
function PdfViewer({ url }) {
  const canvasRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pdfRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    pdfRef.current = null;

    const loadPdf = async () => {
      try {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        const pdf = await window.pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError('Không thể tải PDF.'); setLoading(false); }
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdfRef.current || loading) return;
    let cancelled = false;
    const render = async () => {
      try {
        const page = await pdfRef.current.getPage(currentPage);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      } catch (e) { if (!cancelled) setError('Lỗi render trang.'); }
    };
    render();
    return () => { cancelled = true; };
  }, [currentPage, loading]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={32} className="animate-spin text-gold" />
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
      <FileText size={40} className="text-gold/40" />
      <p className="text-sm">{error}</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 bg-gold text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-gold-strong transition-colors">
        <ExternalLink size={14} /> Mở PDF trong tab mới
      </a>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-3 p-4 overflow-auto">
      <canvas ref={canvasRef} className="max-w-full shadow-md rounded" />
      {numPages > 1 && (
        <div className="flex items-center gap-3 bg-surface rounded-xl px-4 py-2 shadow-sm border border-hairline sticky bottom-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="text-sm text-ink-2 hover:text-ink disabled:opacity-30 px-2">◀</button>
          <span className="text-sm text-ink font-medium">{currentPage} / {numPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
            className="text-sm text-ink-2 hover:text-ink disabled:opacity-30 px-2">▶</button>
        </div>
      )}
    </div>
  );
}

// ── File Preview Modal ────────────────────────────────────────────────────────
function FilePreviewModal({ file, onClose }) {
  if (!file) return null;
  const url = fileUrl(file.fileUrl);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}>
      <div className="relative bg-surface rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-hairline flex-shrink-0">
          <p className="font-semibold text-ink truncate pr-4">{file.originalName || 'File'}</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hairline text-muted">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-canvas">
          {file.fileType === 'pdf' ? (
            <PdfViewer url={url} />
          ) : (
            <div className="flex items-center justify-center h-full p-4" style={{ minHeight: '75vh' }}>
              <img src={url} alt={file.originalName}
                className="max-w-full max-h-[75vh] object-contain" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Cert Modal (dùng cho cả tạo mới từ list lẫn thêm vào product đang xem) ─
function AddCertModal({ productId, productName, products, onClose, onSuccess }) {
  const toast = useToast();
  const fileInputRef = useRef();
  const [form, setForm] = useState({
    productId: productId ?? '',
    certName: '',
    issuedAt: '',
    expiredAt: '',
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    setSelectedFiles(prev => [...prev, ...picked]);
    // reset sau 1 tick để browser kịp copy file references
    setTimeout(() => { if (e.target) e.target.value = ''; }, 0);
  };

  const handleSubmit = async () => {
    if (!form.productId) { toast('Vui lòng chọn sản phẩm', 'error'); return; }
    if (!form.certName.trim()) { toast('Vui lòng nhập tên chứng nhận', 'error'); return; }
    if (!form.issuedAt) { toast('Vui lòng chọn ngày cấp', 'error'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('productId', form.productId);
      fd.append('certName', form.certName.trim());
      fd.append('issuedAt', new Date(form.issuedAt).getTime());
      if (form.expiredAt)
        fd.append('expiredAt', new Date(form.expiredAt).getTime());
      selectedFiles.forEach(f => fd.append('files', f));

      await certificateApi.create(fd);
      toast('Tạo chứng nhận thành công', 'success');
      onSuccess();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo chứng nhận', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div>
            <h2 className="font-bold text-ink">Thêm giấy chứng nhận</h2>
            {productName && (
              <p className="text-xs text-muted mt-0.5">cho {productName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-hairline text-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Chỉ hiển thị dropdown chọn sản phẩm khi không lock productId */}
          {!productId && (
            <Field label="Sản phẩm" required>
              <select
                className="w-full h-10 rounded-lg border border-hairline-2 px-3 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-gold/30"
                value={form.productId}
                onChange={e => set('productId', e.target.value)}>
                <option value="">— Chọn sản phẩm —</option>
                {(products || []).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Tên chứng nhận" required>
            <input className={inputCls}
              placeholder="VD: ISO 22000:2018, HACCP..."
              value={form.certName}
              onChange={e => set('certName', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày cấp" required>
              <input type="date" className={inputCls}
                value={form.issuedAt}
                onChange={e => set('issuedAt', e.target.value)} />
            </Field>
            <Field label="Hạn sử dụng">
              <input type="date" className={inputCls}
                value={form.expiredAt}
                onChange={e => set('expiredAt', e.target.value)} />
            </Field>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">
              File chứng nhận <span className="font-normal text-muted">(ảnh hoặc PDF, nhiều file)</span>
            </label>
            <input ref={fileInputRef} type="file" multiple className="hidden"
              accept="image/*,.pdf" onChange={handleFiles} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gold/40 rounded-xl py-3.5 flex items-center justify-center gap-2 text-muted hover:border-gold/70 hover:bg-gold/5 transition-colors">
              <Upload size={16} className="text-gold flex-shrink-0" />
              <span className="text-sm">
                {selectedFiles.length > 0
                  ? `Thêm file (đã chọn ${selectedFiles.length})`
                  : 'Nhấn để chọn file'}
              </span>
            </button>
            {selectedFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-canvas rounded-lg px-3 py-2">
                    {f.type === 'application/pdf'
                      ? <FileText size={14} className="text-red-500 flex-shrink-0" />
                      : <ImageIcon size={14} className="text-blue-500 flex-shrink-0" />}
                    <span className="text-xs text-ink flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted flex-shrink-0">
                      {f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+'MB' : Math.round(f.size/1024)+'KB'}
                    </span>
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted hover:text-red-500 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-hairline">
          <SecondaryButton onClick={onClose}>Hủy</SecondaryButton>
          <PrimaryButton loading={saving} onClick={handleSubmit}>Tạo chứng nhận</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Product Cert Detail Panel ─────────────────────────────────────────────────
function ProductCertPanel({ product, allProducts, onBack, onRefresh }) {
  const toast = useToast();
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState(null);
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }
  const [deletingFile, setDeletingFile] = useState(null);
  const [showAddCert, setShowAddCert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await certificateApi.listByProduct(product.productId);
      setCerts(sortCerts(data || []));
    } catch { toast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [product.productId]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteCert = (cert) => {
    setConfirm({
      message: `Xóa chứng nhận "${cert.certName}"? Tất cả file đính kèm sẽ bị xóa vĩnh viễn.`,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await certificateApi.deleteCert(cert.id);
          toast('Đã xóa chứng nhận', 'success');
          load();
          onRefresh();
        } catch (e) {
          toast(e?.response?.data?.message || 'Lỗi khi xóa', 'error');
        }
      },
    });
  };

  const handleDeleteFile = (cert, file) => {
    setConfirm({
      message: `Xóa file "${file.originalName || 'này'}"?`,
      onConfirm: async () => {
        setConfirm(null);
        setDeletingFile(file.id);
        try {
          const updated = await certificateApi.deleteFile(cert.id, file.id);
          setCerts(prev => sortCerts(prev.map(c => c.id === cert.id ? updated : c)));
          toast('Đã xóa file', 'success');
        } catch (e) {
          toast(e?.response?.data?.message || 'Lỗi khi xóa file', 'error');
        } finally { setDeletingFile(null); }
      },
    });
  };

  return (
    <>
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)} />
      )}
      {showAddCert && (
        <AddCertModal
          productId={product.productId}
          productName={product.productName}
          onClose={() => setShowAddCert(false)}
          onSuccess={() => { load(); onRefresh(); }} />
      )}

      <div className="space-y-5">
        {/* Back */}
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
          <ChevronLeft size={16} /> Quay lại
        </button>

        {/* Product header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {product.imageUrl ? (
              <img src={fileUrl(product.imageUrl)} alt={product.productName}
                className="w-12 h-12 rounded-xl object-cover border border-hairline flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-gold" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-ink truncate">{product.productName}</h2>
              <p className="text-sm text-muted">{certs.length} chứng nhận</p>
            </div>
          </div>
          <PrimaryButton onClick={() => setShowAddCert(true)} className="flex-shrink-0">
            <Plus size={14} className="mr-1.5" /> Thêm chứng nhận
          </PrimaryButton>
        </div>

        {loading ? (
          <LoadingSpinner label="Đang tải..." />
        ) : certs.length === 0 ? (
          <EmptyState icon={Award} title="Chưa có chứng nhận"
            description="Nhấn 'Thêm chứng nhận' để thêm giấy chứng nhận cho sản phẩm."
            action={<PrimaryButton onClick={() => setShowAddCert(true)}><Plus size={14} className="mr-1.5" />Thêm chứng nhận</PrimaryButton>} />
        ) : (
          <div className="space-y-4">
            {certs.map(cert => {
              const expired = cert.expiredAt && cert.expiredAt < Date.now();
              const noExpiry = !cert.expiredAt;
              return (
                <div key={cert.id} className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
                  {/* Cert header */}
                  <div className="flex items-start justify-between gap-3 px-5 py-4 bg-canvas border-b border-hairline">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{cert.certName}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-ink-2">
                          <Calendar size={11} /> Ngày cấp: {fmtDate(cert.issuedAt)}
                        </span>
                        {noExpiry ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">Không có hạn</span>
                        ) : (
                          <span className={`flex items-center gap-1 text-xs font-medium ${expired ? 'text-red-500' : 'text-ink-2'}`}>
                            {expired && <AlertTriangle size={11} />}
                            Hạn: {fmtDate(cert.expiredAt)}
                            {expired && ' — Hết hạn'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCert(cert)}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:bg-red-500/18 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 size={13} /> Xóa
                    </button>
                  </div>

                  {/* Files */}
                  <div className="p-4">
                    {cert.files && cert.files.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-2">
                        {cert.files.map(file => (
                          <div key={file.id}
                            className="flex items-center gap-2 bg-canvas rounded-xl px-3 py-2.5">
                            {file.fileType === 'pdf'
                              ? <FileText size={16} className="text-red-500 flex-shrink-0" />
                              : <ImageIcon size={16} className="text-blue-500 flex-shrink-0" />}
                            <span className="text-xs text-ink flex-1 truncate min-w-0">
                              {file.originalName || 'file'}
                            </span>
                            <button onClick={() => setPreviewFile(file)}
                              className="flex-shrink-0 p-1 rounded hover:bg-gold/10 text-muted hover:text-gold transition-colors"
                              title="Xem file">
                              <Eye size={14} />
                            </button>
                            <button
                              disabled={deletingFile === file.id}
                              onClick={() => handleDeleteFile(cert, file)}
                              className="flex-shrink-0 p-1 rounded hover:bg-red-50 dark:bg-red-500/10 text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Xóa file">
                              {deletingFile === file.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted italic text-center py-2">
                        Chứng nhận này chưa có file đính kèm
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Fuzzy match helper ────────────────────────────────────────────────────────
function normalize(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
function fuzzyMatch(text, keyword) {
  if (!keyword) return true;
  const t = normalize(text);
  const k = normalize(keyword);
  // exact substring
  if (t.includes(k)) return true;
  // token match: every word in keyword must appear as substring
  return k.split(/\s+/).every(w => t.includes(w));
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CertificatePage() {
  const toast = useToast();
  const [products, setProducts]       = useState([]);   // [{productId, productName, imageUrl, certCount, certNames:[]}]
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);
  const [showAddCert, setShowAddCert] = useState(false);
  const [keyword, setKeyword]         = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [withCerts, all] = await Promise.all([
        certificateApi.listProductsWithCerts(),
        certificateApi.listAllProducts(),
      ]);
      const base = withCerts || [];

      // Load cert names cho tất cả sản phẩm song song để search được theo tên cert
      const certNamesMap = {};
      await Promise.all(base.map(async p => {
        try {
          const certs = await certificateApi.listByProduct(p.productId);
          certNamesMap[p.productId] = (certs || []).map(c => c.certName);
        } catch { certNamesMap[p.productId] = []; }
      }));

      setProducts(base.map(p => ({ ...p, certNames: certNamesMap[p.productId] || [] })));
      setAllProducts(all || []);
    } catch { toast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Filter: match tên sản phẩm HOẶC bất kỳ tên chứng nhận nào
  const filtered = keyword.trim()
    ? products.filter(p =>
        fuzzyMatch(p.productName, keyword) ||
        p.certNames.some(cn => fuzzyMatch(cn, keyword)))
    : products;

  if (selected) {
    return (
      <div className="p-5 sm:p-8">
        <ProductCertPanel
          product={selected}
          allProducts={allProducts}
          onBack={() => setSelected(null)}
          onRefresh={loadProducts} />
      </div>
    );
  }

  return (
    <>
      {showAddCert && (
        <AddCertModal
          products={allProducts}
          onClose={() => setShowAddCert(false)}
          onSuccess={loadProducts} />
      )}

      <div className="p-5 sm:p-8 space-y-6">
        <PageHeader
          icon={Award}
          title="Quản lý chứng nhận"
          subtitle="Giấy chứng nhận chất lượng của sản phẩm"
          action={
            <PrimaryButton onClick={() => setShowAddCert(true)}>
              <Plus size={15} className="mr-1.5" /> Thêm chứng nhận
            </PrimaryButton>
          } />

        {/* Search bar */}
        {!loading && products.length > 0 && (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="w-full sm:max-w-sm h-10 pl-9 pr-9 rounded-xl border border-hairline-2 bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-muted"
              placeholder="Tìm theo tên sản phẩm hoặc tên chứng nhận..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)} />
            {keyword && (
              <button onClick={() => setKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Đang tải..." />
        ) : products.length === 0 ? (
          <EmptyState icon={Award} title="Chưa có chứng nhận"
            description="Nhấn nút + để thêm giấy chứng nhận cho sản phẩm."
            action={
              <PrimaryButton onClick={() => setShowAddCert(true)}>
                <Plus size={15} className="mr-1.5" /> Thêm chứng nhận
              </PrimaryButton>
            } />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Không tìm thấy kết quả cho <span className="font-medium text-ink">"{keyword}"</span></p>
            <button onClick={() => setKeyword('')} className="mt-2 text-xs text-gold hover:underline">Xóa bộ lọc</button>
          </div>
        ) : (
          <>
            {keyword && (
              <p className="text-xs text-muted">
                Tìm thấy <span className="font-semibold text-ink">{filtered.length}</span> chứng nhận
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 gap-3">
              {filtered.map(p => {
                // highlight: cert names matched
                const matchedCerts = keyword
                  ? p.certNames.filter(cn => fuzzyMatch(cn, keyword))
                  : [];
                return (
                  <button key={p.productId} onClick={() => setSelected(p)}
                    className="w-full flex items-center gap-4 bg-surface rounded-2xl border border-hairline shadow-sm px-4 py-3.5 text-left hover:shadow-md hover:border-gold/30 transition-all group">
                    {p.imageUrl ? (
                      <img src={fileUrl(p.imageUrl)} alt={p.productName}
                        className="w-11 h-11 rounded-xl object-cover border border-hairline flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <Package size={18} className="text-gold" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink truncate group-hover:text-gold transition-colors">
                        {p.productName}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{p.certCount} chứng nhận</p>
                      {matchedCerts.length > 0 && (
                        <p className="text-xs text-gold mt-0.5 truncate">
                          {matchedCerts.slice(0, 2).join(', ')}
                          {matchedCerts.length > 2 && ` +${matchedCerts.length - 2}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 bg-gold/10 text-gold rounded-full px-3 py-1 flex-shrink-0">
                      <Award size={13} />
                      <span className="text-xs font-semibold">{p.certCount}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
