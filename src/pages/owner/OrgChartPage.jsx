// ═══════════════════════════════════════════════════════════════════════════
// SƠ ĐỒ TỔ CHỨC — OWNER/ADMIN xem cây tổ chức toàn công ty
//
// Data lấy từ /api/admin/users (department + position, KHÔNG dùng cột role).
// Layout dạng cây kiểu BOTTOM-UP: mỗi subtree được lay ở toạ độ tương đối
// [minX, minX+subtreeW], node cha đặt ở CENTER của các con → không đè nhau khi
// các subtree con có bề rộng chênh lệch. Cuối cùng chuẩn hoá minX về 0.
//
// Pan bằng kéo chuột, zoom bằng wheel/nút. Click vào một người mở modal xem
// chi tiết + chọn tháng để xem lương/công/km của người đó.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network, ZoomIn, ZoomOut, Maximize2, X as XIcon,
  Phone, Cake, CalendarDays, BriefcaseBusiness, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { adminUserApi } from '../../api/adminApi';
import { factoryPayrollApi } from '../../api/factoryPayrollApi';
import { PageHeader, LoadingSpinner, formatCurrency } from '../../components/ui';
import { BackButton } from '../../components/common/SubPageNav';
import { useToast } from '../../components/common/Toast';
import SalaryBreakdownCards from '../../components/hr/SalaryBreakdownCards';

// ── Chuẩn hoá chuỗi (bỏ dấu, thường, cắt khoảng trắng) ──────────────────────
const norm = (s) => (s || '')
  .normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'd')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Phân loại 1 user vào node trên cây. Trả null nếu không thuộc sơ đồ. */
function classify(u) {
  const dept = norm(u.department);
  const pos = norm(u.position);
  const both = pos + ' | ' + dept;
  if (/chu\s*tich/.test(both)) return 'CHAIRMAN';
  if (/giam\s*doc/.test(both)) return 'CEO';
  if (/kinh\s*doanh|sale|seller/.test(both)) {
    if (/truong|super|leader|manager/.test(pos)) return 'SALES_HEAD';
    return 'SALES_STAFF';
  }
  if (/kho\s*van|kho\b|warehouse/.test(both) && !/xuong|nha\s*may|factory/.test(both)) {
    if (/truong|super|leader|manager/.test(pos)) return 'WH_HEAD';
    return 'WH_STAFF';
  }
  if (/tai\s*xe|giao\s*hang|giao\s*nhan|shipper|driver/.test(both)) return 'DELIVERY';
  if (/xuong|nha\s*may|factory|san\s*xuat/.test(both)) {
    // "Quản lý xưởng" gộp chung với Trưởng xưởng — sơ đồ không còn node riêng
    // để không dài thêm 1 cấp. Ai giữ vai trò này sẽ hiện trong ô Trưởng xưởng.
    if (/truong\s*xuong|super\s*factory|truong\s*san\s*xuat|quan\s*ly\s*xuong|factory\s*manager/.test(pos))
      return 'FACT_HEAD';
    if (/tro\s*ly|assistant/.test(pos)) return 'FACT_ASSISTANT';
    if (/ke\s*toan|accountant/.test(pos)) return 'FACT_ACCT';
    return 'FACT_WORKER';
  }
  if (/ke\s*toan|accountant|finance/.test(both)) {
    if (/truong|super|chief|leader/.test(pos)) return 'ACCT_HEAD';
    return 'ACCT_STAFF';
  }
  return null;
}

/** Node của người này thuộc "loại lương" nào để load API tương ứng. */
function payrollKindOf(nodeKey) {
  if (nodeKey === 'DELIVERY') return 'DRIVER';
  if (nodeKey && nodeKey.startsWith('FACT_')) return 'FACTORY';
  return 'GENERIC';   // các bộ phận khác — chỉ hiển thị breakdown chung
}

