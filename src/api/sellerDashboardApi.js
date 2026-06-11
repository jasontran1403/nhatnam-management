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
};