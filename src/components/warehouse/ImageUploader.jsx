import { useLang } from '../../context/LangContext';
import { useState, useRef, useCallback } from 'react';
import { uploadInventoryImage, getImageUrl } from '../../api/warehouseApi';

export default function ImageUploader({ value = [], onChange }) {
  const { t } = useLang();
  const [uploading, setUploading]   = useState(false);
  const [lightbox, setLightbox]     = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream]         = useState(null);
  const [toast, setToast]           = useState(null);
  const fileRef   = useRef();
  const videoRef  = useRef();
  const canvasRef = useRef();

  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(f =>
          uploadInventoryImage(f).then(res => res.data.data.imageUrl)
        )
      );
      onChange([...value, ...uploaded]);
    } catch (e) {
      showToast(t('product','image_upload_error') + ': ' + (e?.response?.data?.message || e?.message || e));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => onChange(value.filter((_, i) => i !== idx));

  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, audio: false,
      });
      setStream(s);
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 50);
    } catch (e) {
      const msg = e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError'
        ? t('common','error')
        : e?.name === 'NotAllowedError'
        ? t('common','error')
        : t('common','error') + ': ' + (e?.message || e);
      showToast(msg);
    }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraOpen(false);
  };

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      handleFiles([file]);
    }, 'image/jpeg', 0.92);
  };

  const btnStyle = {
    width: 72, height: 72, borderRadius: 8,
    flexDirection: 'column', gap: 2,
    fontSize: 10, lineHeight: 1.3,
    overflow: 'hidden', wordBreak: 'break-word',
    padding: '6px 4px', textAlign: 'center',
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 12,
          background: toast.type === 'error' ? 'var(--c-danger)' : 'var(--c-success)',
          color: 'var(--c-surface)', padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 99999,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          maxWidth: '80vw', textAlign: 'center',
          animation: 'fadeInUp .2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      <div className="wh-img-grid">
        {value.map((url, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img src={getImageUrl(url)} className="wh-img-thumb" onClick={() => setLightbox(url)} alt="" />
            <button onClick={() => removeImage(i)} style={{ position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'var(--wh-danger)',color:'var(--c-surface)',border:'none',cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
          </div>
        ))}

        <button className="wh-btn wh-btn-secondary" style={btnStyle} onClick={() => fileRef.current.click()} disabled={uploading}>
          <span style={{ fontSize: 20 }}>{uploading ? '⏳' : '🖼️'}</span>
          <span>{uploading ? t('common','loading'): t('common','select')}</span>
        </button>

        <button className="wh-btn wh-btn-secondary" style={btnStyle} onClick={openCamera} disabled={uploading}>
          <span style={{ fontSize: 20 }}>📷</span>
          <span>{t('common','select')}</span>
        </button>
      </div>

      <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:'none' }} onChange={e => handleFiles(e.target.files)} />
      <canvas ref={canvasRef} style={{ display:'none' }} />

      {cameraOpen && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.92)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16 }}>
          <video ref={videoRef} autoPlay playsInline style={{ maxWidth:'90vw',maxHeight:'65vh',borderRadius:12,background:'#000' }} />
          <div style={{ display:'flex',gap:12 }}>
            <button onClick={capture} style={{ padding:'10px 28px',borderRadius:99,background:'var(--c-surface)',color:'var(--c-ink)',fontWeight:700,fontSize:15,border:'none',cursor:'pointer' }}>
              📸
            </button>
            <button onClick={closeCamera} style={{ padding:'10px 20px',borderRadius:99,background:'rgba(255,255,255,.15)',color:'var(--c-surface)',fontWeight:600,fontSize:14,border:'none',cursor:'pointer' }}>
              Huỷ
            </button>
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,cursor:'zoom-out' }}>
          <img src={getImageUrl(lightbox)} alt="" style={{ maxWidth:'85vw',maxHeight:'85vh',borderRadius:12 }} />
        </div>
      )}
    </div>
  );
}