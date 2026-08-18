// src/components/customer/CustomerContract.jsx
//
// HỢP ĐỒNG KHÁCH HÀNG — dùng chung cho mọi trang quản lý khách (OWNER/ADMIN,
// seller, kế toán, kế toán trưởng).
//
// Ba thứ xuất ra:
//   · ContractBadge      — badge xanh "Có hợp đồng" / text thường khi chưa có,
//                          hover hiện nút Xem
//   · ContractViewModal  — xem bộ ảnh hợp đồng
//   · ContractUploadModal— chọn nhiều ảnh, hỏi xác nhận nếu đang thay hợp đồng cũ
//
// Quy tắc nghiệp vụ đi kèm: khách CHƯA có hợp đồng thì không được thanh toán
// công nợ. Backend chặn ở mọi luồng tạo/sửa đơn; FE chỉ ẩn lựa chọn cho đỡ hụt.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Upload, AlertTriangle, Eye, Trash2,
} from 'lucide-react';
import { customerContractApi, contractImageUrl } from '../../api/customerContractApi';
import { useToast } from '../common/Toast';
import Modal from '../ui/Modal';
import { PrimaryButton, SecondaryButton, DangerButton, LoadingSpinner, EmptyState } from '../ui';
import { FileThumb, FilePreviewOverlay, detectFileKind } from './FilePreview';