// ── Cấu trúc cây tĩnh + label ────────────────────────────────────────────────
const NODE_META = {
  CHAIRMAN: { title: 'Chủ tịch', accent: 'from-red-500/20 to-red-500/5 border-red-500/40' },
  CEO: { title: 'Giám đốc', accent: 'from-orange-500/20 to-orange-500/5 border-orange-500/40' },

  // Header phòng ban — chỉ label tên phòng, không có người, để nhìn 1 cái là
  // biết nhánh dưới thuộc phòng nào. Style đậm hơn các node dưới.
  SALES_DEPT: { title: 'Phòng Kinh doanh', accent: 'from-blue-500/25 to-blue-500/8 border-blue-500/50', department: true },
  WH_DEPT: { title: 'Phòng Kho vận', accent: 'from-amber-500/25 to-amber-500/8 border-amber-500/50', department: true },
  FACT_DEPT: { title: 'Phòng Sản xuất', accent: 'from-purple-500/25 to-purple-500/8 border-purple-500/50', department: true },
  ACCT_DEPT: { title: 'Phòng Kế toán', accent: 'from-emerald-500/25 to-emerald-500/8 border-emerald-500/50', department: true },

  SALES_HEAD: { title: 'Trưởng phòng Kinh doanh', accent: 'from-blue-500/20 to-blue-500/5 border-blue-500/40' },
  SALES_STAFF: { title: 'Nhân viên Kinh doanh', accent: 'from-blue-500/10 to-transparent border-blue-500/28' },
  WH_HEAD: { title: 'Trưởng kho', accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/40' },
  WH_STAFF: { title: 'Nhân viên kho', accent: 'from-amber-500/10 to-transparent border-amber-500/28' },
  DELIVERY: { title: 'Nhân viên giao nhận', accent: 'from-amber-500/10 to-transparent border-amber-500/28' },
  FACT_HEAD: { title: 'Trưởng xưởng', accent: 'from-purple-500/20 to-purple-500/5 border-purple-500/40' },
  FACT_MANAGER: { title: 'Quản lý xưởng', accent: 'from-purple-500/15 to-transparent border-purple-500/34' },
  FACT_ASSISTANT: { title: 'Trợ lý xưởng', accent: 'from-purple-500/10 to-transparent border-purple-500/28' },
  FACT_ACCT: { title: 'Kế toán xưởng', accent: 'from-purple-500/10 to-transparent border-purple-500/28' },
  FACT_WORKER: { title: 'Công nhân sản xuất', accent: 'from-purple-500/10 to-transparent border-purple-500/28' },
  ACCT_HEAD: { title: 'Kế toán trưởng', accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/40' },
  ACCT_STAFF: { title: 'Chuyên viên kế toán', accent: 'from-emerald-500/10 to-transparent border-emerald-500/28' },
};

const TREE = {
  key: 'CHAIRMAN',
  children: [{
    key: 'CEO',
    children: [
      {
        key: 'SALES_DEPT', children: [
          { key: 'SALES_HEAD', children: [{ key: 'SALES_STAFF' }] },
        ]
      },
      {
        key: 'WH_DEPT', children: [
          { key: 'WH_HEAD', children: [{ key: 'WH_STAFF' }, { key: 'DELIVERY' }] },
        ]
      },
      {
        key: 'FACT_DEPT', children: [
          {
            key: 'FACT_HEAD', children: [
              { key: 'FACT_ASSISTANT' },
              { key: 'FACT_ACCT' },
              { key: 'FACT_WORKER' },
            ]
          },
        ]
      },
      {
        key: 'ACCT_DEPT', children: [
          { key: 'ACCT_HEAD', children: [{ key: 'ACCT_STAFF' }] },
        ]
      },
    ],
  }],
};

// ── Hằng số layout ───────────────────────────────────────────────────────────
const NODE_W = 220;
const NODE_H_BASE = 56;
const PERSON_H = 38;
const H_GAP = 40;
const V_GAP = 70;

// Chip mỗi người khi render NGANG — hẹp hơn card gốc để 3-5 người vẫn vừa
// màn hình. Đủ chỗ ghi tên đầy đủ + chức vụ ngắn.
const PERSON_CHIP_W = 180;
const CHIP_GAP = 8;

/**
 * Các cấp có nhiều người cùng vai trò thì render NGANG (2 giám đốc, 3
 * chuyên viên kế toán…). Các key cấp cao đều được thêm ở đây; các key
 * "STAFF" giữ dọc vì thường có nhiều người, layout ngang sẽ tràn.
 */
const HORIZONTAL_KEYS = new Set([
  'CHAIRMAN', 'CEO',
  'SALES_HEAD', 'WH_HEAD', 'FACT_HEAD',
  'FACT_ASSISTANT', 'ACCT_HEAD',
]);

/** Kích thước card theo layout người bên trong. */
function nodeSize(key, people) {
  const meta = NODE_META[key];
  if (meta?.department) {
    // Header phòng ban: chỉ 1 dòng title, không có body
    return { w: NODE_W, h: 44 };
  }
  if (HORIZONTAL_KEYS.has(key) && people.length > 1) {
    const chipsW = people.length * PERSON_CHIP_W + (people.length - 1) * CHIP_GAP;
    const w = Math.max(NODE_W, chipsW + 24);
    // header + 1 hàng chip (cao ~ PERSON_H) + padding
    const h = NODE_H_BASE + PERSON_H + 16;
    return { w, h };
  }
  // Vertical list
  const w = NODE_W;
  if (people.length === 0) {
    // chỉ có dòng “— chưa có nhân sự —”
    return { w, h: NODE_H_BASE };
  }
  // header + p-2 (16px) + N * button + (N-1) * space-y-1 (4px)
  const contentH = 16 + people.length * PERSON_H + Math.max(0, people.length - 1) * 4;
  const h = NODE_H_BASE + contentH;
  return { w, h };
}

/**
 * BOTTOM-UP LAYOUT — đặt cha ở CENTER của các con thay vì shift con để căn giữa
 * dưới cha. Tránh việc con bị đè lên subtree hàng xóm khi bề rộng subtree lệch nhau.
 *
 * Mỗi subtree trả về:
 *   x            — toạ độ trái của NODE này (không phải toàn subtree)
 *   subtreeMinX  — toạ độ trái NHỎ NHẤT của toàn subtree
 *   subtreeW     — bề rộng bao ngoài toàn subtree
 */
// Padding của khung phòng ban khi bao trùm các node bên trong.
const DEPT_PAD_X = 120;        // ← tăng từ 20
const DEPT_PAD_TOP = 60;      // ← tăng để title 24px + khoảng thở
const DEPT_PAD_BOTTOM = 20;   // ← tăng padding dưới

/** Trả về Y đáy sâu nhất trong subtree (dùng để tính chiều cao khung phòng ban). */
function maxBottom(node) {
  let m = node.y + node.h;
  for (const c of (node.children || [])) m = Math.max(m, maxBottom(c));
  return m;
}

/**
 * POST-PROCESS: sau khi layout xong, đi qua cây và với mỗi khung PHÒNG BAN
 * (isDept), tính lại chiều rộng + chiều cao dựa trên bounding box THỰC TẾ của
 * TẤT CẢ descendants (không chỉ direct children). Đảm bảo khung luôn bao trọn
 * mọi node bên trong dù subtree con có chiều dài không đều.
 */
function fixDeptBounds(node) {
  for (const c of (node.children || [])) fixDeptBounds(c);
  if (!node.isDept || !node.children?.length) return;

  let maxRight = node.x + DEPT_PAD_X;
  let maxBot = node.y + DEPT_PAD_TOP;
  const walk = (n) => {
    if (n === node) return;
    maxRight = Math.max(maxRight, n.x + n.w);
    maxBot = Math.max(maxBot, n.y + n.h);
    for (const c of (n.children || [])) walk(c);
  };
  for (const c of node.children) walk(c);

  node.w = (maxRight - node.x) + DEPT_PAD_X;
  node.h = (maxBot - node.y) + DEPT_PAD_BOTTOM;
}

function layout(node, peopleByKey, y = 0) {
  const meta = NODE_META[node.key];
  const isDept = !!meta?.department;

  // ── PHÒNG BAN: khung BAO TRÙM toàn bộ subtree bên trong ──────────────────
  if (isDept) {
    const rawChildren = node.children || [];
    if (rawChildren.length === 0) {
      return {
        ...node, x: 0, y, w: NODE_W, h: 44,
        subtreeMinX: 0, subtreeW: NODE_W, people: [], children: [], isDept: true
      };
    }
    // Con của phòng ban nằm ngay TRONG khung, không cách V_GAP như tầng bình
    // thường. Y bắt đầu = y + DEPT_PAD_TOP để title trên đầu không đè lên con.
    const innerY = y + DEPT_PAD_TOP;
    const laid = rawChildren.map(c => layout(c, peopleByKey, innerY));

    // Xếp con từ trái sang, bắt đầu ở DEPT_PAD_X trong hệ toạ độ khung.
    let cursor = DEPT_PAD_X;
    for (const child of laid) {
      const dx = cursor - child.subtreeMinX;
      shiftInPlace(child, dx);
      cursor += child.subtreeW + H_GAP;
    }
    const childrenRight = cursor - H_GAP;
    const nodeW = childrenRight + DEPT_PAD_X;

    // Chiều cao khung = từ đỉnh khung xuống đáy sâu nhất của subtree con.
    let maxY = y + DEPT_PAD_TOP;
    for (const child of laid) maxY = Math.max(maxY, maxBottom(child));
    const nodeH = (maxY - y) + DEPT_PAD_BOTTOM;

    return {
      ...node, x: 0, y, w: nodeW, h: nodeH,
      subtreeMinX: 0, subtreeW: nodeW, people: [], children: laid, isDept: true
    };
  }

  // ── NODE THƯỜNG ─────────────────────────────────────────────────────────
  const people = peopleByKey[node.key] || [];
  const { w: nodeW, h: nodeH } = nodeSize(node.key, people);
  const rawChildren = node.children || [];

  if (rawChildren.length === 0) {
    return {
      ...node, x: 0, y, w: nodeW, h: nodeH,
      subtreeMinX: 0, subtreeW: nodeW, people, children: []
    };
  }

  const laid = rawChildren.map(c => layout(c, peopleByKey, y + nodeH + V_GAP));

  let cursor = 0;
  for (const child of laid) {
    const dx = cursor - child.subtreeMinX;
    shiftInPlace(child, dx);
    cursor += child.subtreeW + H_GAP;
  }
  const childrenTotalRight = cursor - H_GAP;

  const firstC = laid[0].x + laid[0].w / 2;
  const lastC = laid[laid.length - 1].x + laid[laid.length - 1].w / 2;
  const childrenCenter = (firstC + lastC) / 2;
  const nodeX = childrenCenter - nodeW / 2;

  const subtreeMinX = Math.min(nodeX, 0);
  const subtreeMaxX = Math.max(nodeX + nodeW, childrenTotalRight);
  const subtreeW = subtreeMaxX - subtreeMinX;

  return {
    ...node, x: nodeX, y, w: nodeW, h: nodeH,
    subtreeMinX, subtreeW, people, children: laid
  };
}

function shiftInPlace(node, dx) {
  if (!dx) return;
  node.x += dx;
  node.subtreeMinX = (node.subtreeMinX ?? 0) + dx;
  if (node.children) for (const c of node.children) shiftInPlace(c, dx);
}

function flatten(node, acc = { nodes: [], edges: [] }) {
  acc.nodes.push(node);
  for (const c of (node.children || [])) {
    // Không vẽ cạnh từ khung phòng ban tới con — con nằm bên TRONG khung nên
    // không cần mũi tên nối. Cha của khung (CEO) → khung vẫn vẽ như thường.
    if (!node.isDept) acc.edges.push({ from: node, to: c });
    flatten(c, acc);
  }
  return acc;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function OrgChartPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailUser, setDetailUser] = useState(null);   // person đang xem detail

  const [scale, setScale] = useState(0.7);
  const [pos, setPos] = useState({ x: 40, y: 40 });
  const drag = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await adminUserApi.list({ size: 500, includeDeleted: false });
        setUsers(res?.content || (Array.isArray(res) ? res : []));
      } catch (e) {
        toast(e?.response?.data?.message || 'Không tải được danh sách nhân sự', 'error');
      } finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  // Gom user theo nodeKey (kèm thông tin đủ để mở modal chi tiết)
  const peopleByKey = useMemo(() => {
    const map = {};
    for (const u of users) {
      if (u.isLockAccount || u.deleted) continue;
      const k = classify(u);
      if (!k) continue;
      (map[k] = map[k] || []).push({
        id: u.id, fullName: u.fullName, position: u.position,
        department: u.department, division: u.division,
        workStartDate: u.workStartDate, dateOfBirth: u.dateOfBirth,
        phoneNumber: u.phoneNumber, email: u.email, username: u.username,
        nodeKey: k,
      });
    }
    return map;
  }, [users]);

  // Tính layout + chuẩn hoá về minX = 0 (tránh toạ độ âm)
  const tree = useMemo(() => {
    const t = layout(TREE, peopleByKey);
    shiftInPlace(t, -t.subtreeMinX);
    // Sau khi shift, đi 1 pass cuối chỉnh lại kích thước KHUNG PHÒNG BAN
    // dựa trên bounding box THỰC TẾ của toàn bộ descendants. Tính lúc lay
    // đôi khi thiếu hụt do subtree con có node dài (staff nhiều người) mà
    // chiều cao chưa được cộng dồn đúng.
    fixDeptBounds(t);
    return t;
  }, [peopleByKey]);
  const { nodes, edges } = useMemo(() => flatten(tree), [tree]);

  const canvasW = tree.subtreeW + 80;
  const canvasH = useMemo(() => {
    let max = 0;
    for (const n of nodes) max = Math.max(max, n.y + n.h);
    return max + 80;
  }, [nodes]);

  // Điểm chung để chuột & cảm ứng dùng cùng logic. Với touch, coi ngón đầu
  // tiên là con trỏ; multi-touch (pinch) hiện chưa xử lý — user zoom bằng nút.
  const startDrag = (target, clientX, clientY) => {
    if (target?.closest?.('button, a')) return;
    drag.current = { sx: clientX, sy: clientY, px: pos.x, py: pos.y, moved: false };
  };
  const moveDrag = (clientX, clientY) => {
    if (!drag.current) return;
    const dx = clientX - drag.current.sx;
    const dy = clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    setPos({ x: drag.current.px + dx, y: drag.current.py + dy });
  };
  const endDrag = () => { drag.current = null; };

  const onDown = (e) => startDrag(e.target, e.clientX, e.clientY);
  const onMove = (e) => moveDrag(e.clientX, e.clientY);
  const onUp = () => endDrag();

  // Touch — dùng ngón đầu tiên. preventDefault trong onTouchMove để trình
  // duyệt không cuộn trang khi user đang kéo sơ đồ.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (!t) return;
    startDrag(t.target, t.clientX, t.clientY);
  };
  const onTouchMove = (e) => {
    const t = e.touches[0];
    if (!t || !drag.current) return;
    if (e.cancelable) e.preventDefault();
    moveDrag(t.clientX, t.clientY);
  };
  const onTouchEnd = () => endDrag();

  const zoomIn = () => setScale(s => clamp(s * 1.2, 0.3, 2));
  const zoomOut = () => setScale(s => clamp(s * 0.85, 0.3, 2));
  const fit = () => {
    if (!wrapRef.current) return;
    const wrap = wrapRef.current.getBoundingClientRect();
    const s = Math.min(wrap.width / canvasW, wrap.height / canvasH, 1);
    setScale(s);
    setPos({ x: (wrap.width - canvasW * s) / 2, y: 20 });
  };

  // Bấm vào tên người → mở modal (chặn khi đang kéo)
  const onPersonClick = (person) => {
    if (drag.current?.moved) return;
    setDetailUser(person);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 h-full overflow-hidden flex flex-col">
      <BackButton fallback="/owner/users" />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader icon={Network} title="Sơ đồ tổ chức"
          subtitle="Xem cấu trúc phòng ban & nhân sự — kéo để di chuyển, dùng nút +/− để zoom, bấm tên để xem chi tiết" />
        <div className="flex items-center gap-1.5">
          <button onClick={zoomOut}
            className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas text-muted"
            title="Thu nhỏ"><ZoomOut size={16} /></button>
          <span className="text-xs font-semibold text-ink min-w-[42px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn}
            className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas text-muted"
            title="Phóng to"><ZoomIn size={16} /></button>
          <button onClick={fit}
            className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas text-muted"
            title="Vừa khung"><Maximize2 size={16} /></button>
        </div>
      </div>

      <div ref={wrapRef}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        style={{ touchAction: 'none' }}
        className="flex-1 min-h-0 rounded-2xl border border-hairline bg-canvas overflow-hidden relative select-none cursor-grab active:cursor-grabbing">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <div style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: canvasW, height: canvasH,
            position: 'absolute', top: 0, left: 0,
          }}>
            <svg width={canvasW} height={canvasH} className="absolute inset-0 pointer-events-none">
              {edges.map((e, i) => <Edge key={i} from={e.from} to={e.to} />)}
            </svg>
            {nodes.map(n => <NodeCard key={n.key} node={n} onPersonClick={onPersonClick} />)}
          </div>
        )}
      </div>

      {detailUser && (
        <EmployeeDetailModal person={detailUser} onClose={() => setDetailUser(null)} />
      )}
    </div>
  );
}

