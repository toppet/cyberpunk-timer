import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTimer } from './useTimer';

const TICK_COUNT = 60;

// Base tick data (without active state)
const BASE_TICKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const isMajor = i % 5 === 0;
  return {
    index: i,
    isMajor,
    baseY1: 190 - 158,
    baseY2: 190 - (isMajor ? 136 : 146),
    transform: `rotate(${(i / TICK_COUNT) * 360} 190 190)`,
    color: isMajor ? '#c9c6d1' : '#48464d',
    width: isMajor ? 2 : 1,
  };
});

// Motion animation variants for each TIME ANIM option
const TIME_ANIM_VARIANTS = {
  none: null,
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
    transition: { duration: 0.18 },
  },
  slide: {
    initial: { opacity: 0, y: -14 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: 10 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  flip: {
    initial: { opacity: 0, rotateX: -70, scale: 0.92 },
    animate: { opacity: 1, rotateX: 0,   scale: 1 },
    exit:    { opacity: 0, rotateX: 70,  scale: 0.92 },
    transition: { duration: 0.22, ease: 'easeOut' },
  },
};

const CIRCUMFERENCE = 2 * Math.PI * 150;
const TIME_ANIMS = ['none', 'fade', 'slide', 'flip'];
const ACCENT_COLORS = ['#8e8ba8', '#d94f2b', '#ff5a1f', '#7fa88e', '#4ecdc4'];
const DIGIT_POS_KEYS = ['mm-tens', 'mm-ones', 'sep', 'ss-tens', 'ss-ones'];
const KNOB_BASE = { position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#f3f1f6', transition: 'left .15s ease' };

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getRemaining(isRunning, isPaused, isFinished, remainingSeconds, setupSecs) {
  if (isRunning || isPaused) return remainingSeconds;
  if (isFinished) return 0;
  return setupSecs;
}

function getStateLabel(isRunning, isPaused, isFinished) {
  if (isRunning) return 'RUNNING';
  if (isPaused) return 'PAUSED';
  if (isFinished) return 'TIME UP';
  return 'SET TIME';
}

function getHintText(isRunning, isPaused, isFinished) {
  if (isRunning) return 'PRESS CENTER TO PAUSE';
  if (isPaused) return 'DRAG RING OR CENTER TO ADJUST · PRESS CENTER TO RESUME';
  if (isFinished) return 'PRESS CENTER OR RESET TO CLEAR';
  return 'DRAG TIME OR RING TO SET · PRESS CENTER TO START';
}

function buildPresets(maxMinutes, setupSecs, accentColor, selectPreset) {
  return [5, 10, 15, 25, 45, 60]
    .filter((m) => m <= maxMinutes)
    .map((m) => {
      const active = setupSecs === m * 60;
      return {
        label: `${m}M`,
        select: () => selectPreset(m),
        bg: active ? accentColor : '#1c1c1f',
        color: active ? '#161618' : '#9d9aa4',
        border: active ? accentColor : '#33323a',
      };
    });
}

export default function Timer({
  accentColor: accentColorProp = '#8e8ba8',
  maxMinutes = 60,
  tickSoundEnabled = true,
}) {
  const [accentColor, setAccentColor] = useState(accentColorProp);

  const {
    setupSecs, remainingSeconds,
    isRunning, isPaused, isFinished, isIdle,
    showSettings, toggleSettings, closeSettingsBackdrop,
    soundOn, setSoundOn,
    tickSoundOn, setTickSoundOn,
    pulseTick, isDragging, isCenterDragging,
    timeAnimation, setTimeAnimation,
    finishedRef, svgRef,
    handleCenterClick, onDialPointerDown, onCenterPointerDown,
    selectPreset, adjustTime, reset,
  } = useTimer({ maxMinutes, tickSoundEnabled });

  // ── Derived render values ─────────────────────────────────────────────────

  const remaining = getRemaining(isRunning, isPaused, isFinished, remainingSeconds, setupSecs);
  const fraction = maxMinutes > 0 ? remaining / (maxMinutes * 60) : 0;
  const arcOffset = CIRCUMFERENCE * (1 - fraction);
  const angleDeg = fraction * 360;
  const capAngleRad = (angleDeg - 90) * (Math.PI / 180);
  const capCx = 190 + 150 * Math.cos(capAngleRad);
  const capCy = 190 + 150 * Math.sin(capAngleRad);

  // Calculate active tick index (the tick the red marker is on)
  const activeTickIndex = Math.round(angleDeg / 6) % TICK_COUNT;

  // Generate tick data with active state for animation
  const ticks = useMemo(() => BASE_TICKS.map((t) => {
    const isActive = t.index === activeTickIndex && remaining > 0;
    // Extend tick outward when active:
    // - 5-minute markers (major): 20% increase
    // - Minute markers (minor): 30% increase
    const tickLength = Math.abs(t.baseY1 - t.baseY2);
    const extensionPercent = t.isMajor ? 0.325 : 0.6;
    const activeY1 = isActive ? t.baseY1 - tickLength * extensionPercent : t.baseY1;
    return { ...t, y1: activeY1, y2: t.baseY2, isActive };
  }), [activeTickIndex, remaining]);

  const showResetRow = isPaused || isFinished;
  const showAdjustRow = isRunning || isPaused;
  const stateLabel = getStateLabel(isRunning, isPaused, isFinished);
  const hintText = getHintText(isRunning, isPaused, isFinished);

  const timerDisplaySecs = isRunning || isPaused ? remainingSeconds : setupSecs;
  const displayTime = isFinished ? '00:00' : fmt(timerDisplaySecs);
  const presets = buildPresets(maxMinutes, setupSecs, accentColor, selectPreset);

  let dialCursor = 'default';
  if (isIdle || isPaused) dialCursor = isDragging ? 'grabbing' : 'grab';

  const arcStyle = { transition: 'stroke-dashoffset .3s linear' };
  const pulseStyle = {
    animation: `${pulseTick % 2 === 0 ? 'centerPulse' : 'centerPulse2'} 0.35s ease-out`,
    transformOrigin: '190px 190px',
  };

  const glowStyle = pulseTick > 0
    ? {
        animation: `${pulseTick % 2 === 0 ? 'centerGlow' : 'centerGlow2'} 0.5s ease-out`,
        '--glow-color': accentColor,
      }
    : {};

  const soundKnobStyle = { ...KNOB_BASE, left: soundOn ? '20px' : '2px' };
  const tickKnobStyle  = { ...KNOB_BASE, left: tickSoundOn ? '20px' : '2px' };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#131315', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", color: '#e9e7ee', padding: '32px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ fontSize: '13px', letterSpacing: '0.12em', color: '#8a8890' }}>CHRONO&nbsp;/&nbsp;001</div>
            <div style={{ fontSize: '11px', letterSpacing: '0.1em', color: '#54525a' }}>ANALOG&nbsp;COUNTDOWN&nbsp;UNIT</div>
          </div>
          <button onClick={toggleSettings} style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid #33323a', background: '#1c1c1f', color: '#9d9aa4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </button>
        </div>

        {/* Dial */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 380 380" style={{ touchAction: 'none', userSelect: 'none', overflow: 'visible' }}>
            <circle cx="190" cy="190" r="165" fill="#181819" stroke="#26252a" strokeWidth="1" />
            <circle cx="190" cy="190" r="150" fill="none" stroke="#232227" strokeWidth="10" />

            {ticks.map((t) => (
              <motion.line
                key={t.index}
                x1="190"
                x2="190"
                stroke={t.isActive ? accentColor : t.color}
                strokeWidth={t.width}
                transform={t.transform}
                initial={false}
                animate={{ y1: t.y1, y2: t.y2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            ))}

            {!isFinished && fraction > 0 && <circle cx="190" cy="190" r="150" fill="none" stroke={accentColor} strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} strokeDashoffset={arcOffset} transform="rotate(-90 190 190)" style={arcStyle} />}
            {/* Fake round cap at the arc leading end only */}
            {/* {!isFinished && fraction > 0 && <circle cx={capCx} cy={capCy} r="5" fill={accentColor} />} */}

            {/* Invisible wide ring — drag target */}
            <circle cx="190" cy="190" r="150" fill="none" stroke="transparent" strokeWidth="70" onPointerDown={onDialPointerDown} style={{ cursor: dialCursor }} />

            {/* Pointer needle — visible line + wide invisible hit area */}
            <g transform={`rotate(${angleDeg} 190 190)`} onPointerDown={onDialPointerDown} style={{ cursor: dialCursor }}>
              <line x1="190" y1="32" x2="190" y2="78" stroke="transparent" strokeWidth="20" />
              <line x1="190" y1="42" x2="190" y2="72" stroke="#e53935" strokeWidth="5" strokeLinecap="round" />
            </g>

            {/* Center button */}
            <circle cx="190" cy="190" r="106" fill="#1a1a1d" stroke="#2c2b31" strokeWidth="1" onClick={handleCenterClick} onPointerDown={onCenterPointerDown} style={{ cursor: isCenterDragging ? 'ns-resize' : 'pointer', ...pulseStyle }} />
          </svg>

          {/* Glow overlay */}
          {pulseTick > 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: '55.8%', height: '55.8%', transform: 'translate(-50%, -50%)', borderRadius: '50%', pointerEvents: 'none', ...glowStyle }} />
          )}

          {/* Time overlay — time centered, status absolutely below */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: '50%', perspective: '600px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', overflow: 'hidden', height: '58px' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {isFinished ? (
                  <motion.div
                    key="finished"
                    ref={finishedRef}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ fontSize: '52px', fontWeight: 500, color: accentColor, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, whiteSpace: 'nowrap' }}
                  >
                    00:00
                  </motion.div>
                ) : (
                  <motion.div key="digits" initial={false} animate={{}} style={{ display: 'flex', alignItems: 'center' }}>
                    {displayTime.split('').map((char, i) => {
                      const charStyle = { fontSize: '52px', fontWeight: 500, color: '#e9e7ee', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, display: 'block', textAlign: 'center' };
                      const variant = TIME_ANIM_VARIANTS[timeAnimation];
                      return (
                        <div key={DIGIT_POS_KEYS[i]} style={{ overflow: 'hidden', height: '58px', display: 'flex', alignItems: 'center' }}>
                          <AnimatePresence mode="wait" initial={false}>
                            {variant
                              ? <motion.div key={`${i}-${char}`} {...variant} style={charStyle}>{char}</motion.div>
                              : <div key={`${i}-${char}`} style={charStyle}>{char}</div>
                            }
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Status label below center */}
            <div style={{ position: 'absolute', top: 'calc(50% + 40px)', left: 0, right: 0, textAlign: 'center', fontSize: '12px', letterSpacing: '2px', color: '#77747e' }}>{stateLabel}</div>
          </div>
        </div>

        {/* Hint text */}
        <div style={{ textAlign: 'center', fontSize: '11px', letterSpacing: '0.1em', color: '#5c5a62' }}>{hintText}</div>

        {/* Preset buttons */}
        {isIdle && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button key={p.label} onClick={p.select} style={{ padding: '8px 14px', borderRadius: '20px', border: `1px solid ${p.border}`, background: p.bg, color: p.color, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.05em', cursor: 'pointer' }}>{p.label}</button>
            ))}
          </div>
        )}

        {/* Adjust row */}
        {showAdjustRow && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {[[-60, '-1M'], [-10, '-10S'], [10, '+10S'], [60, '+1M']].map(([delta, label]) => (
              <button key={label} onClick={() => adjustTime(delta)} style={{ padding: '8px 14px', borderRadius: '20px', border: '1px solid #33323a', background: '#1c1c1f', color: '#9d9aa4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        )}

        {/* Reset row */}
        {showResetRow && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={reset} style={{ padding: '9px 22px', borderRadius: '20px', border: '1px solid #33323a', background: '#1c1c1f', color: '#9d9aa4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.1em', cursor: 'pointer' }}>RESET</button>
          </div>
        )}

      </div>

      {/* Settings drawer */}
      {showSettings && (
        <button type="button" onClick={(e) => { if (e.target === e.currentTarget) closeSettingsBackdrop(); }} onKeyDown={(e) => e.key === 'Escape' && closeSettingsBackdrop()} style={{ all: 'unset', position: 'fixed', inset: 0, background: 'rgba(8,8,9,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 20, cursor: 'default' }}>
          <dialog open style={{ width: '280px', maxWidth: '85vw', height: '100%', background: '#17171a', borderLeft: '1px solid #2a292f', borderTop: 'none', borderRight: 'none', borderBottom: 'none', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '22px', color: '#e9e7ee', margin: 0, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', letterSpacing: '0.12em', color: '#8a8890' }}>SETTINGS</div>
              <button onClick={toggleSettings} style={{ background: 'none', border: 'none', color: '#8a8890', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>ACCENT</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {ACCENT_COLORS.map((c) => (
                    <button key={c} onClick={() => setAccentColor(c)} aria-label={c} style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: `2px solid ${accentColor === c ? '#e9e7ee' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>ALARM SOUND</div>
                <button onClick={() => setSoundOn((s) => !s)} style={{ width: '42px', height: '24px', borderRadius: '14px', border: '1px solid #33323a', background: soundOn ? accentColor : '#232227', position: 'relative', cursor: 'pointer' }}>
                  <div style={soundKnobStyle} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>DIAL CLICK</div>
                <button onClick={() => setTickSoundOn((s) => !s)} style={{ width: '42px', height: '24px', borderRadius: '14px', border: '1px solid #33323a', background: tickSoundOn ? accentColor : '#232227', position: 'relative', cursor: 'pointer' }}>
                  <div style={tickKnobStyle} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>TIME ANIM</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {TIME_ANIMS.map((opt) => (
                    <button key={opt} onClick={() => setTimeAnimation(opt)} style={{ padding: '4px 7px', borderRadius: '10px', border: `1px solid ${timeAnimation === opt ? accentColor : '#33323a'}`, background: timeAnimation === opt ? accentColor : '#1c1c1f', color: timeAnimation === opt ? '#161618' : '#9d9aa4', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '0.04em' }}>{opt.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: '#26252a' }} />
            <div style={{ fontSize: '11px', letterSpacing: '0.05em', color: '#5c5a62', lineHeight: 1.6 }}>
              DRAG THE RING TO SET MINUTES. PRESS CENTER TO START / PAUSE. MAX {maxMinutes} MIN PER SESSION.
            </div>
          </dialog>
        </button>
      )}
    </div>
  );
}
