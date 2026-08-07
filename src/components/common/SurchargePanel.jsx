const DEFAULT_SURCHARGE_TYPES = [
  { name: 'Thùng xốp',      placeholder: '20.000' },
  { name: 'Phí vận chuyển', placeholder: '30.000' },
  { name: 'Gửi xe',         placeholder: '10.000' },
  { name: 'Đá khô',         placeholder: '15.000' },
];
 
// surchargeItems: [{ name: string, amount: number }]
// onChange: (items) => void
function SurchargePanel({ surchargeItems, onChange }) {
  const [customName, setCustomName] = useState('');
 
  const getItem = (name) => surchargeItems.find(i => i.name === name);
  const getAmount = (name) => getItem(name)?.amount ?? '';
 
  const setAmount = (name, rawValue) => {
    const num = rawValue === '' ? 0 : parseInt(rawValue.replace(/[^0-9]/g, ''), 10) || 0;
    const exists = surchargeItems.find(i => i.name === name);
    let next;
    if (num === 0) {
      // Xóa khỏi list nếu = 0
      next = surchargeItems.filter(i => i.name !== name);
    } else if (exists) {
      next = surchargeItems.map(i => i.name === name ? { ...i, amount: num } : i);
    } else {
      next = [...surchargeItems, { name, amount: num }];
    }
    onChange(next);
  };
 
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    if (surchargeItems.find(i => i.name === name)) { setCustomName(''); return; }
    onChange([...surchargeItems, { name, amount: 0 }]);
    setCustomName('');
  };
 
  const removeItem = (name) => onChange(surchargeItems.filter(i => i.name !== name));
 
  // Phụ phí tùy chỉnh (không nằm trong DEFAULT_SURCHARGE_TYPES)
  const defaultNames = new Set(DEFAULT_SURCHARGE_TYPES.map(t => t.name));
  const customItems = surchargeItems.filter(i => !defaultNames.has(i.name));
 
  return (
    <div className="space-y-2">
      {/* Default types */}
      {DEFAULT_SURCHARGE_TYPES.map(type => {
        const val = getAmount(type.name);
        return (
          <div key={type.name} className="flex items-center gap-2">
            <span className="text-[11px] text-ink-2 font-medium w-28 shrink-0">{type.name}</span>
            <div className="relative flex-1">
              <input
                type="text"
                inputMode="numeric"
                value={val === 0 || val === '' ? '' : new Intl.NumberFormat('vi-VN').format(val)}
                onChange={e => setAmount(type.name, e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={type.placeholder}
                className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-right pr-6 focus:outline-none focus:border-gold"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
            </div>
          </div>
        );
      })}
 
      {/* Custom items */}
      {customItems.map(item => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="text-[11px] text-ink-2 font-medium w-28 shrink-0 truncate">{item.name}</span>
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="numeric"
              value={item.amount === 0 ? '' : new Intl.NumberFormat('vi-VN').format(item.amount)}
              onChange={e => setAmount(item.name, e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full rounded-lg border border-line px-2 py-1.5 text-xs text-right pr-6 focus:outline-none focus:border-gold"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
          </div>
          <button onClick={() => removeItem(item.name)} className="text-faint hover:text-red-400">
            <X size={12} />
          </button>
        </div>
      ))}
 
      {/* Add custom */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCustom(); }}
          placeholder="+ Thêm phụ phí khác..."
          className="flex-1 rounded-lg border border-dashed border-line px-2 py-1.5 text-[11px] focus:outline-none focus:border-gold text-muted"
        />
        {customName.trim() && (
          <button onClick={addCustom} className="px-2 py-1.5 rounded-lg bg-gold text-white text-[10px] font-semibold">
            Thêm
          </button>
        )}
      </div>
    </div>
  );
}
