// src/components/admin/UserRequestsModal.jsx
//
// DUYỆT PHIẾU NGHỈ / OT CỦA MỘT NHÂN VIÊN — mở từ nút trên dòng nhân viên.
//
// Dùng lại nguyên EmployeeRequestsPanel với prop `userId` thay vì viết lại luồng
// duyệt: mọi quy tắc (chia ngày phép / không lương, trừ công, bắt buộc lý do khi
// từ chối, thông báo WebSocket về người tạo đơn) đã nằm trong panel đó. Viết bản
// thứ hai đồng nghĩa với việc phải sửa hai chỗ mỗi lần quy trình đổi.
import EmployeeRequestsPanel from '../hr/EmployeeRequestsPanel';
import Modal from '../ui/Modal';
import { SecondaryButton } from '../ui';

export default function UserRequestsModal({ user, onClose }) {
  return (
    <Modal
      open
      onClose={() => onClose?.()}
      title={`Phiếu nghỉ / OT — ${user.fullName || user.username}`}
      size="lg"
      footer={
        <div className="flex justify-end">
          <SecondaryButton onClick={() => onClose?.()}>Đóng</SecondaryButton>
        </div>
      }
    >
      <EmployeeRequestsPanel userId={user.id} />
    </Modal>
  );
}
