import { useState, useRef, useEffect } from 'react';
import { useAnimate } from 'motion/react';

const DRAG_PX_PER_STEP = 8;

export function useTimer({ maxMinutes = 60, tickSoundEnabled = true } = {}) {
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

  const svgRef = useRef(null);
  const audioRef = useRef(null);
  const countRef = useRef(null);
  const alarmRef = useRef(null);
  const draggingRef = useRef(false);
  const centerDraggedRef = useRef(false);
  const remainingRef = useRef(0);
  const setupSecsRef = useRef(60);
  // wall-clock anchor for background-safe timing
  const startedAtRef = useRef(null);
  const secsAtStartRef = useRef(0);
  const soundOnRef = useRef(soundOn);
  const tickSoundOnRef = useRef(tickSoundOn);

  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { tickSoundOnRef.current = tickSoundOn; }, [tickSoundOn]);
  useEffect(() => {
    if (isFinished && finishedRef.current) {
      animateFinished(finishedRef.current,
        { scale: [1, 0.82, 1], opacity: [1, 0.45, 1] },
        { duration: 0.45, ease: 'easeOut' }
      );
    }
  }, [alarmPulse]);
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

  function playTone({ frequency, volume = 1, decay = 0.1, delay = 0, type = 'sine', attack = 0, initialVolume = volume }) {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(initialVolume, ctx.currentTime + delay);
    if (attack > 0) {
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + attack);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + decay + 0.01);
  }

  function playClick() {
    if (!tickSoundOnRef.current) return;
    playTone({ frequency: 1200, volume: 0.25, decay: 0.045, type: 'square' });
  }

  function playThunk() {
    playTone({ frequency: 220, decay: 0.15 });
  }

  function playPause() {
    [0, 0.15].forEach((delay) => {
      playTone({ frequency: 250, decay: 0.06, delay });
    });
  }

  function playAlarmBeep() {
    if (!soundOnRef.current) return;
    [0, 0.18].forEach((delay) => {
      playTone({ frequency: 880, volume: 0.5, decay: 0.16, delay, type: 'triangle', attack: 0.02, initialVolume: 0.001 });
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
    startedAtRef.current = Date.now();
    secsAtStartRef.current = remainingRef.current;
    countRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const next = secsAtStartRef.current - elapsed;
      if (next <= 0) {
        clearInterval(countRef.current);
        remainingRef.current = 0;
        setRemainingSeconds(0);
        finish();
      } else if (next !== remainingRef.current) {
        remainingRef.current = next;
        setRemainingSeconds(next);
      }
    }, 500);
  }

  function start() {
    if (setupSecs <= 0) return;
    playThunk();
    remainingRef.current = setupSecs;
    setRemainingSeconds(setupSecs);
    setIsRunning(true);
    setIsPaused(false);
    setIsFinished(false);
    runInterval();
  }

  function pause() {
    clearInterval(countRef.current);
    playPause();
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

  function setRemainingTime(seconds) {
    remainingRef.current = seconds;
    setRemainingSeconds(seconds);
    startedAtRef.current = Date.now();
    secsAtStartRef.current = seconds;
  }

  function adjustTime(deltaSeconds) {
    if (!isRunning && !isPaused) return;
    playClick();
    let next = remainingRef.current + deltaSeconds;
    next = Math.max(0, Math.min(maxMinutes * 60, next));
    if (next <= 0) {
      if (isRunning) { clearInterval(countRef.current); finish(); }
      setRemainingTime(0);
    } else {
      setRemainingTime(next);
    }
  }

  // ── Dial interaction ──────────────────────────────────────────────────────

  function angleFromPointer(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Calculate angle with 0° at top, increasing clockwise
    let ang = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * (180 / Math.PI);
    if (ang < 0) ang += 360;
    return ang;
  }

  /**
   * Standard circular slider approach: absolute angle-to-value mapping.
   * The pointer position directly determines the value - no delta tracking needed.
   * This eliminates desync issues that occur with relative/delta-based approaches.
   */
  function setTimeFromAngle(ang) {
    // Direct angle-to-time mapping: 0° = 0 min, 90° = 15 min, 180° = 30 min, etc.
    const minutes = Math.round((ang / 360) * maxMinutes);
    const clampedMinutes = Math.max(0, Math.min(maxMinutes, minutes));
    if (clampedMinutes !== setupSecsRef.current / 60) {
      setupSecsRef.current = clampedMinutes * 60;
      playClick();
      setSetupSecs(clampedMinutes * 60);
    }
  }

  function onDialPointerDown(e) {
    if (isRunning || isFinished) return;
    e.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);
    
    if (isPaused) {
      // When paused: snap to minutes based on drag direction
      const startAngle = angleFromPointer(e);
      const startSeconds = remainingRef.current;
      // Round to nearest minute as baseline
      let baseMinutes = Math.round(startSeconds / 60);
      let lastSnappedMinutes = baseMinutes;
      
      const move = (ev) => {
        if (!draggingRef.current) return;
        const currentAngle = angleFromPointer(ev);
        let delta = currentAngle - startAngle;
        // Normalize delta to [-180, 180]
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        
        // Convert angle delta to minute steps (6 degrees per minute on 60-min dial)
        const degreesPerMinute = 360 / maxMinutes;
        const minuteSteps = Math.round(delta / degreesPerMinute);
        const targetMinutes = Math.max(0, Math.min(maxMinutes, baseMinutes + minuteSteps));
        
        if (targetMinutes !== lastSnappedMinutes) {
          const snappedSeconds = targetMinutes * 60;
          playClick();
          setRemainingTime(snappedSeconds);
          lastSnappedMinutes = targetMinutes;
        }
      };
      
      const up = () => {
        draggingRef.current = false;
        setIsDragging(false);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    } else {
      // When idle: set time directly from pointer position (absolute mapping)
      setTimeFromAngle(angleFromPointer(e));
      const move = (ev) => {
        if (draggingRef.current) {
          setTimeFromAngle(angleFromPointer(ev));
        }
      };
      const up = () => {
        draggingRef.current = false;
        setIsDragging(false);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }
  }

  const isIdle = !isRunning && !isPaused && !isFinished;

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

  function onCenterPointerDown(e) {
    e.stopPropagation();
    if (isRunning || isFinished) return;
    setIsCenterDragging(true);
    centerDraggedRef.current = false;
    let accum = 0;
    let totalMoved = 0;
    let prevY = e.clientY;
    const pausedBaseMinutes = isPaused ? Math.round(remainingRef.current / 60) : 0;
    let pausedSteps = 0;
    const move = (ev) => {
      const dy = ev.clientY - prevY;
      prevY = ev.clientY;
      totalMoved += Math.abs(dy);
      if (totalMoved > 4) centerDraggedRef.current = true;
      accum += dy;
      const steps = Math.trunc(accum / DRAG_PX_PER_STEP);
      if (steps !== 0) {
        accum -= steps * DRAG_PX_PER_STEP;
        if (isPaused) {
          // When paused: adjust remaining time, snap to minutes
          pausedSteps += steps;
          const nextMinutes = Math.max(0, Math.min(maxMinutes, pausedBaseMinutes - pausedSteps));
          const nextSeconds = nextMinutes * 60;
          if (nextSeconds !== remainingRef.current) {
            playClick();
            setRemainingTime(nextSeconds);
          }
        } else {
          // When idle: adjust setup time
          const next = Math.max(0, Math.min(maxMinutes * 60, setupSecsRef.current - steps * 10));
          if (next !== setupSecsRef.current) { playClick(); setupSecsRef.current = next; setSetupSecs(next); }
        }
      }
    };
    const up = () => {
      setIsCenterDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function toggleSettings(e) {
    e?.stopPropagation();
    setShowSettings((s) => !s);
  }

  return {
    setupSecs, setSetupSecs, setupSecsRef,
    remainingSeconds,
    isRunning, isPaused, isFinished, isIdle,
    showSettings, toggleSettings, closeSettingsBackdrop: () => setShowSettings(false),
    soundOn, setSoundOn,
    tickSoundOn, setTickSoundOn,
    pulseTick,
    isDragging, isCenterDragging,
    timeAnimation, setTimeAnimation,
    alarmPulse, finishedRef,
    svgRef,
    handleCenterClick, onDialPointerDown, onCenterPointerDown,
    selectPreset, adjustTime, reset,
  };
}