function Edge({ from, to }) {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h;
  const x2 = to.x + to.w / 2;
  const y2 = to.y;
  const my = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  return <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5"
    className="text-hairline-2" />;
}

function NodeCard({ node, onPersonClick }) {
  const meta = NODE_META[node.key] || { title: node.key, accent: 'from-canvas to-canvas border-hairline' };
  const isDept = !!meta.department;
  const horizontal = HORIZONTAL_KEYS.has(node.key) && node.people.length > 1;

  // Khung phòng ban BAO TRÙM subtree bên trong — chỉ vẽ viền + title trên đầu,
  // các node con render đè lên (sau trong DOM order nên nằm phía trên visually).
  if (isDept) {
    return (
      <div
        style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h }}
        className={`rounded-2xl border-2 border-dashed bg-gradient-to-b ${meta.accent} pointer-events-none`}
      >
        <p
          className="absolute top-0 left-0 right-0 h-[56px] flex items-center justify-center
                   text-[24px] font-bold uppercase tracking-wider text-ink
                   px-4 whitespace-nowrap"
        >
          {meta.title}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', left: node.x, top: node.y, width: node.w }}
      className={`rounded-xl border-2 bg-gradient-to-b ${meta.accent} shadow-sm`}>
      <div className="px-3 py-2 border-b border-hairline">
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted">{meta.title}</p>
        <p className="text-xs text-blue-700 text-[14px]">{node.people.length} người</p>
      </div>
      {node.people.length > 0 ? (
        horizontal ? (
          // ── Xếp chips theo hàng NGANG cho các cấp có nhiều người cùng vai trò
          <div className="p-2 flex items-stretch justify-center gap-2">
            {node.people.map(p => (
              <button key={p.id} onClick={() => onPersonClick(p)}
                style={{ width: PERSON_CHIP_W }}
                className="text-left text-[11px] leading-tight px-2 py-1 rounded bg-surface/80 hover:bg-surface hover:ring-1 hover:ring-gold/40 transition shrink-0">
                <p className="font-semibold text-ink truncate">{p.fullName || '(chưa có tên)'}</p>
                {p.position && <p className="text-[10px] text-muted truncate">{p.position}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {node.people.map(p => (
              <button key={p.id} onClick={() => onPersonClick(p)}
                className="w-full text-left text-[11px] leading-tight px-2 py-1 rounded bg-surface/80 hover:bg-surface hover:ring-1 hover:ring-gold/40 transition">
                <p className="font-semibold text-ink truncate">{p.fullName || '(chưa có tên)'}</p>
                {p.position && <p className="text-[10px] text-muted truncate">{p.position}</p>}
              </button>
            ))}
          </div>
        )
      ) : (
        <p className="p-2 text-[14px] text-red-500 italic text-center">— chưa có nhân sự —</p>
      )}
    </div>
  );
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════════════════════════
// MODAL CHI TIẾT NHÂN VIÊN
// ═══════════════════════════════════════════════════════════════════════════
function EmployeeDetailModal({ person, onClose }) {
  const toast = useToast();
  const kind = payrollKindOf(person.nodeKey);   // DRIVER | FACTORY | GENERIC

  // Tháng đang chọn — mặc định TRƯỚC tháng hiện tại (tháng hiện tại thường
  // chưa có lương chốt). Có thể chuyển tháng qua nút prev/next.
  const now = new Date();
  const [ym, setYm] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });

  const [salary, setSalary] = useState(null);       // SalaryBreakdownDto
  const [driver, setDriver] = useState(null);       // DriverMonthDto (chỉ tài xế)
  const [attendance, setAttendance] = useState(null); // AttendanceSummaryDto (chỉ FACTORY)
  const [loading, setLoading] = useState(true);

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const fmtDob = (ts) => ts ? new Date(ts).toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit' }) : '—';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // TÀI XẾ: dùng driverSalaryDetail (có sẵn phụ cấp cơm/xăng, thưởng đơn hàng,
      // và imported bonus/allowance nếu có). Các bộ phận khác: dùng breakdown chung.
      const salaryApi = kind === 'DRIVER'
        ? factoryPayrollApi.driverSalaryDetail(person.id, ym.month, ym.year)
        : factoryPayrollApi.employeeSalaryBreakdown(person.id, ym.month, ym.year);

      const promises = [salaryApi.catch(() => null)];
      if (kind === 'DRIVER') {
        promises.push(factoryPayrollApi.employeeDriver(person.id, ym.month, ym.year).catch(() => null));
      } else if (kind === 'FACTORY') {
        promises.push(factoryPayrollApi.employeeAttendance(person.id, ym.month, ym.year).catch(() => null));
      }
      const [s, extra] = await Promise.all(promises);
      setSalary(s || null);
      if (kind === 'DRIVER') setDriver(extra || null); else setDriver(null);
      if (kind === 'FACTORY') setAttendance(extra || null); else setAttendance(null);
    } catch (e) {
      toast(e?.response?.data?.message || 'Không tải được chi tiết lương', 'error');
    } finally { setLoading(false); }
  }, [person.id, ym.month, ym.year, kind]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => setYm(v => {
    const d = new Date(v.year, v.month - 2, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
  const nextMonth = () => setYm(v => {
    const d = new Date(v.year, v.month, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  });
  const canNext = () => {
    const cur = new Date();
    return ym.year < cur.getFullYear()
      || (ym.year === cur.getFullYear() && ym.month <= cur.getMonth() + 1);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-hairline">
          <div>
            <p className="font-bold text-ink text-base sm:text-lg">{person.fullName}</p>
            <p className="text-xs text-muted">{person.position || person.department || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted">
            <XIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Thông tin cơ bản */}
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-canvas p-4">
            <InfoLine icon={BriefcaseBusiness} label="Chức vụ"
              value={[person.position, person.department].filter(Boolean).join(' · ') || '—'} />
            <InfoLine icon={CalendarDays} label="Ngày vào làm" value={fmtDate(person.workStartDate)} />
            <InfoLine icon={Cake} label="Sinh nhật" value={fmtDob(person.dateOfBirth)} />
            <InfoLine icon={Phone} label="SĐT" value={person.phoneNumber || '—'} />
          </div>

          {/* Chọn tháng */}
          <div className="flex items-center justify-between rounded-xl bg-canvas p-2.5">
            <button onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-surface text-muted"><ChevronLeft size={16} /></button>
            <div className="text-center">
              <p className="text-[10px] text-muted uppercase font-semibold tracking-wider">Kỳ lương</p>
              <p className="text-sm font-bold text-ink">Tháng {ym.month}/{ym.year}</p>
            </div>
            <button onClick={nextMonth} disabled={!canNext()}
              className="p-2 rounded-lg hover:bg-surface text-muted disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? <LoadingSpinner /> : (
            <>
              {/* Chi tiết theo bộ phận */}
              {kind === 'DRIVER' && (
                <DriverContent salary={salary} driver={driver} month={ym.month} year={ym.year} />
              )}
              {kind === 'FACTORY' && (
                <FactoryContent salary={salary} attendance={attendance} month={ym.month} year={ym.year} />
              )}
              {kind === 'GENERIC' && (
                salary
                  ? <SalaryBreakdownCards row={salary} />
                  : <p className="text-sm text-muted text-center py-6">Chưa có lương cho tháng này.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-gold shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted font-semibold tracking-wider">{label}</p>
        <p className="text-sm text-ink font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ── FACTORY (xưởng sản xuất): calendar ngày công + salary breakdown ─────────
function FactoryContent({ salary, attendance, month, year }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {salary
          ? <SalaryBreakdownCards row={salary} />
          : <p className="text-sm text-muted text-center py-6">Chưa có lương cho tháng này.</p>}
      </div>
      <div className="space-y-3">
        {attendance && attendance.days && attendance.days.length > 0 ? (
          <>
            <div className="rounded-xl bg-canvas p-3 text-sm space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                Ngày công tháng {month}/{year}
              </p>
              <Row label="Công chuẩn" val={fmt(attendance.standardDays, 1)} />
              <Row label="Công thực tế" val={fmt(attendance.actualDays, 1)} bold />
              {attendance.leaveDays > 0 && <Row label="Nghỉ có lương" val={fmt(attendance.leaveDays, 1)} />}
              {attendance.unpaidDays > 0 && <Row label="Nghỉ không lương" val={fmt(attendance.unpaidDays, 1)} />}
              {attendance.lateCount > 0 && <Row label="Đi trễ" val={`${attendance.lateCount} lần / ${attendance.lateMinutes}p`} />}
              {attendance.earlyCount > 0 && <Row label="Về sớm" val={`${attendance.earlyCount} lần / ${attendance.earlyMinutes}p`} />}
            </div>
            <FactoryCalendar days={attendance.days} month={month} year={year} />
          </>
        ) : (
          <p className="text-sm text-muted text-center py-6 rounded-xl bg-canvas">
            Chưa có chấm công tháng {month}/{year}.
          </p>
        )}
      </div>
    </div>
  );
}

/** Calendar hiển thị công của từng ngày (giá trị 0..1). */
function FactoryCalendar({ days, month, year }) {
  const first = days[0];
  const colOf = (wd) => (wd === 8 ? 7 : Math.max(1, wd - 1));
  const leading = colOf(first.weekday) - 1;

  const colorOf = (d) => {
    const v = d.value || 0;
    if (d.type === 'UNPAID') return 'bg-red-500/15 border-red-500/40';
    if (d.type === 'LEAVE') return 'bg-blue-500/15 border-blue-500/40';
    if (v >= 1) return 'bg-emerald-500/15 border-emerald-500/40';
    if (v > 0) return 'bg-amber-400/15 border-amber-400/40';
    return 'bg-canvas border-hairline';
  };

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-3">
      <p className="text-xs font-bold text-ink mb-2">Ngày công {month}/{year}</p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w =>
          <div key={w} className="text-[10px] text-muted text-center font-semibold">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => <div key={`x${i}`} />)}
        {days.map(d => (
          <div key={d.day}
            title={`${d.value || 0} công`}
            className={`aspect-square rounded-lg border p-1 flex flex-col justify-between ${colorOf(d)}`}>
            <span className="text-[11px] font-bold text-ink leading-none">{d.day}</span>
            {d.value > 0 && (
              <span className="text-[9px] text-right font-bold text-ink">{fmt(d.value, 1)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DRIVER: calendar điểm danh + km/đơn tổng theo loại xe ───────────────────
function DriverContent({ salary, driver, month, year }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {salary
          ? <SalaryBreakdownCards row={salary} />
          : <p className="text-sm text-muted text-center py-6">Chưa có lương cho tháng này.</p>}
      </div>
      <div className="space-y-3">
        {driver ? (
          <>
            <div className="rounded-xl bg-canvas p-3 text-sm space-y-1.5">
              <p className="text-[10px] uppercase font-bold text-muted tracking-wider">
                Tổng km &amp; đơn tháng {month}/{year}
              </p>
              <Row label="Xe máy — km" val={`${fmt(driver.totalKm, 1)} km`} />
              <Row label="Xe máy — đơn" val={driver.totalOrdersMotorbike ?? 0} />
              <Row label="Xe máy — lượt" val={driver.totalTripsMotorbike ?? 0} />
              <div className="h-px bg-surface-2 my-1" />
              <Row label="Xe tải — đơn" val={driver.totalOrdersTruck ?? 0} />
              <Row label="Xe tải — lượt" val={driver.totalTripsTruck ?? 0} />
              <div className="h-px bg-surface-2 my-1" />
              <Row label="TỔNG SỐ ĐƠN" val={driver.totalOrders ?? 0} bold />
            </div>
            <DriverCalendar days={driver.days || []} month={month} year={year} />
          </>
        ) : (
          <p className="text-sm text-muted text-center py-6 rounded-xl bg-canvas">
            Chưa có dữ liệu km/đơn tháng {month}/{year}.
          </p>
        )}
      </div>
    </div>
  );
}

/** Calendar tài xế: màu theo điểm danh + badge km/đơn (tổng cả 2 loại xe). */
function DriverCalendar({ days, month, year }) {
  if (!days || days.length === 0) return null;
  const first = days[0];
  const colOf = (wd) => (wd === 8 ? 7 : Math.max(1, wd - 1));
  const leading = colOf(first.weekday) - 1;

  const colorCls = (c) => c === 'GREEN'
    ? 'bg-emerald-500/15 border-emerald-500/40'
    : c === 'YELLOW'
      ? 'bg-amber-400/15 border-amber-400/40'
      : 'bg-canvas border-hairline';

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-bold text-ink">Điểm danh {month}/{year}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500/60" /> Đủ</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-amber-400/70" /> Thiếu 1</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w =>
          <div key={w} className="text-[10px] text-muted text-center font-semibold">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => <div key={`x${i}`} />)}
        {days.map(d => {
          const orders = d.orderCount || 0;
          const km = d.totalKm || 0;
          return (
            <div key={d.day}
              className={`aspect-square rounded-lg border p-1 flex flex-col ${colorCls(d.dayColor)}`}>
              <span className="text-[11px] font-bold text-ink leading-none">{d.day}</span>
              {(orders > 0 || km > 0) && (
                <div className="mt-auto flex flex-col items-end gap-0.5">
                  {orders > 0 && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500 text-white leading-none">
                      {orders}đ
                    </span>
                  )}
                  {km > 0 && (
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-600 text-white leading-none">
                      {Math.round(km)}km
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, val, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? 'font-bold text-ink' : 'text-muted'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} text-ink`}>{val}</span>
    </div>
  );
}
const fmt = (v, d = 0) => v == null ? '—' : Number(v).toLocaleString('vi-VN',
  { minimumFractionDigits: d, maximumFractionDigits: d });