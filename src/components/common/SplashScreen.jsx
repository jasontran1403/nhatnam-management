/**
 * SplashScreen — fixed version
 *
 * Root causes of "insertBefore" NotFoundError:
 * 1. Inline <style> tag inside JSX → browser extensions (Google Translate,
 *    Grammarly, etc.) inject nodes into DOM; React loses track on reconcile.
 * 2. CSS class names (.bg-gradient, .smoke, .loader) conflict with Tailwind
 *    or extension-injected styles and get moved/removed by the browser.
 * 3. StrictMode double-invoke + ref race.
 *
 * Fix: move all CSS to a dedicated <style id> injected once into <head>,
 * use a portal so the splash is never a sibling of app content,
 * and guard onDone with both ref + mounted check.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const STYLE_ID = 'nhatnam-splash-style';
const SPLASH_CSS = `
  @keyframes nn-bgMove {
    0%   { transform: scale(1) rotate(0deg); }
    50%  { transform: scale(1.08) rotate(1deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  @keyframes nn-fadeUp {
    from { opacity: 0; transform: translateY(20px) scale(.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes nn-glowPulse {
    0%,100% { opacity: .5; transform: scale(1); }
    50%     { opacity: .9; transform: scale(1.08); }
  }
  @keyframes nn-smoke {
    0%   { transform: translateY(20px) scale(1);   opacity: 0; }
    50%  { opacity: .12; }
    100% { transform: translateY(-80px) scale(1.8); opacity: 0; }
  }
  @keyframes nn-loading {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(300%); }
  }
  .nn-splash-root {
    position: fixed; inset: 0; z-index: 9999; overflow: hidden;
    background: #0B0B0B; display: flex; align-items: center;
    justify-content: center; font-family: 'Inter', sans-serif;
  }
  .nn-bg-gradient {
    position: absolute; inset: -20%;
    background:
      radial-gradient(circle at 20% 30%, rgba(255,120,40,.20), transparent 30%),
      radial-gradient(circle at 80% 20%, rgba(255,80,0,.12),  transparent 30%),
      radial-gradient(circle at 50% 80%, rgba(255,180,80,.12), transparent 35%);
    filter: blur(60px);
    animation: nn-bgMove 10s ease-in-out infinite;
  }
  .nn-grid {
    position: absolute; inset: 0; opacity: .04;
    background-image:
      linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 42px 42px;
  }
  .nn-smoke {
    position: absolute; bottom: 40%; width: 120px; height: 120px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(255,255,255,.15), transparent 70%);
    filter: blur(18px);
    animation: nn-smoke 4s linear infinite;
  }
  .nn-smoke.s2 { left: 55%; animation-delay: 1.2s; }
  .nn-smoke.s3 { left: 40%; animation-delay: 2.2s; }
  .nn-content {
    position: relative; z-index: 5;
    display: flex; flex-direction: column; align-items: center;
    animation: nn-fadeUp .8s cubic-bezier(.22,1,.36,1);
  }
  .nn-glow {
    position: absolute; width: 260px; height: 260px; border-radius: 999px;
    background: radial-gradient(circle, rgba(255,120,40,.35), transparent 70%);
    filter: blur(20px);
    animation: nn-glowPulse 3s ease-in-out infinite;
  }
  .nn-loader {
    position: absolute; bottom: 0; left: 0;
    width: 100%; height: 4px;
    background: rgba(255,255,255,.06); overflow: hidden;
  }
  .nn-loader-bar {
    position: absolute; top: 0; left: 0;
    width: 35%; height: 100%;
    background: linear-gradient(90deg, #FF7A18, #FFB347, #FFD27F);
    border-radius: 999px;
    animation: nn-loading 1.4s ease infinite;
    box-shadow: 0 0 20px rgba(255,160,80,.6);
  }
`;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = SPLASH_CSS;
  document.head.appendChild(el);
}

function removeStyle() {
  document.getElementById(STYLE_ID)?.remove();
}

export default function SplashScreen({ onDone }) {
  const doneRef    = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    injectStyle();
    mountedRef.current = true;
    doneRef.current    = false;

    const timer = setTimeout(() => {
      if (mountedRef.current && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, 2200);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      // Remove injected style on unmount so it doesn't linger
      removeStyle();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="nn-splash-root">
      <div className="nn-bg-gradient" />
      <div className="nn-grid" />
      <div className="nn-smoke" />
      <div className="nn-smoke s2" />
      <div className="nn-smoke s3" />

      <div className="nn-content">
        <div className="nn-glow" />

        <svg width="120" height="90" viewBox="0 0 120 90" fill="none"
          style={{ marginBottom: 28 }}>
          <defs>
            <linearGradient id="nn-sausage" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#FFB36B" />
              <stop offset="100%" stopColor="#D65A1F" />
            </linearGradient>
          </defs>
          <path
            d="M18 45C18 28 32 18 48 18H72C88 18 102 28 102 45C102 62 88 72 72 72H48C32 72 18 62 18 45Z"
            fill="url(#nn-sausage)"
          />
          <rect x="38" y="24" width="6" height="42" rx="3" fill="rgba(0,0,0,.18)" />
          <rect x="58" y="24" width="6" height="42" rx="3" fill="rgba(0,0,0,.18)" />
          <rect x="78" y="24" width="6" height="42" rx="3" fill="rgba(0,0,0,.18)" />
          <ellipse cx="48" cy="32" rx="24" ry="8" fill="rgba(255,255,255,.18)" />
        </svg>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            color: '#FFB347', fontSize: 13, fontWeight: 700,
            letterSpacing: '.32em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            German Sausage House
          </div>
          <h1 style={{
            margin: 0, color: '#fff', fontSize: 52,
            lineHeight: 1, fontWeight: 900, letterSpacing: '-0.06em',
          }}>
            NHẤT NAM
          </h1>
          <div style={{
            marginTop: 16, color: 'rgba(255,255,255,.55)',
            fontSize: 13, fontWeight: 500,
            letterSpacing: '.18em', textTransform: 'uppercase',
          }}>
            Đức • Thủ công • Chuẩn vị châu Âu
          </div>
        </div>
      </div>

      <div className="nn-loader">
        <div className="nn-loader-bar" />
      </div>
    </div>,
    document.body
  );
}