const fmtTime = (ms) => {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// BADGE Ở CỘT TÊN HỢP ĐỒNG
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param name        tên trên hợp đồng (contractNameResolved)
 * @param hasContract đã tải hợp đồng lên chưa
 * @param onView      mở modal xem
 */
export function ContractBadge({ name, hasContract, onView }) {
  if (!hasContract) {
    // Chưa có hợp đồng → giữ nguyên dạng text như trước, không tô màu gì để
    // badge xanh bên dưới thực sự nổi bật khi có.
    return <span className="text-sm text-ink">{name || '—'}</span>;
  }

  return (
    <span className="group inline-flex items-center gap-1.5 max-w-full">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold
        bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300
        ring-1 ring-blue-200 dark:ring-blue-500/28 truncate">
        <FileText size={11} className="shrink-0" />
        <span className="truncate">{name || 'Có hợp đồng'}</span>
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onView?.(); }}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
          inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-300
          hover:underline shrink-0"
        title="Xem hợp đồng"
      >
        <Eye size={12} /> Xem
      </button>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL XEM HỢP ĐỒNG
// ══════════════════════════════════════════════════════════════════════════════

export function ContractViewModal({ customer, onClose, onUpload }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  // Vị trí trang đang mở toàn màn hình; null = chưa mở.
  const [previewIdx, setPreviewIdx] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await customerContractApi.get(customer.id));
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được hợp đồng', 'error');
    } finally { setLoading(false); }
  }, [customer.id, toast]);

  useEffect(() => { load(); }, [load]);

  const images = data?.images || [];

  // Chuẩn hoá một lần rồi dùng chung cho cả ô nhỏ lẫn khung xem lớn — hai chỗ
  // phải đánh cùng thứ tự thì bấm ô thứ 3 mới mở đúng trang thứ 3.
  const previewFiles = images.map((img, i) => {
    const url = contractImageUrl(img.imageUrl);
    const kind = detectFileKind(url);
    return {
      id: img.id,
      url: url,
      label: `Trang ${i + 1}`,
      kind: kind,
    };
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Hợp đồng — ${customer.contractNameResolved || customer.companyName || customer.name || ''}`}
      size="lg"
      footer={
        <div className="flex justify-between gap-2">
          {onUpload
            ? <SecondaryButton onClick={() => { onClose?.(); onUpload(); }}>
                <Upload size={14} /> Cập nhật hợp đồng
              </SecondaryButton>
            : <span />}
          <SecondaryButton onClick={onClose}>Đóng</SecondaryButton>
        </div>
      }
    >
      {loading ? (
        <LoadingSpinner label="Đang tải hợp đồng…" />
      ) : images.length === 0 ? (
        <EmptyState icon={FileText} title="Khách hàng chưa có hợp đồng"
          description={data?.contractRequired
            ? 'Khách này cần có hợp đồng mới được thanh toán công nợ.'
            : 'Khách cũ — vẫn thanh toán công nợ được, tải hợp đồng lên là tuỳ chọn.'} />
      ) : (
        <>
          <p className="text-xs text-muted mb-3">
            {images.length} trang · Tải lên bởi <b className="text-ink">{data.uploadedByName || '—'}</b>
            {' '}lúc {fmtTime(data.uploadedAt)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {previewFiles.map((f, i) => (
              <FileThumb 
                key={f.id} 
                url={f.url} 
                label={f.label}
                kind={f.kind}
                onOpen={() => setPreviewIdx(i)} 
              />
            ))}
          </div>
        </>
      )}

      {previewIdx != null && (
        <FilePreviewOverlay
          files={previewFiles}
          index={previewIdx}
          onIndex={setPreviewIdx}
          onClose={() => setPreviewIdx(null)}
        />
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL UPLOAD
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param customer    { id, name, companyName, hasContract, ... }
 * @param onClose     (changed:boolean) => void — changed=true khi đã lưu thành công
 */
export function ContractUploadModal({ customer, onClose }) {
  const toast = useToast();
  const inputRef = useRef();
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  // Bước xác nhận chỉ xuất hiện khi khách ĐÃ có hợp đồng — upload mới sẽ thay
  // toàn bộ bộ cũ, và đó là thao tác không hoàn tác được từ giao diện.
  const [confirming, setConfirming] = useState(false);

  const hadContract = !!customer.hasContract;

  const pick = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length === 0) return;
    setFiles(prev => [...prev, ...chosen]);
    // Reset input để chọn lại đúng file vừa bỏ ra vẫn kích hoạt onChange.
    e.target.value = '';
  };

  const removeAt = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const doUpload = async () => {
    if (files.length === 0) { toast('Chưa chọn file hợp đồng nào', 'error'); return; }
    setSaving(true);
    try {
      await customerContractApi.upload(customer.id, files);
      toast(hadContract ? 'Đã cập nhật hợp đồng mới' : 'Đã tải hợp đồng lên', 'success');
      onClose?.(true);
    } catch (e) {
      toast(e?.response?.data?.message || 'Tải hợp đồng thất bại', 'error');
    } finally { setSaving(false); }
  };

  const submit = () => {
    if (files.length === 0) { toast('Chưa chọn file hợp đồng nào', 'error'); return; }
    if (hadContract && !confirming) { setConfirming(true); return; }
    doUpload();
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose?.(false)}
      title={hadContract ? 'Cập nhật hợp đồng' : 'Tải hợp đồng lên'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => onClose?.(false)} disabled={saving}>Huỷ</SecondaryButton>
          {confirming
            ? <DangerButton onClick={doUpload} loading={saving}>
                Xác nhận thay hợp đồng
              </DangerButton>
            : <PrimaryButton onClick={submit} loading={saving} disabled={files.length === 0}>
                <Upload size={14} /> {hadContract ? 'Cập nhật' : 'Tải lên'}
              </PrimaryButton>}
        </div>
      }
    >
      <p className="text-sm text-ink mb-3">
        Khách hàng:{' '}
        <span className="font-semibold">
          {customer.contractNameResolved || customer.companyName || customer.name}
        </span>
      </p>

      {/* Khách MỚI chưa có hợp đồng thì không bán chịu được — nói rõ ngay đây để
          người nhập hiểu vì sao phải tải lên. Khách cũ không thấy dòng này. */}
      {!hadContract && customer.contractRequired && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl
          bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/28">
          <FileText size={15} className="text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            Khách hàng này <b>chưa thể thanh toán công nợ</b> cho tới khi có hợp đồng.
            Tải lên ảnh hoặc file PDF hợp đồng để mở khoá.
          </p>
        </div>
      )}

      {hadContract && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl
          bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28">
          <AlertTriangle size={15} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Khách này <b>đã có hợp đồng</b>. Tải bộ ảnh mới sẽ <b>thay toàn bộ</b> hợp đồng
            hiện tại — bản cũ không còn hiển thị ở đâu nữa.
          </p>
        </div>
      )}

      {confirming ? (
        <div className="px-4 py-4 rounded-xl bg-red-50 dark:bg-red-500/10
          border border-red-200 dark:border-red-500/28">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
            Bạn chắc chắn muốn thay hợp đồng?
          </p>
          <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
            {files.length} file mới sẽ thay cho hợp đồng đang có. Thao tác này không
            hoàn tác được từ giao diện.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl
              border-2 border-dashed border-line-soft hover:border-gold hover:bg-canvas transition-colors"
          >
            <Upload size={22} className="text-gold" />
            <span className="text-sm font-semibold text-ink">Chọn ảnh hợp đồng</span>
            <span className="text-xs text-muted">Chọn được nhiều file · Ảnh (JPG, PNG…) hoặc PDF</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={pick}
            className="hidden"
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">
                Đã chọn {files.length} file
              </p>
              {files.map((f, i) => (
                <div key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-canvas border border-hairline">
                  <FileText size={14} className="text-gold shrink-0" />
                  <span className="text-xs text-ink truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-muted shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button type="button" onClick={() => removeAt(i)}
                    className="text-muted hover:text-red-500 shrink-0" disabled={saving}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK TIỆN DỤNG — gom state của 2 modal cho các trang danh sách
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Dùng ở trang danh sách khách hàng:
 *
 *   const contract = useContractModals(reloadList);
 *   ...
 *   <ContractBadge ... onView={() => contract.view(c)} />
 *   <button onClick={() => contract.upload(c)}>Tải hợp đồng</button>
 *   {contract.render()}
 */
export function useContractModals(onChanged) {
  const [viewTarget, setViewTarget] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  const render = () => (
    <>
      {viewTarget && (
        <ContractViewModal
          customer={viewTarget}
          onClose={() => setViewTarget(null)}
          onUpload={() => setUploadTarget(viewTarget)}
        />
      )}
      {uploadTarget && (
        <ContractUploadModal
          customer={uploadTarget}
          onClose={(changed) => {
            setUploadTarget(null);
            if (changed) onChanged?.();
          }}
        />
      )}
    </>
  );

  return { view: setViewTarget, upload: setUploadTarget, render };
}

export default ContractBadge;