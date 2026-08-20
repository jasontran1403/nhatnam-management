import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

const ToastContext = createContext(null);

let _toastId = 0;

// ============================================================================
// Toast Item
// ============================================================================

function ToastItem({
  t,
  index,
  expanded,
  onRemove,
  onHeightChange,
  translateY,
}) {
  const toastRef = useRef(null);
  const [progress, setProgress] = useState(100);

  const duration = t.duration || 3000;

  // --------------------------------------------------------------------------
  // Measure real toast height
  // --------------------------------------------------------------------------

  useEffect(() => {
    const element = toastRef.current;

    if (!element) return;

    const updateHeight = () => {
      const height = element.getBoundingClientRect().height;

      onHeightChange(t.id, height);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [t.id, onHeightChange]);

  // --------------------------------------------------------------------------
  // Progress timer
  //
  // Timer KHÔNG pause khi hover.
  // --------------------------------------------------------------------------

  useEffect(() => {
    const startTime = Date.now();

    let animationFrame;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;

      const percentage = Math.max(
        0,
        100 - (elapsed / duration) * 100
      );

      setProgress(percentage);

      if (percentage > 0) {
        animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [duration]);

  // --------------------------------------------------------------------------
  // Type config
  // --------------------------------------------------------------------------

  const config = {
    success: {
      border: '#10b981',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      icon: (
        <CheckCircle
          size={18}
          className="text-emerald-500 shrink-0"
        />
      ),
    },

    error: {
      border: '#ef4444',
      bg: 'bg-red-50 dark:bg-red-950/30',
      icon: (
        <XCircle
          size={18}
          className="text-red-500 shrink-0"
        />
      ),
    },

    warning: {
      border: '#f59e0b',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      icon: (
        <AlertTriangle
          size={18}
          className="text-amber-500 shrink-0"
        />
      ),
    },

    info: {
      border: '#3b82f6',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      icon: (
        <Info
          size={18}
          className="text-blue-500 shrink-0"
        />
      ),
    },
  };

  const current = config[t.type] || config.success;

  return (
    <div
      ref={toastRef}
      onClick={() => onRemove(t.id)}
      className="absolute top-0 left-0 right-0 cursor-pointer"
      style={{
        opacity: 1,

        transformOrigin: 'top center',

        willChange: 'transform',
      }}
    >
      <div
        className={`${current.bg} rounded-xl overflow-hidden`}
        style={{
          border: `1px solid ${current.border}35`,

          boxShadow: expanded
            ? '0 8px 25px rgba(0,0,0,0.10)'
            : '0 8px 25px rgba(0,0,0,0.14)',

          transition: 'box-shadow 0.3s ease',
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Content                                                         */}
        {/* ---------------------------------------------------------------- */}

        <div className="flex items-start gap-3 px-4 py-3">
          <div className="shrink-0 mt-0.5">
            {current.icon}
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-sm text-ink block break-words">
              {t.message}
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Progress Bar                                                    */}
        {/* ---------------------------------------------------------------- */}

        <div className="h-1 w-full bg-black/5">
          <div
            className="h-full"
            style={{
              width: `${progress}%`,
              backgroundColor: current.border,
            }}
          />
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// Badge
// ============================================================================

function ToastBadge({ count }) {
  if (count <= 0) {
    return null;
  }

  return (
    <div
      className="
        absolute
        -bottom-2
        -left-2
        min-w-6
        h-6
        px-2
        rounded-full
        bg-gray-800
        dark:bg-gray-100
        text-white
        dark:text-gray-900
        text-xs
        font-semibold
        flex
        items-center
        justify-center
        shadow-md
        border-2
        border-white
        dark:border-gray-900
        pointer-events-none
      "
      style={{
        zIndex: 2000,
      }}
    >
      +{count}
    </div>
  );
}


// ============================================================================
// Toast Provider
// ============================================================================

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const [expanded, setExpanded] = useState(false);

  // Height thực tế của từng toast
  const [toastHeights, setToastHeights] = useState({});

  const EXPANDED_GAP = 8;

  // --------------------------------------------------------------------------
  // Update height
  // --------------------------------------------------------------------------

  const updateToastHeight = useCallback((id, height) => {
    setToastHeights((prev) => {
      if (prev[id] === height) {
        return prev;
      }

      return {
        ...prev,
        [id]: height,
      };
    });
  }, []);

  // --------------------------------------------------------------------------
  // Remove
  // --------------------------------------------------------------------------

  const remove = useCallback((id) => {
    setToasts((prev) =>
      prev.filter((toast) => toast.id !== id)
    );

    setToastHeights((prev) => {
      const next = { ...prev };

      delete next[id];

      return next;
    });
  }, []);

  // --------------------------------------------------------------------------
  // Add Toast
  // --------------------------------------------------------------------------

  const addToast = useCallback(
    (message, type = 'success', duration = 3000) => {
      const id = ++_toastId;

      setToasts((prev) => {
        // Không duplicate message
        if (prev.some((toast) => toast.message === message)) {
          return prev;
        }

        return [
          {
            id,
            message,
            type,
            duration,
          },
          ...prev,
        ];
      });

      // --------------------------------------------------------------------
      // Auto remove
      //
      // Toast nào hết timer thì remove toast đó.
      //
      // Nếu toast đang nằm sau toast mới nhất:
      //
      // [Toast 3] +2
      // [Toast 2]
      // [Toast 1]
      //
      // Toast 2 timeout:
      //
      // [Toast 3] +1
      // [Toast 1]
      // --------------------------------------------------------------------

      setTimeout(() => {
        setToasts((prev) =>
          prev.filter((toast) => toast.id !== id)
        );

        setToastHeights((prev) => {
          const next = { ...prev };

          delete next[id];

          return next;
        });
      }, duration);
    },
    []
  );

  // --------------------------------------------------------------------------
  // Expanded position
  //
  // Khi hover:
  //
  // Toast 1
  // Toast 2
  // Toast 3
  // Toast 4
  //
  // --------------------------------------------------------------------------

  const getExpandedTranslateY = useCallback(
    (index) => {
      if (index === 0) {
        return 0;
      }

      let offset = 0;

      for (let i = 0; i < index; i++) {
        const height =
          toastHeights[toasts[i]?.id] || 72;

        offset += height;
        offset += EXPANDED_GAP;
      }

      return offset;
    },
    [toastHeights, toasts]
  );

  // --------------------------------------------------------------------------
  // Container height
  // --------------------------------------------------------------------------

  const getContainerHeight = () => {
    if (toasts.length === 0) {
      return 0;
    }

    // ------------------------------------------------------------------------
    // EXPANDED
    // ------------------------------------------------------------------------

    if (expanded) {
      let height = 0;

      toasts.forEach((toast, index) => {
        height += toastHeights[toast.id] || 72;

        if (index < toasts.length - 1) {
          height += EXPANDED_GAP;
        }
      });

      return height;
    }

    // ------------------------------------------------------------------------
    // STACKED
    //
    // Chỉ hiển thị toast mới nhất.
    //
    // Không cần chiều cao cho các toast phía sau vì chúng không render.
    // ------------------------------------------------------------------------

    return toastHeights[toasts[0]?.id] || 72;
  };

  // --------------------------------------------------------------------------
  // Badge count
  //
  // Ví dụ:
  //
  // toasts:
  //
  // [Toast 5]
  // [Toast 4]
  // [Toast 3]
  // [Toast 2]
  // [Toast 1]
  //
  // Badge = 4
  //
  // --------------------------------------------------------------------------

  const hiddenToastCount = Math.max(
    0,
    toasts.length - 1
  );

  // --------------------------------------------------------------------------
  // Reset expanded
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (toasts.length === 0) {
      setExpanded(false);
    }
  }, [toasts.length]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <ToastContext.Provider value={addToast}>
      {children}

      <div
        className="fixed top-4 right-4 z-[100]"
        style={{
          width: '380px',
          maxWidth: 'calc(100vw - 2rem)',
        }}
        onMouseEnter={() => {
          setExpanded(true);
        }}
        onMouseLeave={() => {
          setExpanded(false);
        }}
      >
        <div
          className="relative"
          style={{
            height: `${getContainerHeight()}px`,

            transition:
              'height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {toasts.map((toast, index) => {
            const isLatest = index === 0;

            const translateY = expanded
              ? getExpandedTranslateY(index)
              : 0;

            return (
              <div
                key={toast.id}
                className="absolute top-0 left-0 right-0"
                style={{
                  transform: `translate3d(0, ${translateY}px, 0)`,

                  opacity:
                    expanded || isLatest
                      ? 1
                      : 0,

                  transition: `
          transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
          opacity 0.3s ease
        `,

                  zIndex: 1000 - index,

                  pointerEvents:
                    expanded || isLatest
                      ? 'auto'
                      : 'none',

                  willChange: 'transform, opacity',
                }}
              >
                <ToastItem
                  t={toast}
                  index={index}
                  expanded={expanded}
                  onRemove={remove}
                  onHeightChange={updateToastHeight}
                  translateY={0}
                />
              </div>
            );
          })}

          {/* --------------------------------------------------------------- */}
          {/* Badge                                                            */}
          {/* --------------------------------------------------------------- */}

          {!expanded && hiddenToastCount > 0 && (
            <div
              className="
    absolute
    -bottom-2
    -left-2
    min-w-6
    h-6
    px-2
    rounded-full
    bg-gray-800
    dark:bg-gray-100
    text-white
    dark:text-gray-900
    text-xs
    font-semibold
    flex
    items-center
    justify-center
    shadow-md
    border-2
    border-white
    dark:border-gray-900
    pointer-events-none
  "
              style={{
                zIndex: 2000,

                opacity:
                  !expanded && hiddenToastCount > 0
                    ? 1
                    : 0,

                transform:
                  !expanded && hiddenToastCount > 0
                    ? 'scale(1)'
                    : 'scale(0.8)',

                transition:
                  'opacity 0.25s ease, transform 0.25s ease',
              }}
            >
              +{hiddenToastCount}
            </div>
          )}
        </div>
      </div>
    </ToastContext.Provider>
  );
};


// ============================================================================
// Hook
// ============================================================================

export const useToast = () => {
  const toast = useContext(ToastContext);

  if (!toast) {
    throw new Error(
      'useToast must be used inside ToastProvider'
    );
  }

  return toast;
};