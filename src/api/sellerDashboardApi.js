// src/api/sellerDashboardApi.js
import api from './axios';

export const sellerDashboardApi = {
  /**
   * Lấy toàn bộ dashboard trong 1 call.
   * @param {number} from   Epoch-ms
   * @param {number} to     Epoch-ms
   * @param {string} groupBy  'HOUR' | 'DAY' | 'MONTH'
   * @param {number} topN   mặc định 10
   */
  async getDashboard(from, to, groupBy, topN = 10) {
    const params = { topN };
    if (from)    params.from    = from;
    if (to)      params.to      = to;
    if (groupBy) params.groupBy = groupBy;

    const res = await api.get('/api/seller/dashboard', { params });
    return res.data?.data ?? res.data;
  },

  /**
   * Thống kê khách mới / khách cũ trong kỳ [from, to].
   *
   * LOGIC:
   *   Khách MỚI = có đơn trong [from, to]  VÀ  không có đơn nào trước `from`
   *   Khách CŨ  = có đơn trong [from, to]  VÀ  có ít nhất 1 đơn trước `from`
   *   → Mỗi khách chỉ đếm 1 lần dù tạo N đơn trong kỳ
   *
   * Ví dụ — đang chọn "hôm nay":
   *   Khách A: 8 đơn hôm nay, không có đơn nào trước hôm nay → KHÁCH MỚI
   *   Khách B: 1 đơn hôm nay, đã có đơn từ tuần trước       → KHÁCH CŨ
   *
   * SQL GỢI Ý CHO BACKEND:
   *
   *   WITH customers_in_period AS (
   *     SELECT DISTINCT customer_id
   *     FROM orders
   *     WHERE created_at BETWEEN :from AND :to
   *       AND customer_id IS NOT NULL
   *   ),
   *   has_order_before AS (
   *     SELECT DISTINCT customer_id
   *     FROM orders
   *     WHERE created_at < :from
   *       AND customer_id IS NOT NULL
   *   )
   *   SELECT
   *     COUNT(*)                                                    AS total_customers,
   *     SUM(CASE WHEN h.customer_id IS NULL     THEN 1 ELSE 0 END) AS new_customers,
   *     SUM(CASE WHEN h.customer_id IS NOT NULL THEN 1 ELSE 0 END) AS returning_customers
   *   FROM customers_in_period c
   *   LEFT JOIN has_order_before h ON h.customer_id = c.customer_id
   *
   * Response mong đợi:
   * {
   *   totalCustomers: number,
   *   newCustomers: number,
   *   returningCustomers: number
   * }
   */
  async getCustomerStats(from, to) {
    const params = {};
    if (from) params.from = from;
    if (to)   params.to   = to;
    const res = await api.get('/api/seller/dashboard/customer-stats', { params });
    return res.data?.data ?? res.data;
  },
};
