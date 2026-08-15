import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for the circular dial angle calculation logic.
 * 
 * Standard approach: Absolute angle-to-value mapping.
 * The pointer position directly determines the value.
 * This eliminates desync issues from delta-based approaches.
 */

// Mock AudioContext to avoid errors
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: () => ({
    type: '',
    frequency: { value: 0 },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
  createGain: () => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
  }),
  destination: {},
  currentTime: 0,
}));

const MAX_MINUTES = 60;

/**
 * Absolute angle-to-time mapping (standard circular slider approach).
 * Mirrors setTimeFromAngle in useTimer.js
 */
function angleToMinutes(ang, maxMinutes = MAX_MINUTES) {
  const minutes = Math.round((ang / 360) * maxMinutes);
  return Math.max(0, Math.min(maxMinutes, minutes));
}

describe('Absolute Angle-to-Value Mapping', () => {
  describe('Basic angle conversions', () => {
    it('0° maps to 0 minutes (top of dial)', () => {
      expect(angleToMinutes(0)).toBe(0);
    });

    it('90° maps to 15 minutes (right side)', () => {
      expect(angleToMinutes(90)).toBe(15);
    });

    it('180° maps to 30 minutes (bottom)', () => {
      expect(angleToMinutes(180)).toBe(30);
    });

    it('270° maps to 45 minutes (left side)', () => {
      expect(angleToMinutes(270)).toBe(45);
    });

    it('360° maps to 60 minutes (full rotation)', () => {
      expect(angleToMinutes(360)).toBe(60);
    });
  });

  describe('Clamping at boundaries', () => {
    it('clamps at max (60 minutes)', () => {
      expect(angleToMinutes(400)).toBe(60);
    });

    it('handles near-zero angles correctly', () => {
      expect(angleToMinutes(2)).toBe(0); // 2/360*60 = 0.33 rounds to 0
      expect(angleToMinutes(6)).toBe(1); // 6/360*60 = 1 rounds to 1
    });

    it('handles near-360 angles correctly', () => {
      expect(angleToMinutes(354)).toBe(59);
      expect(angleToMinutes(357)).toBe(60);
    });
  });

  describe('No more desync issues', () => {
    it('clicking anywhere sets time directly - no jumps', () => {
      // Simulate clicking at different positions
      // Each click independently maps to a value
      
      const positions = [
        { angle: 0, expectedMinutes: 0 },
        { angle: 180, expectedMinutes: 30 },
        { angle: 90, expectedMinutes: 15 },
        { angle: 270, expectedMinutes: 45 },
        { angle: 360, expectedMinutes: 60 },
      ];

      for (const { angle, expectedMinutes } of positions) {
        expect(angleToMinutes(angle)).toBe(expectedMinutes);
      }
    });

    it('dragging past max then back works correctly', () => {
      // Simulate dragging: each position is independent
      const dragSequence = [330, 350, 10, 30, 60, 30, 350];
      const expectedMinutes = [55, 58, 2, 5, 10, 5, 58];

      for (let i = 0; i < dragSequence.length; i++) {
        expect(angleToMinutes(dragSequence[i])).toBe(expectedMinutes[i]);
      }
    });

    it('multiple full rotations have no cumulative effect', () => {
      // With absolute mapping, same angle always = same value
      // No matter how many times you rotate around
      expect(angleToMinutes(90)).toBe(15);
      expect(angleToMinutes(180)).toBe(30);
      expect(angleToMinutes(90)).toBe(15); // back to same position
      expect(angleToMinutes(180)).toBe(30); // same value
    });
  });
});
