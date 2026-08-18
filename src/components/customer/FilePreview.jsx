// src/components/customer/FilePreview.jsx
//
// XEM TRƯỚC FILE — dùng cho hợp đồng khách hàng (ảnh hoặc PDF).
//
// Ảnh → <img>, phóng to/thu nhỏ/xoay bằng CSS transform.
// PDF → TỰ RENDER bằng pdf.js ra <canvas>, KHÔNG dùng trình xem PDF mặc định
//       của trình duyệt (thanh công cụ xám của nó không tùy biến được và gây ra
//       cảnh "2 header"). Nhờ tự vẽ, mọi nút bấm nằm trên header của mình.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Image as ImageIcon, ExternalLink, Download,
  ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import api from '../../api/axios';

// ── pdf.js ──────────────────────────────────────────────────────────
// Nạp worker bằng `?worker` (không phải `?url`): để Vite ĐÓNG GÓI và KHỞI TẠO
// worker như một ES module worker đúng chuẩn. Cách cũ `?url` + `workerSrc` bắt
// trình duyệt tải file .mjs như "classic worker" → sai MIME type → pdf.js ném
// lỗi ngay tại getDocument (đó là lý do preview mới báo "không tải được" dù file
// PDF vẫn mở tốt ở tab mới).
//
// Dùng `workerPort` + `new PdfWorker()` khớp đúng version với pdfjs-dist đang
// cài, nên không bao giờ lệch API/Worker version.
//
// pdfjs-dist v4/v5 dùng đuôi .mjs. Nếu bạn lỡ cài v3 thì đổi thành
//   'pdfjs-dist/build/pdf.worker.min.js?worker'
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const clampZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/** Tỷ lệ zoom mặc định khi mở: PDF 50%, ảnh 75%, còn lại 100%. */
const defaultZoom = (kind) => (kind === 'pdf' ? 0.5 : kind === 'image' ? 0.75 : 1);

/** Đuôi file → loại nội dung. */
export function detectFileKind(url) {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|bmp|webp|svg|avif)$/.test(clean)) return 'image';
  return 'other';
}

/**
 * Ô xem trước NHỎ, dùng trong lưới danh sách.
 */
