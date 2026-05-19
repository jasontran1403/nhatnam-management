// src/pages/accountant/AccountantWarehouseReceiptsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Warehouse, DollarSign, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { accountantWarehouseApi } from '../../api/accountantApi';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0);
}
function parseNum(s) {
  return Number(String(s).replace(/[^0-9]/g, '')) || 0;
}
function fmtInput(s) {
  if (!s) return '';
  const n = parseNum(s);
  return n ? new Intl.NumberFormat('vi-VN').format(n) : '';
}

export default function AccountantWarehouseReceiptsPage() {
  const toast = useToast();
  const [receipts, setReceipts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [costInputs, setCostInputs]     = useState({});
  const [confirming, setConfirming]     = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountantWarehouseApi.getPendingCost();
      setReceipts(res.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const openDetail = async (receiptId) => {
    try {
      const res = await accountantWarehouseApi.getDetail(receiptId);
      const receipt = res.data?.data;
      setSelectedReceipt(receipt);
      const init = {};
      (receipt?.items || []).forEach(item => { init[item.id] = ''; });
      setCostInputs(init);
      setDetailOpen(true);
    } catch (e) {
      toast('Lỗi tải chi tiết phiếu', 'error');
    }
  };

  const handleConfirmCost = async () => {
    if (!selectedReceipt) return;
    const items = selectedReceipt.items || [];
    for (const item of items) {
      const cost = parseNum(costInputs[item.id]);
      if (!cost || cost <= 0) {
        toast(`Vui lòng nhập giá vốn cho: ${item.ingredientName}`, 'error');
        return;
      }
    }
    setConfirming(true);
    try {
      const payload = {
        items: items.map(item => ({
          receiptItemId: item.id,
          costPrice: parseNum(costInputs[item.id]),
        })),
      };
      await accountantWarehouseApi.confirmCost(selectedReceipt.id, payload);
      toast('Đã xác nhận giá vốn và cộng tồn kho!', 'success');
      setDetailOpen(false);
      loadPending();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi xác nhận', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const totalCost = selectedReceipt
    ? (selectedReceipt.items || []).reduce((sum, item) => {
        const cost = parseNum(costInputs[item.id]);
        return sum + cost * Number(item.quantity || 0);
      }, 0)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">

      {/* Header với nút Refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Warehouse size={24} className="text-[#C9A84C]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1C1C1E]">Phiếu nhập kho chờ giá vốn</h1>
            <p className="text-sm text-[#8E8878]">Nhập giá vốn để xác nhận và cộng tồn kho</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="bg-orange-100 text-orange-700 text-sm font-semibold px-3 py-1 rounded-full">
            {receipts.length} chờ xử lý
          </span>
          <button
            onClick={loadPending}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-sm text-[#555] hover:bg-[#FAF7F2] transition disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm text-center py-16">
          <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
          <p className="text-lg font-semibold text-[#1C1C1E]">Không có phiếu chờ xử lý</p>
          <p className="text-sm text-[#8E8878] mt-1">Tất cả phiếu nhập kho đã được xác nhận giá vốn</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {receipts.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#C9A84C]">{r.receiptCode}</span>
                    <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      <Clock size={11} /> Chờ giá vốn
                    </span>
                  </div>
                  <p className="text-[#1C1C1E] font-medium mt-1">{r.warehouseName}</p>
                  <p className="text-xs text-[#8E8878] mt-0.5">
                    Người tạo: {r.createdByName} · {r.itemCount} mặt hàng
                    {r.referenceCode && ` · Mã NCC: ${r.referenceCode}`}
                  </p>
                </div>
                <button
                  onClick={() => openDetail(r.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#C9A84C] text-white rounded-xl text-sm font-semibold hover:bg-[#B8923E] transition"
                >
                  <DollarSign size={14} /> Nhập giá vốn
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)}
        title={`Nhập giá vốn — ${selectedReceipt?.receiptCode}`}>
        {selectedReceipt && (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-[#8E8878]">
              Kho: <span className="font-semibold text-[#1C1C1E]">{selectedReceipt.warehouseName}</span>
              {selectedReceipt.referenceCode && ` · NCC: ${selectedReceipt.referenceCode}`}
            </p>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {(selectedReceipt.items || []).map(item => (
                <div key={item.id} className="bg-[#FAF7F2] rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1C1C1E] text-sm">{item.ingredientName}</p>
                      <p className="text-xs text-[#8E8878]">
                        SL: <span className="font-medium text-[#1C1C1E]">{item.quantity} {item.unit}</span>
                        {item.expiryDate && ` · HSD: ${item.expiryDate}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-xs font-semibold text-[#1C1C1E] mb-1 block">
                      Giá vốn / đơn vị (đ) *
                    </label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fmtInput(costInputs[item.id])}
                        onChange={e => {
                          const raw = parseNum(e.target.value);
                          setCostInputs(p => ({ ...p, [item.id]: raw ? String(raw) : '' }));
                        }}
                        placeholder="Nhập giá vốn..."
                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                      />
                    </div>
                    {costInputs[item.id] && (
                      <p className="text-xs text-[#8E8878] mt-0.5">
                        Tổng: <span className="font-semibold text-[#1C1C1E]">
                          {fmt(parseNum(costInputs[item.id]) * Number(item.quantity || 0))} đ
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-800">Tổng giá vốn nhập kho</span>
              <span className="text-lg font-bold text-amber-800">{fmt(totalCost)} đ</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDetailOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-black/10 text-[#555] hover:bg-gray-50 font-medium transition">
                Huỷ
              </button>
              <button onClick={handleConfirmCost} disabled={confirming}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {confirming
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <CheckCircle size={16} />}
                {confirming ? 'Đang xác nhận...' : 'Xác nhận & Cộng tồn kho'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}