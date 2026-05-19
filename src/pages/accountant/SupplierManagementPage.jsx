// src/pages/accountant/SupplierManagementPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, Phone, MapPin, Mail, User } from 'lucide-react';
import { accountantSupplierApi } from '../../api/accountantApi';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

const EMPTY_FORM = { name: '', phone: '', address: '', email: '', contactPerson: '', note: '' };

export default function SupplierManagementPage() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountantSupplierApi.search({ q, page, size: PAGE_SIZE });
      setSuppliers(res.data?.data?.content || []);
      setTotal(res.data?.data?.totalElements || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (s) => { setEditItem(s); setForm({ name: s.name || '', phone: s.phone || '', address: s.address || '', email: s.email || '', contactPerson: s.contactPerson || '', note: s.note || '' }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Tên nhà cung cấp là bắt buộc', 'error'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await accountantSupplierApi.update(editItem.id, form);
        toast('Cập nhật thành công', 'success');
      } else {
        await accountantSupplierApi.create(form);
        toast('Tạo thành công', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xác nhận ẩn nhà cung cấp này?')) return;
    try {
      await accountantSupplierApi.deactivate(id);
      toast('Đã ẩn nhà cung cấp', 'success');
      load();
    } catch (e) {
      toast('Lỗi', 'error');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1E] flex items-center gap-2">
            <Building2 size={24} className="text-[#C9A84C]" /> Nhà cung cấp
          </h1>
          <p className="text-sm text-[#8E8878] mt-1">Quản lý danh sách nhà cung cấp</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C9A84C] text-white rounded-xl font-semibold hover:bg-[#B8923E] transition"
        >
          <Plus size={16} /> Thêm mới
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-black/5 p-4 shadow-sm">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Tìm kiếm tên, số điện thoại..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-12 text-[#8E8878]">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Chưa có nhà cung cấp nào</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#FAF7F2] border-b border-black/5">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-[#1C1C1E]">Tên</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1C1C1E] hidden md:table-cell">Liên hệ</th>
                <th className="text-left px-4 py-3 font-semibold text-[#1C1C1E] hidden lg:table-cell">Địa chỉ</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-[#FAF7F2]/50 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1C1C1E]">{s.name}</p>
                    {s.contactPerson && <p className="text-xs text-[#8E8878]">{s.contactPerson}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[#555]">
                    {s.phone && <div className="flex items-center gap-1"><Phone size={12} /> {s.phone}</div>}
                    {s.email && <div className="flex items-center gap-1 mt-0.5"><Mail size={12} /> {s.email}</div>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[#555] text-xs">{s.address}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-black/5">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${page === i ? 'bg-[#C9A84C] text-white' : 'hover:bg-[#FAF7F2] text-[#555]'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editItem ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}>
        <div className="space-y-4 mt-4">
          {[
            { key: 'name', label: 'Tên nhà cung cấp *', icon: Building2, placeholder: 'VD: Công ty TNHH ABC' },
            { key: 'contactPerson', label: 'Người liên hệ', icon: User, placeholder: 'Tên người liên hệ' },
            { key: 'phone', label: 'Số điện thoại', icon: Phone, placeholder: '0xxx xxx xxx' },
            { key: 'email', label: 'Email', icon: Mail, placeholder: 'example@email.com' },
            { key: 'address', label: 'Địa chỉ', icon: MapPin, placeholder: 'Địa chỉ nhà cung cấp' },
          ].map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
                <input
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-sm font-semibold text-[#1C1C1E] mb-1">Ghi chú</label>
            <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              rows={2} placeholder="Ghi chú thêm..."
              className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setModalOpen(false)}
            className="flex-1 py-2.5 rounded-xl border border-black/10 text-[#555] hover:bg-gray-50 font-medium transition">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white font-semibold hover:bg-[#B8923E] transition disabled:opacity-50">
            {saving ? 'Đang lưu...' : (editItem ? 'Cập nhật' : 'Tạo mới')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
