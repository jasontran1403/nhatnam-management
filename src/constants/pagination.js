// src/constants/pagination.js
//
// KÍCH THƯỚC TRANG DÙNG CHUNG.
//
// Trước đây mỗi trang tự đặt số item/trang (phiếu thu: kế toán = 10, admin/owner = 20)
// → cùng 1 dữ liệu nhưng số trang khác nhau tuỳ role, rất khó đối chiếu.
// Mọi màn hình danh sách phiếu thu/phiếu chi phải dùng chung hằng số này.

/** Số phiếu thu / phiếu chi hiển thị trên 1 trang — DÙNG CHUNG cho MỌI role. */
export const VOUCHER_PAGE_SIZE = 20;
