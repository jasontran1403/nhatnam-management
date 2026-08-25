// src/components/expense/VendorEmployeeDropdown.jsx
//
// Dropdown kết hợp: Nhân viên công ty ([NN]) + Nhà cung cấp ngoài.
// Dùng chung cho ExpenseCreateModal và ExpenseEditModal.
//
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, Plus, Building2, User } from 'lucide-react';
import { incomeApi } from '../../api/services';

/** Nhãn payrollRole → hiển thị */
function payrollRoleLabel(r) {
  const map = {
    SELLER: 'Kinh doanh', SUPER_SELLER: 'TP Kinh doanh', DRIVER: 'Tài xế',
    WAREHOUSE: 'Kho', SUPER_WAREHOUSE: 'TP Kho',
    ACCOUNTANT: 'Kế toán', SUPER_ACCOUNTANT: 'KT Trưởng',
    ADMIN: 'Quản trị', OWNER: 'Chủ',
    FACTORY_WORKER: 'CN Sản xuất', FACTORY_MANAGER: 'QL Sản xuất',
    FACTORY_STAFF: 'NV Xưởng', FACTORY_ACCOUNTANT: 'KT Xưởng',
    FACTORY_PRODUCTION_WORKER: 'CN Chế biến',
  };
  return map[r] || r || '';
}

const VENDOR_TYPE_LABELS = {
  MATERIAL: 'Nguyên liệu', MACHINE: 'Máy móc', REPAIR: 'Sửa chữa',
  ELECTRICITY: 'Điện', WATER: 'Nước', GAS: 'Gas',
  LOGISTICS: 'Vận chuyển', SERVICE: 'Dịch vụ',
  OFFICE_SUPPLIER: 'Văn phòng phẩm', TRUCKING_SERVICE: 'Dịch vụ xe tải',
  DELIVERY_SERVICE: 'Dịch vụ giao nhận', OFFICE_RENTAL: 'Thuê văn phòng',
  OTHER: 'Khác',
};

/**
 * @param {Object} props
 * @param {Object|null} props.selected        - { name, id?, vendorType?, isEmployee? }
 * @param {Function}    props.onSelect        - (selected) => void
 * @param {Array}       props.vendors         - danh sách NCC đã load
 * @param {boolean}     props.vendorLoading
 * @param {Function}    props.onQuickCreate   - () => void — mở modal tạo NCC nhanh
 */
export default function VendorEmployeeDropdown({
  selected, onSelect, vendors, vendorLoading, onQuickCreate,
}) {
  const dropRef = useRef();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Nhân viên
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const empDebounce = useRef(null);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const fn = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Tìm nhân viên khi search thay đổi
  const searchEmployees = useCallback(async (q) => {
    setEmpLoading(true);
    try {
      const res = await incomeApi.suggestEmployees(q || '');
      setEmployees(res.data?.data ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setEmpLoading(false);
    }
  }, []);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(empDebounce.current);
    empDebounce.current = setTimeout(() => searchEmployees(val), 400);
  };

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && employees.length === 0) searchEmployees('');
  };

  // Lọc NCC theo search
  const kw = search.trim().toLowerCase();
  const filteredVendors = kw
    ? vendors.filter(v =>
        v.name?.toLowerCase().includes(kw) ||
        (v.contactPhone && v.contactPhone.includes(kw)))
    : vendors;

  const filteredEmployees = employees; // đã lọc từ API

  const selectEmployee = (emp) => {
    onSelect({
      name: `[NN] ${emp.fullName}`,
      id: null,
      vendorType: null,
      isEmployee: true,
    });
    setOpen(false);
    setSearch('');
  };

  const selectVendor = (v) => {
    onSelect({
      name: v.name,
      id: v.id,
      vendorType: v.vendorType || null,
      contactPerson: v.contactPerson,
      contactPhone: v.contactPhone,
      isEmployee: false,
    });
    setOpen(false);
    setSearch('');
  };

  const noVendorResults = kw && filteredVendors.length === 0;

  return (
    <div className="relative" ref={dropRef}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border cursor-pointer transition ${
          !selected ? 'border-hairline-2 hover:border-gold' : 'border-gold bg-canvas'
        }`}
      >
        {selected ? (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{selected.name}</p>
            {!selected.isEmployee && selected.vendorType && (
              <p className="text-xs text-muted">
                {VENDOR_TYPE_LABELS[selected.vendorType] || selected.vendorType}
                {selected.contactPerson && ` · ${selected.contactPerson}`}
                {selected.contactPhone && ` · ${selected.contactPhone}`}
              </p>
            )}
            {selected.isEmployee && (
              <p className="text-xs text-muted">Nhân viên công ty</p>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted">
            {vendorLoading ? 'Đang tải...' : 'Chọn người nhận / nhà cung cấp...'}
          </span>
        )}
        <ChevronDown size={16} className={`text-muted transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-surface border border-hairline-2 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-hairline relative">
            <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Tìm nhân viên hoặc nhà cung cấp..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-hairline-2 focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Bỏ chọn */}
            {selected && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-muted hover:bg-canvas transition border-b border-hairline"
              >
                — Bỏ chọn —
              </button>
            )}

            {/* ── Section 1: Nhân viên công ty ── */}
            {filteredEmployees.length > 0 && (
              <>
                <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-500/10 border-b border-hairline">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1">
                    <User size={10} /> Nhân viên công ty
                  </p>
                </div>
                {filteredEmployees.map(emp => (
                  <button
                    key={`emp-${emp.id}`}
                    onClick={() => selectEmployee(emp)}
                    className="w-full text-left px-4 py-2.5 hover:bg-canvas transition border-b border-hairline last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink">{emp.fullName}</p>
                        {emp.position && <p className="text-xs text-muted">{emp.position}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* ── Section 2: Nhà cung cấp ngoài ── */}
            {filteredVendors.length > 0 && (
              <>
                <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-500/10 border-b border-hairline border-t border-hairline">
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    <Building2 size={10} /> Nhà cung cấp / Đơn vị ngoài
                  </p>
                </div>
                {filteredVendors.map(v => (
                  <button
                    key={`vendor-${v.id}`}
                    onClick={() => selectVendor(v)}
                    className="w-full text-left px-4 py-2.5 hover:bg-canvas transition border-b border-hairline last:border-0"
                  >
                    <p className="text-sm font-medium text-ink">{v.name}</p>
                    <p className="text-xs text-muted">
                      {VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType}
                      {v.contactPerson && ` · ${v.contactPerson}`}
                      {v.contactPhone && ` · ${v.contactPhone}`}
                    </p>
                  </button>
                ))}
              </>
            )}

            {/* Empty */}
            {filteredEmployees.length === 0 && filteredVendors.length === 0 && !empLoading && !vendorLoading && (
              <p className="text-center py-4 text-xs text-muted">Không tìm thấy kết quả</p>
            )}

            {(empLoading || vendorLoading) && filteredEmployees.length === 0 && filteredVendors.length === 0 && (
              <p className="text-center py-4 text-xs text-muted">Đang tải...</p>
            )}
          </div>

          {/* Nút tạo nhanh NCC */}
          {onQuickCreate && (
            <div className="p-2 border-t border-hairline">
              <button
                onClick={() => { onQuickCreate(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gold font-semibold hover:bg-canvas rounded-lg transition"
              >
                <Plus size={14} />
                {noVendorResults ? `Tạo "${search}"` : 'Tạo nhà cung cấp mới'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}