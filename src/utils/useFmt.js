// src/utils/useFmt.js
//
// Format ngày / số / tiền theo ngôn ngữ đang chọn.
// Thay cho fmtDate/fmtNum/fmtCurrency trong productionModuleApi.js (khoá cứng 'vi-VN')
// và mọi chỗ gọi toLocaleDateString('vi-VN') / Intl.NumberFormat('vi-VN') trong pages/.
//
// Dùng:
//   const { fmtDate, fmtNum, fmtCurrency, fmtDateTime, monthShort } = useFmt();
//
import { useMemo } from 'react';
import { useLang } from '../context/LangContext';

export function useFmt() {
  const { lang } = useLang();
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';

  return useMemo(() => ({
    loc,
    lang,

    /** 01/07/2026 — 07/01/2026 */
    fmtDate: (ms) => ms
      ? new Date(Number(ms)).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—',

    /** 01/07/2026 14:30 */
    fmtDateTime: (ms) => ms
      ? new Date(Number(ms)).toLocaleString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—',

    /** 1.234,5 — 1,234.5 */
    fmtNum: (v, maxFrac = 0) =>
      new Intl.NumberFormat(loc, { maximumFractionDigits: maxFrac }).format(Number(v || 0)),

    /** 1.234.567₫ — 1,234,567 VND */
    fmtCurrency: (v) => lang === 'vi'
      ? new Intl.NumberFormat('vi-VN').format(Math.round(Number(v || 0))) + '₫'
      : new Intl.NumberFormat('en-US').format(Math.round(Number(v || 0))) + ' VND',

    /** Nhãn trục biểu đồ / Gantt */
    monthShort:   (d) => new Date(d).toLocaleDateString(loc, { month: 'short' }),
    weekdayShort: (d) => new Date(d).toLocaleDateString(loc, { weekday: 'short' }),
    weekdayLong:  (d) => new Date(d).toLocaleDateString(loc, { weekday: 'long' }),
  }), [lang, loc]);
}

export default useFmt;