import { useState, useEffect } from 'react';
import { X, CheckCircle, Settings, Edit3, ChevronDown, ChevronUp, Package, User, FileText } from 'lucide-react';
import { accountantApi } from '../../api/services';
import { useToast } from '../common/Toast';
import { formatPrice } from '../../utils/formatPrice';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MisaOrderModal({ order, isViewMode, onClose, onSuccess }) {
  const toast = useToast();
  const [tab, setTab] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [manualItems, setManualItems] = useState([]);

  useEffect(() => {
    if (isViewMode && order?.id) {
      setViewLoading(true);
      accountantApi.getMisaOrder(order.id)
        .then(r => setViewData(r.data?.data))
        .catch(() => {})
        .finally(() => setViewLoading(false));
    }
  }, [isViewMode, order?.id]);

  useEffect(() => {
    if (!isViewMode && order?.items) {
      setManualItems(order.items.map(item => {
        const qty = Number(item.quantity ?? 1);
        const hasConversion = item.conversionUnit && item.conversionFactor > 0;
        const convertedQty = hasConversion
          ? parseFloat((qty * Number(item.conversionFactor)).toFixed(3))
          : qty;
        const convertedUnit = hasConversion ? item.conversionUnit : item.unit;
        return {
          productId: item.productId,
          productName: item.productName,
          originalQty: qty,
          originalUnit: item.unit,
          quantity: convertedQty,
          unit: convertedUnit,
          unitPrice: Number(item.unitPrice ?? 0),
          discount: 0,
          fee: 0,
          hasConversion,
          conversionUnit: item.conversionUnit,
          conversionFactor: item.conversionFactor,
        };
      }));
    }
  }, [isViewMode, order?.items]);

  const updateItem = (idx, patch) => {
    setManualItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const payload = {
        mode: tab === 'auto' ? 'AUTO' : 'MANUAL',
        items: tab === 'manual' ? manualItems.map(it => ({
          productName: it.productName,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discount: it.discount,
          fee: it.fee,
        })) : [],
      };
      await accountantApi.createMisaOrder(order.id, payload);
      toast('Tạo đơn Misa thành công', 'success');
      onSuccess?.();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi tạo đơn Misa', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ═══ VIEW MODE ═══════════════════════════════════════════════════════════
  if (isViewMode) {
    const payload = viewData?.payload;
    const voucher = payload?.voucher?.[0];
    const details = voucher?.detail || [];

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}>

          <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">Đơn Misa</p>
              <h3 className="font-bold text-ink font-mono text-sm">{viewData?.misaOrderCode || '...'}</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted"><X size={15} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {viewLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : viewData ? (
              <>
                {/* Thông tin chung */}
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/28 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Mã đơn Misa</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-300">{viewData.misaOrderCode}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Mã đơn gốc</span>
                    <span className="font-mono font-bold text-gold">{viewData.orderCode}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Tổng tiền</span>
                    <span className="font-bold text-ink">{formatPrice(viewData.finalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Ngày tạo</span>
                    <span className="text-ink">{formatDate(viewData.createdAt)}</span>
                  </div>
                </div>

                {/* Trạng thái sync */}
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2">
                  <CheckCircle size={14} />
                  <span className="text-xs font-medium">
                    {viewData.sent ? 'Đã đồng bộ lên Misa' : 'Đã lưu payload (sandbox — chưa gửi Misa)'}
                  </span>
                </div>

                {/* Khách hàng */}
                {voucher && (
                  <div className="rounded-xl border border-line-soft overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-canvas border-b border-line-soft">
                      <User size={13} className="text-muted" />
                      <span className="text-xs font-semibold text-ink">Khách hàng</span>
                    </div>
                    <div className="p-4 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Mã KH (Misa)</span>
                        <span className="font-mono text-ink">{voucher.account_object_code || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted">Tên KH</span>
                        <span className="text-ink">{voucher.account_object_name || '—'}</span>
                      </div>
                      {voucher.account_object_address && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">Địa chỉ</span>
                          <span className="text-ink text-right max-w-[60%]">{voucher.account_object_address}</span>
                        </div>
                      )}
                      {voucher.employee_name && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">Nhân viên</span>
                          <span className="text-ink">{voucher.employee_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Chi tiết sản phẩm */}
                {details.length > 0 && (
                  <div className="rounded-xl border border-line-soft overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-canvas border-b border-line-soft">
                      <Package size={13} className="text-muted" />
                      <span className="text-xs font-semibold text-ink">Sản phẩm ({details.length})</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-canvas/50 border-b border-line-soft">
                            <th className="text-left px-3 py-2 font-bold text-muted">#</th>
                            <th className="text-left px-3 py-2 font-bold text-muted">Sản phẩm</th>
                            <th className="text-center px-2 py-2 font-bold text-muted">SL</th>
                            <th className="text-center px-2 py-2 font-bold text-muted">ĐVT</th>
                            <th className="text-right px-2 py-2 font-bold text-muted">Đơn giá</th>
                            <th className="text-right px-3 py-2 font-bold text-muted">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map((d, i) => (
                            <tr key={i} className="border-b border-line-soft last:border-0">
                              <td className="px-3 py-2 text-muted">{d.sort_order || i + 1}</td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-ink">{d.inventory_item_name}</p>
                                <p className="text-[10px] text-muted font-mono">{d.inventory_item_code}</p>
                                {d.main_unit_name && d.main_unit_name !== d.unit_name && (
                                  <p className="text-[10px] text-blue-500 mt-0.5">
                                    Quy đổi: {d.main_quantity} {d.main_unit_name} (×{d.main_convert_rate})
                                  </p>
                                )}
                              </td>
                              <td className="px-2 py-2 text-center font-bold">{d.quantity}</td>
                              <td className="px-2 py-2 text-center">{d.unit_name}</td>
                              <td className="px-2 py-2 text-right">{formatPrice(d.unit_price)}</td>
                              <td className="px-3 py-2 text-right font-bold">{formatPrice(d.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Raw payload JSON */}
                <div className="rounded-xl border border-line-soft overflow-hidden">
                  <button onClick={() => setShowPayload(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-canvas hover:bg-surface-2 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-muted" />
                      <span className="text-xs font-semibold text-ink">Raw Payload (JSON)</span>
                    </div>
                    {showPayload ? <ChevronUp size={13} className="text-muted" /> : <ChevronDown size={13} className="text-muted" />}
                  </button>
                  {showPayload && (
                    <div className="px-4 py-3 bg-surface border-t border-line-soft">
                      <pre className="text-[10px] text-muted overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted text-center py-4">Không tìm thấy dữ liệu</p>
            )}
          </div>

          <div className="px-5 pb-5 pt-2 flex-shrink-0">
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ CREATE MODE ═══════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider">Tạo đơn Misa</p>
            <h3 className="font-bold text-ink font-mono text-sm">{order?.orderCode}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted"><X size={15} /></button>
        </div>

        <div className="flex border-b border-line-soft flex-shrink-0">
          <button onClick={() => setTab('auto')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-colors
              ${tab === 'auto' ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-muted hover:text-ink'}`}>
            <Settings size={13} /> Tự động
          </button>
          <button onClick={() => setTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition-colors
              ${tab === 'manual' ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-muted hover:text-ink'}`}>
            <Edit3 size={13} /> Nhập tay
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'auto' ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Settings size={24} className="text-blue-500" />
              </div>
              <p className="text-sm font-medium text-ink">Tự động đồng bộ từ đơn hàng</p>
              <p className="text-xs text-muted text-center max-w-xs">
                Hệ thống sẽ tự động lấy thông tin sản phẩm, số lượng, giá từ đơn hàng <strong>{order?.orderCode}</strong> để tạo đơn trên Misa.
              </p>
              <div className="bg-canvas rounded-xl p-3 mt-2 w-full max-w-xs">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Tổng tiền</span>
                  <span className="font-bold text-ink">{formatPrice(order?.finalAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted mb-2">
                Chỉnh sửa thông tin sản phẩm trước khi gửi lên Misa.
                {manualItems.some(it => it.hasConversion) && (
                  <span className="text-blue-600 dark:text-blue-300 ml-1">
                    Sản phẩm có quy đổi đã được chuyển sang đơn vị quy đổi.
                  </span>
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-canvas border-b border-line-soft">
                      <th className="text-left px-3 py-2 font-bold text-muted">Sản phẩm</th>
                      <th className="text-center px-2 py-2 font-bold text-muted w-20">SL</th>
                      <th className="text-center px-2 py-2 font-bold text-muted w-16">ĐVT</th>
                      <th className="text-right px-2 py-2 font-bold text-muted w-24">Đơn giá</th>
                      <th className="text-right px-2 py-2 font-bold text-muted w-20">Giảm giá</th>
                      <th className="text-right px-2 py-2 font-bold text-muted w-20">Phí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-line-soft last:border-0">
                        <td className="px-3 py-2">
                          <input value={item.productName}
                            onChange={e => updateItem(idx, { productName: e.target.value })}
                            className="w-full bg-transparent outline-none text-ink font-medium" />
                          {item.hasConversion && (
                            <p className="text-[10px] text-blue-500 mt-0.5">
                              Gốc: {item.originalQty} {item.originalUnit} × {item.conversionFactor} = {item.quantity} {item.conversionUnit}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" step="0.001" value={item.quantity}
                            onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full text-center bg-canvas rounded-lg border border-line py-1 outline-none focus:border-gold" />
                        </td>
                        <td className="px-2 py-2">
                          <input value={item.unit}
                            onChange={e => updateItem(idx, { unit: e.target.value })}
                            className="w-full text-center bg-canvas rounded-lg border border-line py-1 outline-none focus:border-gold" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" value={item.unitPrice}
                            onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full text-right bg-canvas rounded-lg border border-line py-1 outline-none focus:border-gold" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" value={item.discount}
                            onChange={e => updateItem(idx, { discount: parseFloat(e.target.value) || 0 })}
                            className="w-full text-right bg-canvas rounded-lg border border-line py-1 outline-none focus:border-gold" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" value={item.fee}
                            onChange={e => updateItem(idx, { fee: parseFloat(e.target.value) || 0 })}
                            className="w-full text-right bg-canvas rounded-lg border border-line py-1 outline-none focus:border-gold" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-line-soft flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">Huỷ</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Đang tạo...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}