export function FileThumb({ url, label, onOpen, kind: kindProp }) {
  const kind = kindProp || detectFileKind(url);
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left rounded-xl border border-hairline overflow-hidden
        hover:border-gold transition-colors bg-canvas group"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
        <span className="text-xs font-semibold text-ink truncate">{label}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted shrink-0">
          {kind === 'pdf' ? <FileText size={12} /> : <ImageIcon size={12} />}
          {kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Ảnh' : 'Khác'}
        </span>
      </div>

      {kind === 'image' && !failed ? (
        <img
          src={url}
          alt={label}
          onError={() => setFailed(true)}
          className="w-full h-44 object-contain bg-surface-2"
        />
      ) : kind === 'pdf' ? (
        <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted
          bg-surface-2 group-hover:text-gold transition-colors">
          <FileText size={30} />
          <span className="text-xs font-medium">Bấm để xem PDF</span>
        </div>
      ) : (
        <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted bg-surface-2">
          <ImageIcon size={26} />
          <span className="text-xs">Không xem trước được</span>
        </div>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF VIEWER — tự render bằng pdf.js
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Vẽ toàn bộ trang PDF ra canvas, cuộn dọc như trình đọc thật.
 * `zoom` = hệ số so với bề rộng vừa khung (1.0 = vừa khung). Đổi zoom/xoay thì
 * VẼ LẠI ở đúng độ phân giải (nét căng, không bị mờ như phóng ảnh bitmap).
 *
 * @param src      blob: URL của PDF
 * @param zoom     hệ số phóng
 * @param rotate   góc xoay (0/90/180/270)
 * @param onLoaded (numPages) => void
 * @param onError  (err) => void
 */
function PdfCanvasViewer({ src, zoom, rotate, onLoaded, onError }) {
  const containerRef = useRef(null);
  const docRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [ready, setReady] = useState(false);
  // Bơm lại effect vẽ khi khung đổi kích thước (xoay màn hình, mở/đóng panel…).
  const [resizeTick, setResizeTick] = useState(0);

  // Nạp tài liệu một lần cho mỗi src.
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setReady(false);
    // pdfjs v6: getDocument CHỈ nhận object { url } hoặc { data } — KHÔNG nhận
    // chuỗi URL trực tiếp như v4/v5. Truyền { url } trỏ vào blob: (cùng origin).
    const task = pdfjsLib.getDocument({ url: src });
    task.promise
      .then((doc) => {
        if (cancelled) { doc.destroy?.(); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setReady(true);
        onLoaded?.(doc.numPages);
      })
      .catch((e) => {
        if (cancelled) return;
        // In lỗi thật để dễ chẩn đoán (worker, version, font…) thay vì nuốt mất.
        console.error('[PdfCanvasViewer] pdf.js load/render failed:', e);
        onError?.(e);
      });

    return () => {
      cancelled = true;
      try { task.destroy?.(); } catch { /* ignore */ }
      try { docRef.current?.destroy?.(); } catch { /* ignore */ }
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Vẽ lại khi: tài liệu sẵn sàng / đổi zoom / đổi góc xoay / đổi kích thước.
  useEffect(() => {
    const doc = docRef.current;
    const container = containerRef.current;
    if (!ready || !doc || !container || !numPages) return;

    let cancelled = false;
    const tasks = [];
    const dpr = window.devicePixelRatio || 1;

    (async () => {
      const avail = Math.max(0, container.clientWidth - 24); // trừ padding
      for (let n = 1; n <= numPages; n++) {
        if (cancelled) break;
        const page = await doc.getPage(n);
        if (cancelled) break;

        // Bề rộng "vừa khung" tính theo trang đã xoay.
        const base = page.getViewport({ scale: 1, rotation: rotate });
        const fit = avail > 0 ? avail / base.width : 1;
        const viewport = page.getViewport({ scale: fit * zoom, rotation: rotate });

        const canvas = container.querySelector(`canvas[data-page="${n}"]`);
        if (!canvas) continue;

        // Vẽ ở độ phân giải thật (nhân dpr) rồi ép hiển thị bằng CSS → nét.
        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        // pdfjs v6 khuyến nghị truyền thẳng `canvas` (canvasContext chỉ còn để
        // tương thích ngược). Vẽ ở độ phân giải thật qua `transform` (dpr).
        const task = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        tasks.push(task);
        try { await task.promise; } catch { /* render bị hủy khi đổi zoom */ }
      }
    })();

    return () => {
      cancelled = true;
      tasks.forEach((t) => { try { t.cancel(); } catch { /* ignore */ } });
    };
  }, [ready, numPages, zoom, rotate, resizeTick]);

  // Theo dõi kích thước khung để vẽ lại cho vừa.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setResizeTick((t) => t + 1));
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto flex flex-col items-center gap-3 py-3 px-3"
    >
      {!ready && (
        <div className="m-auto flex flex-col items-center gap-3 text-gray-400">
          <FileText size={40} className="animate-pulse" />
          <p className="text-sm">Đang dựng trang PDF…</p>
        </div>
      )}
      {Array.from({ length: numPages }, (_, i) => (
        <canvas key={i + 1} data-page={i + 1} className="shadow-lg bg-white rounded-sm" />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KHUNG XEM LỚN — toàn màn hình
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param files    [{ url, label, kind }]
 * @param index    vị trí đang xem
 * @param onIndex  đổi vị trí
 * @param onClose  đóng
 */
export function FilePreviewOverlay({ files = [], index = 0, onIndex, onClose }) {
  const [zoom, setZoom] = useState(() =>
    defaultZoom(files[index]?.kind || detectFileKind(files[index]?.url || '')));
  const [rotate, setRotate] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const current = files[index];
  const kind = current?.kind || detectFileKind(current?.url || '');
  const many = files.length > 1;
  const zoomable = kind === 'image' || kind === 'pdf';

  const go = useCallback((delta) => {
    if (!many) return;
    const next = (index + delta + files.length) % files.length;
    onIndex?.(next);
  }, [index, files.length, many, onIndex]);

  // Nút tải mở tab mới thay vì tải là do thuộc tính `download` bị trình duyệt
  // BỎ QUA khi URL khác origin (file ở server khác). Cách vòng: tải file về
  // blob cùng-origin (qua axios — có kèm token), rồi mới trigger download.
  const download = useCallback(async () => {
    if (!current?.url || downloading) return;
    // Tên file: lấy phần cuối URL, nếu không có thì dùng nhãn.
    const clean = String(current.url).split('?')[0];
    const guessed = decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1));
    const fileName = guessed || current.label || 'download';

    setDownloading(true);
    let objectUrl = null;
    let revoke = false;
    try {
      // PDF đã tải sẵn blob thì dùng lại, khỏi tải lần hai.
      if (kind === 'pdf' && pdfBlobUrl) {
        objectUrl = pdfBlobUrl;
      } else {
        const res = await api.get(current.url, { responseType: 'blob' });
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
        objectUrl = URL.createObjectURL(blob);
        revoke = true;
      }
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      // Không tải được (CORS…) thì đành mở tab mới để người dùng tự lưu.
      window.open(current.url, '_blank', 'noopener');
    } finally {
      if (revoke && objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDownloading(false);
    }
  }, [current, kind, pdfBlobUrl, downloading]);

  // Đổi file → trả zoom/xoay/pages về mặc định (theo loại file).
  useEffect(() => {
    setZoom(defaultZoom(kind));
    setRotate(0);
    setFailed(false);
    setPdfError(false);
    setPdfPages(0);
  }, [index, kind]);

  // Tải PDF về blob (vòng qua X-Frame-Options + kèm token xác thực), rồi đưa
  // cho pdf.js dựng. blob: URL cùng origin nên fetch/parse thoải mái.
  useEffect(() => {
    if (kind !== 'pdf' || !current?.url) { setPdfBlobUrl(null); return; }
    let objectUrl = null;
    let alive = true;
    setPdfLoading(true);
    setPdfError(false);

    api.get(current.url, { responseType: 'blob' })
      .then((res) => {
        if (!alive) return;
        const blob = res.data instanceof Blob
          ? res.data.slice(0, res.data.size, 'application/pdf')
          : new Blob([res.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
      })
      .catch(() => { if (alive) setPdfError(true); })
      .finally(() => { if (alive) setPdfLoading(false); });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, current?.url]);

  // Phím tắt: Esc đóng, ←/→ lật file, +/- zoom.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (zoomable && (e.key === '+' || e.key === '=')) setZoom((z) => clampZoom(z + ZOOM_STEP));
      else if (zoomable && (e.key === '-' || e.key === '_')) setZoom((z) => clampZoom(z - ZOOM_STEP));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose, zoomable]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex flex-col" onClick={onClose}>
      {/* ── Header của mình (giữ lại, thêm nút zoom cho cả ảnh lẫn PDF) ── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 bg-black/60 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-semibold truncate">
          {current.label}
          {many && <span className="text-white/60 font-normal ml-2">{index + 1}/{files.length}</span>}
          {kind === 'pdf' && pdfPages > 0 && (
            <span className="text-white/60 font-normal ml-2">· {pdfPages} trang</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {zoomable && (
            <>
              <button onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
                className="p-2 rounded-lg hover:bg-white/15 disabled:opacity-40"
                disabled={zoom <= ZOOM_MIN} title="Thu nhỏ (-)">
                <ZoomOut size={16} />
              </button>
              <span className="text-xs tabular-nums w-12 text-center select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
                className="p-2 rounded-lg hover:bg-white/15 disabled:opacity-40"
                disabled={zoom >= ZOOM_MAX} title="Phóng to (+)">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => setZoom(defaultZoom(kind))}
                className="px-2 py-1 rounded-lg hover:bg-white/15 text-xs font-medium"
                title="Về 100%">
                Vừa khung
              </button>
              <button onClick={() => setRotate((r) => (r + 90) % 360)}
                className="p-2 rounded-lg hover:bg-white/15" title="Xoay 90°">
                <RotateCw size={16} />
              </button>
              <span className="w-px h-5 bg-white/20 mx-1" />
            </>
          )}
          <a href={current.url} target="_blank" rel="noreferrer"
            className="p-2 rounded-lg hover:bg-white/15" title="Mở tab mới">
            <ExternalLink size={16} />
          </a>
          <button onClick={download} disabled={downloading}
            className="p-2 rounded-lg hover:bg-white/15 disabled:opacity-40" title="Tải về">
            <Download size={16} className={downloading ? 'animate-pulse' : ''} />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/15" title="Đóng (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Nội dung ── */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}>

        {many && (
          <>
            <button onClick={() => go(-1)}
              className="absolute left-2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70"
              title="File trước (←)">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => go(1)}
              className="absolute right-2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70"
              title="File sau (→)">
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {kind === 'pdf' ? (
          <div className="w-full h-full bg-neutral-800/40">
            {pdfError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/70">
                <FileText size={48} className="text-red-400" />
                <p className="text-sm">Không thể tải PDF để xem trước</p>
                <a href={current.url} target="_blank" rel="noreferrer"
                  className="text-sm font-semibold text-white underline">
                  Mở trực tiếp trong tab mới
                </a>
              </div>
            ) : pdfLoading || !pdfBlobUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/60">
                <FileText size={40} className="animate-pulse" />
                <p className="text-sm">Đang tải PDF…</p>
              </div>
            ) : (
              <PdfCanvasViewer
                src={pdfBlobUrl}
                zoom={zoom}
                rotate={rotate}
                onLoaded={setPdfPages}
                onError={() => setPdfError(true)}
              />
            )}
          </div>
        ) : kind === 'image' && !failed ? (
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <img
              src={current.url}
              alt={current.label}
              onError={() => setFailed(true)}
              style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
              className="max-w-full max-h-full object-contain transition-transform duration-150"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <FileText size={40} />
            <p className="text-sm">Không xem trước được định dạng này.</p>
            <a href={current.url} target="_blank" rel="noreferrer"
              className="text-sm font-semibold text-white underline">
              Mở trong tab mới
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default FilePreviewOverlay;