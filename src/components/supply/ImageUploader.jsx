import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { supplyUploadApi } from '../../api/supplyApi';
import { useToast } from '../common/Toast';

/**
 * Upload ảnh chứng từ — dùng ở bước tất toán phiếu VPP.
 *
 * <p>Mỗi ảnh giữ 2 trạng thái: `preview` (blob URL hiện ngay để người dùng thấy
 * phản hồi tức thì) và `uploadedUrl` (URL thật từ server). Chỉ ảnh có
 * `uploadedUrl` mới được submit — vì vậy cần chặn submit khi còn ảnh đang upload,
 * nếu không sẽ gửi thiếu chứng từ một cách âm thầm.
 *
 * @param {string[]} value      danh sách URL đã upload
 * @param {Function} onChange   nhận mảng URL mới
 * @param {Function} onBusyChange  báo cho form cha biết còn ảnh đang upload
 */
export default function ImageUploader({ value = [], onChange, onBusyChange, label = 'Ảnh chứng từ' }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);   // [{ id, preview, uploading, url }]

  const sync = (next) => {
    setItems(next);
    const busy = next.some(i => i.uploading);
    onBusyChange?.(busy);
    onChange?.(next.filter(i => i.url).map(i => i.url));
  };

  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';   // cho phép chọn lại đúng file vừa xoá
    if (!files.length) return;

    const staged = files.map(f => ({
      id: `${Date.now()}-${Math.random()}`,
      preview: URL.createObjectURL(f),
      uploading: true,
      url: null,
      file: f,
    }));
    let next = [...items, ...staged];
    sync(next);

    for (const st of staged) {
      try {
        const url = await supplyUploadApi.uploadImage(st.file);
        next = next.map(i => (i.id === st.id ? { ...i, uploading: false, url } : i));
      } catch {
        toast('Lỗi upload ảnh', 'error');
        next = next.filter(i => i.id !== st.id);
        URL.revokeObjectURL(st.preview);
      }
      sync(next);
    }
  };

  const remove = (id) => {
    const target = items.find(i => i.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);
    sync(items.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-[#1C1C1E] uppercase tracking-wider">
        {label}
      </span>

      <div className="flex flex-wrap gap-2">
        {items.map(img => (
          <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-black/10">
            <img src={img.url || img.preview} alt="" className="w-full h-full object-cover" />
            {img.uploading ? (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-white" />
              </div>
            ) : (
              <button type="button" onClick={() => remove(img.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
                <X size={11} />
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-black/15 flex flex-col items-center justify-center text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors">
          <ImagePlus size={18} />
          <span className="text-[10px] mt-1">Thêm ảnh</span>
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  );
}
