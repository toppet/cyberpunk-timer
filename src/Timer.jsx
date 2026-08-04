import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';

const TICK_COUNT = 60;

const TICKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const isMajor = i % 5 === 0;
  return {
    y1: 190 - 158,
    y2: 190 - (isMajor ? 136 : 146),
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

export default function Timer({
  accentColor = '#8e8ba8',
  maxMinutes = 60,
  tickSoundEnabled = true,
}) {
  const [setupSecs, setSetupSecs] = useState(60);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [tickSoundOn, setTickSoundOn] = useState(tickSoundEnabled);
  const [pulseTick, setPulseTick] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCenterDragging, setIsCenterDragging] = useState(false);
  const [timeAnimation, setTimeAnimation] = useState('slide');
  const [alarmPulse, setAlarmPulse] = useState(0);
  const [finishedRef, animateFinished] = useAnimate();

  // Imperatively replay the pulse on each alarm beat — avoids remounting the element
  useEffect(() => {
    if (isFinished && finishedRef.current) {
      animateFinished(finishedRef.current,
        { scale: [1, 0.82, 1], opacity: [1, 0.45, 1] },
        { duration: 0.45, ease: 'easeOut' }
      );
    }
  }, [alarmPulse]);

  const svgRef = useRef(null);
  const audioRef = useRef(null);
  const countRef = useRef(null);
  const alarmRef = useRef(null);
  const draggingRef = useRef(false);
  const centerDraggedRef = useRef(false);

  // Refs used inside interval/event closures — always reflect latest values
  const remainingRef = useRef(0);
  const setupSecsRef = useRef(60);
  const soundOnRef = useRef(soundOn);
  const tickSoundOnRef = useRef(tickSoundOn);

  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { tickSoundOnRef.current = tickSoundOn; }, [tickSoundOn]);

  useEffect(() => () => {
    clearInterval(countRef.current);
    clearInterval(alarmRef.current);
  }, []);

  // ── Audio ─────────────────────────────────────────────────────────────────

  function getAudio() {
    if (!audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioRef.current = new AC();
    }
    return audioRef.current;
  }

  function playClick() {
    if (!tickSoundOnRef.current) return;
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  function playThunk() {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  function playAlarmBeep() {
    if (!soundOnRef.current) return;
    const ctx = getAudio();
    [0, 0.18].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  }

  // ── Timer logic ───────────────────────────────────────────────────────────

  function finish() {
    setIsRunning(false);
    setIsPaused(false);
    setIsFinished(true);
    setAlarmPulse(1);
    playAlarmBeep();
    // increment alarmPulse in the same tick as the sound so the pulse stays in sync
    alarmRef.current = setInterval(() => { playAlarmBeep(); setAlarmPulse((n) => n + 1); }, 1500);
  }

  function runInterval() {
    countRef.current = setInterval(() => {
      const next = remainingRef.current - 1;
      if (next <= 0) {
        clearInterval(countRef.current);
        remainingRef.current = 0;
        setRemainingSeconds(0);
        finish();
      } else {
        remainingRef.current = next;
        setRemainingSeconds(next);
      }
    }, 1000);
  }

  function start() {
    if (setupSecs <= 0) return;
    playThunk();
    const secs = setupSecs;
    remainingRef.current = secs;
    setRemainingSeconds(secs);
    setIsRunning(true);
    setIsPaused(false);
    setIsFinished(false);
    runInterval();
  }

  function pause() {
    clearInterval(countRef.current);
    playThunk();
    setIsRunning(false);
    setIsPaused(true);
  }

  function resume() {
    playThunk();
    setIsRunning(true);
    setIsPaused(false);
    runInterval();
  }

  function reset() {
    clearInterval(countRef.current);
    clearInterval(alarmRef.current);
    playThunk();
    setIsRunning(false);
    setIsPaused(false);
    setIsFinished(false);
    setAlarmPulse(0);
    remainingRef.current = 0;
    setRemainingSeconds(0);
  }

  function adjustTime(deltaSeconds) {
    if (!isRunning && !isPaused) return;
    playClick();
    let next = remainingRef.current + deltaSeconds;
    next = Math.max(0, Math.min(maxMinutes * 60, next));
    if (next <= 0) {
      if (isRunning) { clearInterval(countRef.current); finish(); }
      remainingRef.current = 0;
      setRemainingSeconds(0);
    } else {
      remainingRef.current = next;
      setRemainingSeconds(next);
    }
  }

  // ── Dial interaction ──────────────────────────────────────────────────────

  function angleFromPointer(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let ang = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * (180 / Math.PI);
    if (ang < 0) ang += 360;
    return ang;
  }

  function updateFromPointer(e) {
    const ang = angleFromPointer(e);
    let minutes = Math.round((ang / 360) * maxMinutes);
    minutes = Math.max(0, Math.min(maxMinutes, minutes));
    if (minutes !== setupSecsRef.current / 60) {
      setupSecsRef.current = minutes * 60;
      playClick();
      setSetupSecs(minutes * 60);
    }
  }

  function onDialPointerDown(e) {
    if (isRunning || isPaused || isFinished) return;
    e.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);
    updateFromPointer(e);
    const move = (ev) => draggingRef.current && updateFromPointer(ev);
    const up = () => {
      draggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function handleCenterClick(e) {
    e.stopPropagation();
    if (centerDraggedRef.current) { centerDraggedRef.current = false; return; }
    setPulseTick((n) => n + 1);
    if (isFinished) reset();
    else if (isRunning) pause();
    else if (isPaused) resume();
    else start();
  }

  function selectPreset(minutes) {
    playClick();
    setupSecsRef.current = minutes * 60;
    setSetupSecs(minutes * 60);
  }

  // 8px of vertical drag per 10-second step
  const DRAG_PX_PER_STEP = 8;

  function onCenterPointerDown(e) {
    e.stopPropagation();
    if (!isIdle) return;
    setIsCenterDragging(true);
    centerDraggedRef.current = false;
    let accum = 0;
    let totalMoved = 0;
    let prevY = e.clientY;
    const move = (ev) => {
      const dy = ev.clientY - prevY;
      prevY = ev.clientY;
      totalMoved += Math.abs(dy);
      if (totalMoved > 4) centerDraggedRef.current = true;
      accum += dy;
      const steps = Math.trunc(accum / DRAG_PX_PER_STEP);
      if (steps !== 0) {
        accum -= steps * DRAG_PX_PER_STEP;
        const next = Math.max(0, Math.min(maxMinutes * 60, setupSecsRef.current - steps * 10));
        if (next !== setupSecsRef.current) { playClick(); setupSecsRef.current = next; setSetupSecs(next); }
      }
    };
    const up = () => { setIsCenterDragging(false); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function stopProp(e) { e.stopPropagation(); }

  function toggleSettings(e) {
    e?.stopPropagation();
    setShowSettings((s) => !s);
  }

  function closeSettingsBackdrop() {
    setShowSettings(false);
  }

  // ── Derived render values ─────────────────────────────────────────────────

  const fmt = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  let remaining;
  if (isRunning || isPaused) remaining = remainingSeconds;
  else if (isFinished) remaining = 0;
  else remaining = setupSecs;
  const fraction = maxMinutes > 0 ? remaining / (maxMinutes * 60) : 0;
  const arcOffset = CIRCUMFERENCE * (1 - fraction);
  const angleDeg = fraction * 360;
  // Endpoint of the arc for the fake round cap circle
  const capAngleRad = (angleDeg - 90) * (Math.PI / 180);
  const capX = 190 + 150 * Math.cos(capAngleRad);
  const capY = 190 + 150 * Math.sin(capAngleRad);

  const isIdle = !isRunning && !isPaused && !isFinished;
  const showResetRow = isPaused || isFinished;
  const showAdjustRow = isRunning || isPaused;

  let stateLabel = 'SET TIME';
  if (isRunning) stateLabel = 'RUNNING';
  else if (isPaused) stateLabel = 'PAUSED';
  else if (isFinished) stateLabel = 'TIME UP';
  let hintText = 'DRAG RING TO SET · PRESS CENTER TO START';
  if (isRunning) hintText = 'PRESS CENTER TO PAUSE';
  else if (isPaused) hintText = 'PRESS CENTER TO RESUME';
  else if (isFinished) hintText = 'PRESS CENTER OR RESET TO CLEAR';

  const displayTime = isFinished ? '00:00' : fmt(isRunning || isPaused ? remainingSeconds : setupSecs);

  const presets = [5, 10, 15, 25, 45, 60]
    .filter((m) => m <= maxMinutes)
    .map((m) => ({
      label: `${m}M`,
      select: () => selectPreset(m),
      bg: setupSecs === m * 60 ? accentColor : '#1c1c1f',
      color: setupSecs === m * 60 ? '#161618' : '#9d9aa4',
      border: setupSecs === m * 60 ? accentColor : '#33323a',
    }));

  const arcStyle = { transition: 'stroke-dashoffset .3s linear' };

  const pulseStyle = {
    animation: `${pulseTick % 2 === 0 ? 'centerPulse' : 'centerPulse2'} 0.35s ease-out`,
    transformOrigin: '190px 190px',
  };
  const flashStyle = pulseTick > 0
    ? { animation: 'centerFlash 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }
    : {};

  const TIME_ANIMS = ['none', 'fade', 'slide', 'flip'];

  const knobBase = { position: 'absolute', top: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#f3f1f6', transition: 'left .15s ease' };
  const soundKnobStyle = { ...knobBase, left: soundOn ? '20px' : '2px' };
  const tickKnobStyle = { ...knobBase, left: tickSoundOn ? '20px' : '2px' };

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            </svg>
          </button>
        </div>

        {/* Dial */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 380 380" style={{ touchAction: 'none', userSelect: 'none', overflow: 'visible' }}>
            <circle cx="190" cy="190" r="165" fill="#181819" stroke="#26252a" strokeWidth="1" />
            <circle cx="190" cy="190" r="150" fill="none" stroke="#232227" strokeWidth="10" />

            {TICKS.map((t) => (
              <line key={t.transform} x1="190" y1={t.y1} x2="190" y2={t.y2} stroke={t.color} strokeWidth={t.width} transform={t.transform} />
            ))}

            {!isFinished && fraction > 0 && <circle cx="190" cy="190" r="150" fill="none" stroke={accentColor} strokeWidth="10" strokeLinecap="butt" strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`} strokeDashoffset={arcOffset} transform="rotate(-90 190 190)" style={arcStyle} />}

            {/* Invisible wide ring — drag target */}
            <circle cx="190" cy="190" r="150" fill="none" stroke="transparent" strokeWidth="70" onPointerDown={onDialPointerDown} style={{ cursor: isIdle ? (isDragging ? 'grabbing' : 'grab') : 'default' }} />

            {/* Pointer needle — visible line + wide invisible hit area */}
            <g transform={`rotate(${angleDeg} 190 190)`} onPointerDown={onDialPointerDown} style={{ cursor: isIdle ? (isDragging ? 'grabbing' : 'grab') : 'default' }}>
              <line x1="190" y1="32" x2="190" y2="78" stroke="transparent" strokeWidth="20" />
              <line x1="190" y1="42" x2="190" y2="72" stroke="#e53935" strokeWidth="5" strokeLinecap="round" />
            </g>

            {/* Center button */}
            <circle cx="190" cy="190" r="106" fill="#1a1a1d" stroke="#2c2b31" strokeWidth="1" onClick={handleCenterClick} onPointerDown={onCenterPointerDown} style={{ cursor: isCenterDragging ? 'ns-resize' : 'pointer', ...pulseStyle }} />
          </svg>

          {/* Time overlay — time centered, status absolutely below */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: '50%', perspective: '600px', ...flashStyle }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', overflow: 'hidden', height: '58px' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {isFinished ? (
                  /* Finished: pulse driven imperatively by useAnimate, no key remount */
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
                  /* Running/idle: animate each digit independently */
                  <motion.div key="digits" initial={false} animate={{}} style={{ display: 'flex', alignItems: 'center' }}>
                    {displayTime.split('').map((char, i) => {
                      const charStyle = { fontSize: '52px', fontWeight: 500, color: '#e9e7ee', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1, display: 'block', textAlign: 'center' };
                      const variant = TIME_ANIM_VARIANTS[timeAnimation];
                      return (
                        <div key={i} style={{ overflow: 'hidden', height: '58px', display: 'flex', alignItems: 'center' }}>
                          <AnimatePresence mode="wait" initial={false}>
                            {variant ? (
                              <motion.div key={`${i}-${char}`} {...variant} style={charStyle}>{char}</motion.div>
                            ) : (
                              <div key={`${i}-${char}`} style={charStyle}>{char}</div>
                            )}
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
        <div role="presentation" onClick={closeSettingsBackdrop} onKeyDown={(e) => e.key === 'Escape' && closeSettingsBackdrop()} style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,9,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 20 }}>
          <div role="dialog" aria-modal="true" aria-label="Settings" onClick={stopProp} onKeyDown={stopProp} style={{ width: '280px', maxWidth: '85vw', height: '100%', background: '#17171a', borderLeft: '1px solid #2a292f', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '22px', color: '#e9e7ee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', letterSpacing: '0.12em', color: '#8a8890' }}>SETTINGS</div>
              <button onClick={toggleSettings} style={{ background: 'none', border: 'none', color: '#8a8890', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>ALARM SOUND</div>
                <button onClick={(e) => { e.stopPropagation(); setSoundOn((s) => !s); }} style={{ width: '42px', height: '24px', borderRadius: '14px', border: '1px solid #33323a', background: soundOn ? accentColor : '#232227', position: 'relative', cursor: 'pointer' }}>
                  <div style={soundKnobStyle} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>DIAL CLICK</div>
                <button onClick={(e) => { e.stopPropagation(); setTickSoundOn((s) => !s); }} style={{ width: '42px', height: '24px', borderRadius: '14px', border: '1px solid #33323a', background: tickSoundOn ? accentColor : '#232227', position: 'relative', cursor: 'pointer' }}>
                  <div style={tickKnobStyle} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.06em' }}>TIME ANIM</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {TIME_ANIMS.map((opt) => (
                    <button key={opt} onClick={(e) => { e.stopPropagation(); setTimeAnimation(opt); }} style={{ padding: '4px 7px', borderRadius: '10px', border: `1px solid ${timeAnimation === opt ? accentColor : '#33323a'}`, background: timeAnimation === opt ? accentColor : '#1c1c1f', color: timeAnimation === opt ? '#161618' : '#9d9aa4', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', cursor: 'pointer', letterSpacing: '0.04em' }}>{opt.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: '#26252a' }} />
            <div style={{ fontSize: '11px', letterSpacing: '0.05em', color: '#5c5a62', lineHeight: 1.6 }}>
              DRAG THE RING TO SET MINUTES. PRESS CENTER TO START / PAUSE. MAX {maxMinutes} MIN PER SESSION.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
