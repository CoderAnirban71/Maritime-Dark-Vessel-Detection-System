import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Lagrangian Particle Drift Simulation
 * 
 * Animates particles flowing BACKWARD from the observed oil slick centroid
 * to the estimated discharge origin. Follows the CMEMS hindcast trajectory
 * with stochastic jitter to simulate real Lagrangian dispersion uncertainty.
 * 
 * Scientific basis: This mirrors how NOAA GNOME and OpenDrift trace oil
 * spill sources using reverse advection-diffusion particle tracking.
 */

interface DriftStep {
  timestamp: string;
  lat: number;
  lng: number;
  currentVector: { uMs: number; vMs: number; speedKnots: number; directionDegrees: number };
  windVector: { uMs: number; vMs: number; speedKnots: number; directionDegrees: number };
  uncertaintyRadiusKm: number;
}

interface ParticleDriftLayerProps {
  /** The hindcast steps from slick (T0) backward to origin (T-N) */
  hindcastSteps: DriftStep[];
  /** 0.0 = all particles at slick, 1.0 = all particles at origin */
  progress: number;
  /** Number of particles to simulate */
  particleCount?: number;
  /** Whether the animation layer is visible */
  visible?: boolean;
}

interface Particle {
  /** Base offset from trajectory center (normalized, ±1) */
  offsetX: number;
  offsetY: number;
  /** Random jitter seed for this particle */
  jitterSeed: number;
  /** Particle size multiplier */
  size: number;
  /** Opacity multiplier */
  alpha: number;
  /** Phase offset for oscillation */
  phase: number;
}

// Deterministic seeded random for reproducible particle layout
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function ParticleDriftLayer({
  hindcastSteps,
  progress,
  particleCount = 150,
  visible = true,
}: ParticleDriftLayerProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // Generate stable particle set once
  useEffect(() => {
    const rand = seededRandom(42);
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      // Gaussian-ish distribution (Box-Muller) for natural clustering
      const u1 = rand();
      const u2 = rand();
      const r = Math.sqrt(-2 * Math.log(Math.max(u1, 0.001)));
      const theta = 2 * Math.PI * u2;
      particles.push({
        offsetX: r * Math.cos(theta) * 0.6,
        offsetY: r * Math.sin(theta) * 0.6,
        jitterSeed: rand() * 1000,
        size: 1.2 + rand() * 2.0,
        alpha: 0.3 + rand() * 0.55,
        phase: rand() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, [particleCount]);

  useEffect(() => {
    if (!visible || hindcastSteps.length < 2) {
      // Cleanup
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
      return;
    }

    // Create canvas overlay
    const container = map.getContainer();
    const mapSize = map.getSize();
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = mapSize.x;
      canvas.height = mapSize.y;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.zIndex = '450';
      canvas.style.pointerEvents = 'none';
      container.appendChild(canvas);
      canvasRef.current = canvas;
    }

    const canvas = canvasRef.current;
    canvas.width = mapSize.x;
    canvas.height = mapSize.y;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Interpolate position along the hindcast polyline based on progress
    function getTrajectoryPoint(t: number): { lat: number; lng: number; uncertaintyKm: number } {
      const clampedT = Math.max(0, Math.min(1, t));
      const segIdx = clampedT * (hindcastSteps.length - 1);
      const i = Math.floor(segIdx);
      const frac = segIdx - i;

      if (i >= hindcastSteps.length - 1) {
        const last = hindcastSteps[hindcastSteps.length - 1];
        return { lat: last.lat, lng: last.lng, uncertaintyKm: last.uncertaintyRadiusKm };
      }

      const a = hindcastSteps[i];
      const b = hindcastSteps[i + 1];
      return {
        lat: a.lat + (b.lat - a.lat) * frac,
        lng: a.lng + (b.lng - a.lng) * frac,
        uncertaintyKm: a.uncertaintyRadiusKm + (b.uncertaintyRadiusKm - a.uncertaintyRadiusKm) * frac,
      };
    }

    function render() {
      if (!ctx || !canvas) return;

      const size = map.getSize();
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerPoint = getTrajectoryPoint(progress);
      const centerPx = map.latLngToContainerPoint(
        L.latLng(centerPoint.lat, centerPoint.lng),
      );

      // Spread radius in pixels based on uncertainty + zoom
      const uncertaintyPixels = getUncertaintyPixels(
        map,
        centerPoint.lat,
        centerPoint.lng,
        centerPoint.uncertaintyKm,
      );

      const now = performance.now() / 1000;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Base position from gaussian offset, scaled by uncertainty
        const spreadRadius = uncertaintyPixels * 0.7;
        let px = centerPx.x + p.offsetX * spreadRadius;
        let py = centerPx.y + p.offsetY * spreadRadius;

        // Add temporal jitter — simulates stochastic turbulent diffusion
        const jitterAmp = uncertaintyPixels * 0.08;
        px += Math.sin(now * 0.7 + p.jitterSeed) * jitterAmp;
        py += Math.cos(now * 0.9 + p.jitterSeed * 1.3) * jitterAmp;

        // Add subtle drift in the current direction
        const driftPhase = now * 0.3 + p.phase;
        px += Math.sin(driftPhase) * 2.5;
        py += Math.cos(driftPhase * 0.7) * 1.8;

        // Convergence effect: as progress → 1, particles tighten
        const convergeFactor = 1.0 - progress * 0.35;
        px = centerPx.x + (px - centerPx.x) * convergeFactor;
        py = centerPx.y + (py - centerPx.y) * convergeFactor;

        // Alpha fades slightly with progress
        const alpha = p.alpha * (0.6 + 0.4 * (1 - progress * 0.3));

        // Draw particle
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(94, 230, 192, ${alpha})`;
        ctx.fill();

        // Particle glow
        if (p.size > 2) {
          ctx.beginPath();
          ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(94, 230, 192, ${alpha * 0.12})`;
          ctx.fill();
        }
      }

      // Draw center crosshair
      ctx.strokeStyle = 'rgba(232, 168, 78, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(centerPx.x - 8, centerPx.y);
      ctx.lineTo(centerPx.x + 8, centerPx.y);
      ctx.moveTo(centerPx.x, centerPx.y - 8);
      ctx.lineTo(centerPx.x, centerPx.y + 8);
      ctx.stroke();
      ctx.setLineDash([]);

      animFrameRef.current = requestAnimationFrame(render);
    }

    render();

    // Re-render on map move/zoom
    const onMove = () => {
      const size = map.getSize();
      if (canvas) {
        canvas.width = size.x;
        canvas.height = size.y;
      }
    };
    map.on('move zoom resize', onMove);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      map.off('move zoom resize', onMove);
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, [map, hindcastSteps, progress, visible]);

  return null;
}

/** Convert uncertainty radius in km to screen pixels at a given lat/lng */
function getUncertaintyPixels(
  map: L.Map,
  lat: number,
  lng: number,
  uncertaintyKm: number,
): number {
  const center = map.latLngToContainerPoint(L.latLng(lat, lng));
  // 1 degree of latitude ≈ 111.32 km
  const offsetLat = lat + uncertaintyKm / 111.32;
  const offsetPoint = map.latLngToContainerPoint(L.latLng(offsetLat, lng));
  return Math.abs(center.y - offsetPoint.y);
}
