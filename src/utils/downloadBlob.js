// src/utils/downloadBlob.js
// Helper tải xuống file từ response blob (dùng cho các API export Excel/PDF).
export function downloadBlob(blobData, filename) {
  const url = URL.createObjectURL(new Blob([blobData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
