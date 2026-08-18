// src/components/payment/VoucherPaymentModal.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Ticket, ScanLine, Loader2, CheckCircle2, AlertTriangle, CameraOff, ImageUp } from 'lucide-react';
import { voucherPaymentApi } from '../../api/voucherApi';
import { useToast } from '../common/Toast';

/**
 * THANH TOÁN ĐƠN HÀNG BẰNG VOUCHER.
 *
 * <p>Khách đưa phiếu (hoặc ảnh chụp phiếu), nhân viên nhập mã hoặc quét QR in trên phiếu.
 * Hệ thống kiểm tra trước rồi mới cho áp dụng.
 *
 * <p><b>Luôn kiểm tra trước khi áp dụng.</b> Nhân viên đang đứng trước mặt khách cần biết
 * ngay voucher trừ được bao nhiêu và vì sao không dùng được — chứ không phải bấm áp dụng
 * rồi mới nhận thông báo lỗi và phải giải thích lại với khách.
 *
 * <p>Số tiền áp dụng mặc định là mức tối đa nhưng <b>sửa được</b>: voucher có hạn mức lớn
 * hơn đơn thì khách thường muốn giữ phần dư cho lần sau.
 */
export default function VoucherPaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [amount, setAmount] = useState('');
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef(null);

  const orderId = order?.id;

  const doCheck = useCallback(async (rawCode) => {
    const c = (rawCode ?? code).trim();
    if (!c) { toast('Vui lòng nhập mã voucher', 'error'); return; }
    setChecking(true);
    setPreview(null);
    try {
      const p = await voucherPaymentApi.preview(orderId, c);
      setPreview(p);
      if (p?.applicable) setAmount(String(Math.round(p.applicableAmount || 0)));
    } catch (e) {
      toast(e?.message || 'Không kiểm tra được voucher', 'error');
    } finally { setChecking(false); }
  }, [code, orderId, toast]);

  const handleApply = async () => {
    if (!preview?.applicable) return;
    const value = Number(amount);
    if (!value || value <= 0) { toast('Số tiền phải lớn hơn 0', 'error'); return; }
    if (value > (preview.applicableAmount || 0)) {
      toast('Số tiền vượt quá mức voucher áp dụng được', 'error'); return;
    }

    setApplying(true);
    try {
      const res = await voucherPaymentApi.redeem(orderId, preview.voucherCode, value);
      toast(`Đã thanh toán ${formatVND(res.appliedAmount)} bằng voucher`, 'success');
      onSuccess?.(res);
      onClose();
    } catch (e) {
      toast(e?.message || 'Áp dụng voucher thất bại', 'error');
    } finally { setApplying(false); }
  };

  /**
   * ĐỌC QR TỪ FILE ẢNH khách gửi.
   *
   * <p>Dùng `createImageBitmap` + `BarcodeDetector` — cùng API với luồng camera, nên
   * không thêm thư viện nào. Trình duyệt không hỗ trợ thì báo để nhập tay; mã chỉ 12
   * ký tự nên gõ tay vẫn nhanh.
   */
  const scanImageFile = async (file) => {
    if (!('BarcodeDetector' in window)) {
      toast('Trình duyệt không hỗ trợ đọc QR từ ảnh. Vui lòng nhập mã bằng tay.', 'error');
      return;
    }
    setChecking(true);
    try {
      const bitmap = await createImageBitmap(file);
      // eslint-disable-next-line no-undef
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(bitmap);
      bitmap.close?.();

      const value = (codes?.[0]?.rawValue || '').trim();
      if (!value) {
        toast('Không tìm thấy mã QR trong ảnh. Thử ảnh rõ hơn hoặc nhập mã bằng tay.', 'error');
        return;
      }
      setCode(value);
      await doCheck(value);
    } catch {
      toast('Không đọc được ảnh. Vui lòng nhập mã bằng tay.', 'error');
    } finally { setChecking(false); }
  };

  const onScanned = (value) => {
    setScanning(false);
    setCode(value);
    doCheck(value);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-md max-h-[92vh] overflow-y-auto
                      rounded-t-3xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-surface border-b border-hairline px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink text-base flex items-center gap-2">
              <Ticket size={17} className="text-gold" /> Thanh toán bằng voucher
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Đơn {order?.orderCode} · còn thiếu {formatVND(remainingOf(order))}
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-canvas">
            <X size={17} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Nhập mã / quét QR */}
          <div>
            <Label>Mã voucher</Label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={e => { setCode(e.target.value); setPreview(null); }}
                onKeyDown={e => { if (e.key === 'Enter') doCheck(); }}
                placeholder="VD: VC-2608-A3F9K2"
                autoFocus
                className="flex-1 rounded-xl border border-line px-3 py-2 text-sm font-mono tracking-wide
                           text-ink bg-surface focus:outline-none focus:border-gold transition-colors
                           placeholder:text-faint placeholder:font-sans placeholder:tracking-normal" />
              <button onClick={() => setScanning(s => !s)} title="Quét QR bằng camera"
                className={`w-11 rounded-xl border flex items-center justify-center transition-colors
                  ${scanning ? 'bg-gold text-white border-gold' : 'border-line text-ink-2 hover:border-gold hover:text-gold'}`}>
                <ScanLine size={17} />
              </button>
              {/* Khách thường chụp lại phiếu rồi gửi qua Zalo — nhân viên chọn đúng ảnh đó
                  thay vì phải mở phiếu giấy ra soi camera. */}
              <button onClick={() => fileRef.current?.click()} title="Chọn ảnh voucher có QR"
                className="w-11 rounded-xl border border-line text-ink-2 hover:border-gold hover:text-gold
                           flex items-center justify-center transition-colors">
                <ImageUp size={17} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) scanImageFile(f); }} />
            </div>
          </div>

          {scanning && <QrScanner onScanned={onScanned} onError={() => setScanning(false)} />}

          <button onClick={() => doCheck()} disabled={checking || !code.trim()}
            className="w-full py-2.5 rounded-xl border border-gold text-gold text-sm font-semibold
                       hover:bg-gold/10 disabled:opacity-40 transition-colors
                       flex items-center justify-center gap-2">
            {checking ? <Loader2 size={15} className="animate-spin" /> : null}
            {checking ? 'Đang kiểm tra...' : 'Kiểm tra voucher'}
          </button>

          {/* Kết quả kiểm tra */}
          {preview && !preview.applicable && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30
                            bg-red-50 dark:bg-red-500/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300">
                <AlertTriangle size={14} /> Không dùng được voucher này
              </p>
              <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-1">{preview.reason}</p>
            </div>
          )}

          {preview?.applicable && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30
                              bg-emerald-50 dark:bg-emerald-500/10 p-3 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} /> Voucher hợp lệ
                </p>
                <InfoRow label="Chủ voucher" value={preview.customerName || '—'} />
                <InfoRow label="Số dư voucher" value={formatVND(preview.voucherRemaining)} />
                <InfoRow label="Đơn còn thiếu" value={formatVND(preview.orderRemaining)} />
                {preview.applyScope !== 'ALL' && (
                  <InfoRow label="Tiền hàng đủ điều kiện" value={formatVND(preview.eligibleSubtotal)} />
                )}
                <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-500/25">
                  <InfoRow label="Trừ được tối đa"
                    value={formatVND(preview.applicableAmount)} strong />
                </div>
              </div>

              <div>
                <Label>Số tiền sử dụng</Label>
                <input type="number" min="0" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm text-ink bg-surface
                             focus:outline-none focus:border-gold transition-colors" />
                <p className="text-[10px] text-faint mt-1">
                  Có thể nhập ít hơn để giữ số dư voucher cho lần mua sau. Phần còn lại của
                  đơn vẫn thu bằng tiền mặt hoặc chuyển khoản như bình thường.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-line text-sm font-semibold text-ink-2 hover:bg-canvas transition-colors">
              Huỷ
            </button>
            <button onClick={handleApply} disabled={!preview?.applicable || applying}
              className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold
                         hover:bg-gold-deep disabled:opacity-40 transition-colors
                         flex items-center justify-center gap-2">
              {applying ? <Loader2 size={15} className="animate-spin" /> : null}
              {applying ? 'Đang xử lý...' : 'Áp dụng voucher'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quét QR ──────────────────────────────────────────────────────────────────

/**
 * Quét QR bằng camera, dùng API `BarcodeDetector` có sẵn của trình duyệt.
 *
 * <p>Cố ý KHÔNG thêm thư viện quét mã: Chrome/Edge trên Android và desktop đều đã hỗ trợ
 * sẵn, và đó là môi trường nhân viên đang dùng. Trình duyệt không hỗ trợ (Safari/iOS,
 * Firefox) sẽ hiện hướng dẫn nhập tay — mã voucher chỉ 12 ký tự, gõ tay nhanh hơn nhiều
 * so với việc bắt cả công ty tải thêm vài trăm KB thư viện.
 *
 * <p>Cũng cần HTTPS: trình duyệt chặn camera trên kết nối không bảo mật.
 */
function QrScanner({ onScanned, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = null;

    (async () => {
      if (!('BarcodeDetector' in window)) {
        setError('Trình duyệt này không hỗ trợ quét QR. Vui lòng nhập mã bằng tay.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // eslint-disable-next-line no-undef
        const detector = new BarcodeDetector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length) {
              const value = (codes[0].rawValue || '').trim();
              if (value) { onScanned(value); return; }   // dừng vòng lặp sau khi bắt được
            }
          } catch { /* khung hình lỗi thì bỏ qua, thử khung kế tiếp */ }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch (e) {
        setError('Không truy cập được camera. Kiểm tra quyền truy cập hoặc nhập mã bằng tay.');
        onError?.(e);
      }
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      // Bắt buộc tắt stream khi đóng: để hở thì đèn camera vẫn sáng và máy nóng lên
      // dù người dùng đã chuyển sang việc khác.
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onScanned, onError]);

  if (error) {
    return (
      <div className="rounded-xl border border-line bg-canvas p-3 flex items-start gap-2">
        <CameraOff size={15} className="text-muted mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted leading-relaxed">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gold/40 bg-black">
      <video ref={videoRef} playsInline muted className="w-full h-44 object-cover" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 border-2 border-gold rounded-xl" />
      </div>
      <p className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-white/80">
        Đưa mã QR trên phiếu vào khung
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function InfoRow({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-emerald-700/70 dark:text-emerald-300/70">{label}</span>
      <span className={`text-emerald-800 dark:text-emerald-200 ${strong ? 'font-bold text-xs' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}

function formatVND(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' đ';
}

function remainingOf(order) {
  const fin = Number(order?.finalAmount) || 0;
  const paid = Number(order?.paidAmount) || 0;
  return Math.max(0, fin - paid);
}
