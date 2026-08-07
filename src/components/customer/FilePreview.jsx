// src/components/customer/FilePreview.jsx
//
// XEM TRƯỚC FILE — dùng cho hợp đồng khách hàng (ảnh hoặc PDF).
//
// Hai định dạng cần hai cách render hoàn toàn khác nhau:
//   · Ảnh → <img>, có phóng to / thu nhỏ / xoay (hợp đồng scan hay bị ngược)
//   · PDF → <iframe>, để trình duyệt tự lo phần đọc nhiều trang
//
// Nên chỗ nào cũng phải hỏi "file này là gì" trước khi vẽ. Gói lại ở đây để các
// trang khác dùng lại mà không phải lặp lại phép kiểm tra đuôi file.
import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Image as ImageIcon, ExternalLink, Download,
  ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, X,
} from 'lucide-react';

/** Đuôi file → loại nội dung. */
export function detectFileKind(url) {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|bmp|webp|svg|avif)$/.test(clean)) return 'image';
  return 'other';
}

/**
 * Ô xem trước NHỎ, dùng trong lưới danh sách.
 *
 * @param url    đường dẫn đầy đủ
 * @param label  nhãn hiển thị ở đầu ô
 * @param onOpen bấm vào thì mở khung xem lớn
 * @param kind   loại file (đã detect từ bên ngoài)
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
        // Không nhúng iframe trong lưới: mỗi iframe là một lần tải PDF, mở 10
        // trang cùng lúc sẽ làm treo trình duyệt. Chỉ hiện thẻ, bấm mới xem.
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

/**
 * KHUNG XEM LỚN — toàn màn hình, lật qua lại giữa các file.
 *
 * @param files    [{ url, label, kind }]
 * @param index    vị trí đang xem
 * @param onIndex  đổi vị trí
 * @param onClose  đóng
 */
export function FilePreviewOverlay({ files = [], index = 0, onIndex, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const current = files[index];
  const kind = current?.kind || detectFileKind(current?.url || '');
  const many = files.length > 1;

  const go = useCallback((delta) => {
    if (!many) return;
    const next = (index + delta + files.length) % files.length;
    onIndex?.(next);
  }, [index, files.length, many, onIndex]);

  // Đổi file thì trả zoom/xoay về mặc định — giữ nguyên mức phóng của trang
  // trước sẽ làm trang sau hiện ra ở một góc ngẫu nhiên.
  useEffect(() => { 
    setZoom(1); 
    setRotate(0); 
    setFailed(false);
    setPdfError(false);
  }, [index]);

  // Phím tắt: Esc đóng, ←/→ lật trang.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/85 flex flex-col"
      onClick={onClose}
    >
      {/* Thanh công cụ */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 bg-black/60 text-white shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-sm font-semibold truncate">
          {current.label}
          {many && <span className="text-white/60 font-normal ml-2">{index + 1}/{files.length}</span>}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {kind === 'image' && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                className="p-2 rounded-lg hover:bg-white/15" title="Thu nhỏ">
                <ZoomOut size={16} />
              </button>
              <span className="text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
                className="p-2 rounded-lg hover:bg-white/15" title="Phóng to">
                <ZoomIn size={16} />
              </button>
              <button onClick={() => setRotate(r => (r + 90) % 360)}
                className="p-2 rounded-lg hover:bg-white/15" title="Xoay 90°">
                <RotateCw size={16} />
              </button>
            </>
          )}
          <a href={current.url} target="_blank" rel="noreferrer"
            className="p-2 rounded-lg hover:bg-white/15" title="Mở tab mới">
            <ExternalLink size={16} />
          </a>
          <a href={current.url} download
            className="p-2 rounded-lg hover:bg-white/15" title="Tải về">
            <Download size={16} />
          </a>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/15" title="Đóng (Esc)">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nội dung */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}>

        {many && (
          <>
            <button onClick={() => go(-1)}
              className="absolute left-2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70"
              title="Trang trước (←)">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => go(1)}
              className="absolute right-2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70"
              title="Trang sau (→)">
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {kind === 'pdf' ? (
          // Để trình duyệt tự lo việc đọc PDF nhiều trang — nhúng thư viện riêng
          // chỉ để xem hợp đồng là không đáng.
          <div className="w-full h-full rounded-xl bg-white overflow-hidden">
            {pdfError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-600">
                <FileText size={48} className="text-red-400" />
                <p className="text-sm">Không thể tải PDF</p>
                <a href={current.url} target="_blank" rel="noreferrer"
                  className="text-sm font-semibold text-blue-600 underline">
                  Mở trực tiếp trong tab mới
                </a>
              </div>
            ) : (
              <iframe
                src={current.url}
                title={current.label}
                className="w-full h-full"
                onError={() => setPdfError(true)}
              />
            )}
          </div>
        ) : kind === 'image' && !failed ? (
          <img
            src={current.url}
            alt={current.label}
            onError={() => setFailed(true)}
            style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
            className="max-w-full max-h-full object-contain transition-transform duration-150"
          />
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