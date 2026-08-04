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
      // re-anchor wall clock so background timing stays correct after adjustment
      startedAtRef.current = Date.now();
      secsAtStartRef.current = next;
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
