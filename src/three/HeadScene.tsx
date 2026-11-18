/**
 * The hero's 3D scene: the head drawn in scan lines, lit softly, breathing on Calm breath's rhythm. It
 * turns where the scan (src/scripts/hero-scan.ts) points it: toward the cursor, the arrow keys, or the
 * scan that runs by itself. When the ring fills a tick, the scan lines in that direction light mint and
 * settle to a faint tint, so the head shows what has been scanned; when the scan completes, the head
 * pulses once and the tint fades.
 *
 * Loaded lazily by src/scripts/hero.ts after first paint, never under Reduce Motion, without WebGL, or
 * on a slow device. It pauses whenever it is off screen or the tab is hidden.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import type { HeadPoints } from './head';

/** Where the head rests: facing forward, a touch off square so it does not look frozen. */
const BASE_YAW = -0.1;
const BASE_PITCH = 0;
/** How much of a scanned direction's mint stays on the head until the scan completes. */
const SCANNED_TINT = 0.22;
/** Point size in CSS pixels on a 600 px stage; it scales with the stage. */
const POINT_SIZE = 2.1;
/** Calm breath: 4 s in and 4 s out (the holds are left out so the head never freezes). */
const BREATH_SECONDS = 8;

export interface SceneHandle {
  /** Where the head points, in the scan's degrees (src/lib/scan.ts): right and up from straight ahead. */
  look(right: number, up: number): void;
  /** A ring tick filled (0...59, clockwise from the top). */
  tick(index: number): void;
  /** The ring finished: one soft pulse of light over the head, then the scanned tint fades. */
  pulse(): void;
  /** A new scan: no ticks lit. */
  reset(): void;
  /** Light a region (see REGION in head.ts) from 0 to 1, for the scan chapter. */
  setRegion(region: number, amount: number): void;
  /** Hold the head still on its current frame (the pause button, WCAG 2.2.2), or let it move again. */
  setPaused(paused: boolean): void;
  destroy(): void;
}

export interface SceneOptions {
  container: HTMLElement;
  points: HeadPoints;
  /** Freeze time at 0 for the static render. */
  poster?: boolean;
  onReady(): void;
  onSlow(): void;
}

/** State shared with the frame loop without re-rendering React. */
function createBus(poster: boolean) {
  const start = performance.now();
  // The clock stops while paused, so the breath picks up where it left off.
  let pausedAt = -1;
  let pausedFor = 0;
  const clock = () => (pausedAt >= 0 ? pausedAt : performance.now()) - start - pausedFor;
  return {
    poster,
    now: () => (poster ? 0 : clock() / 1000),
    hold(paused: boolean) {
      if (paused && pausedAt < 0) pausedAt = performance.now();
      if (!paused && pausedAt >= 0) {
        pausedFor += performance.now() - pausedAt;
        pausedAt = -1;
      }
    },
    ticks: new Float32Array(60).fill(-1),
    regions: new Float32Array(8),
    pulseAt: -100,
    /** Radians, from the scan's heading. */
    look: { yaw: 0, pitch: 0 },
  };
}
type Bus = ReturnType<typeof createBus>;

/** On screen, the tab visible, and not paused: the only time the scene draws. */
function createVisibility(el: HTMLElement) {
  let visible = true;
  let inView = true;
  let paused = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const io = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    emit();
  });
  io.observe(el);
  const onVis = () => {
    visible = document.visibilityState === 'visible';
    emit();
  };
  document.addEventListener('visibilitychange', onVis);
  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get: () => visible && inView && !paused,
    setPaused(value: boolean) {
      paused = value;
      emit();
    },
    destroy() {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aRegion;
  attribute float aLine;
  uniform float uTime;
  uniform float uSize;
  uniform float uAspect;
  uniform float uTicks[60];
  uniform float uRegions[8];
  uniform float uPulse;
  uniform float uScanned;
  uniform float uGain;
  uniform vec3 uInk;
  uniform vec3 uCool;
  uniform vec3 uMint;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    vec3 n = normalize(normalMatrix * normal);
    vec3 v = normalize(-mv.xyz);
    float facing = dot(n, v);
    // Portrait lighting: a key light just above and left of the camera. The face is the brightest thing,
    // and the eye sockets, the sides of the nose and the lips fall into shade, which is what shows a face.
    float lambert = max(dot(n, normalize(vec3(-0.28, 0.2, 0.94))), 0.0);
    float rim = pow(1.0 - abs(facing), 3.0);
    // Points on the far side barely show, so the face reads as a surface rather than a cloud.
    float front = smoothstep(-0.05, 0.3, facing);
    float light = 0.04 + 1.15 * pow(lambert, 1.8) + 0.3 * rim * front;
    float shimmer = 0.82 + 0.18 * sin(uTime * (0.7 + aSeed * 1.4) + aSeed * 6.2831);

    // The ring's tick in this point's direction from the middle of the stage, clockwise from the top.
    vec2 ndc = gl_Position.xy / gl_Position.w;
    float angle = degrees(atan(ndc.x * uAspect, ndc.y));
    if (angle < 0.0) angle += 360.0;
    int tick = int(mod(floor(angle / 6.0 + 0.5), 60.0));
    float filled = uTicks[tick];
    // A bright flash as the tick fills, settling to a faint tint for as long as the scan runs.
    float glow = filled < 0.0 ? 0.0 : max(exp(-max(uTime - filled, 0.0) * 1.7), uScanned) * step(filled, uTime + 0.001);
    glow = max(glow, uRegions[int(aRegion + 0.5)]);
    glow = max(glow, uPulse * (0.35 + 0.65 * front));

    // The shoulders fade out below the ring.
    float fade = smoothstep(-2.0, -1.2, position.y);

    // Lit points in ink, shadowed ones cooler (the app's action blue): depth without a gradient.
    vec3 base = mix(uCool, uInk, clamp(0.2 + 0.9 * lambert, 0.0, 1.0));
    vColor = mix(base, uMint, clamp(glow, 0.0, 1.0));
    // Scan lines carry the shape; the fill between them is a faint haze for volume.
    float strength = mix(0.32, 1.0, aLine);
    vAlpha = clamp(light * mix(0.05, 1.0, front) * shimmer * strength * uGain, 0.0, 1.0) * fade * (0.7 + 0.3 * glow)
      + glow * 0.25 * front;

    float size = uSize * mix(0.7 + 0.5 * aSeed, 0.85, aLine) * (0.75 + 0.55 * lambert) * (1.0 + 0.7 * glow);
    gl_PointSize = size * (6.6 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = length(p);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.12, r) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor, 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * a, a);
  }
`;

/** THREE.Color reads a hex as sRGB and keeps it linear; colorspace_fragment converts it back on output. */
function color(hex: string) {
  return new THREE.Color(hex);
}

function Head({ data, bus, onFirstFrame }: { data: HeadPoints; bus: Bus; onFirstFrame: () => void }) {
  const group = useRef<THREE.Group>(null);
  const firstFrame = useRef(false);
  const look = useRef({ yaw: 0, pitch: 0 });
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(data.seeds, 1));
    g.setAttribute('aRegion', new THREE.BufferAttribute(data.regions, 1));
    g.setAttribute('aLine', new THREE.BufferAttribute(data.lines, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.5, 0), 2.6);
    return g;
  }, [data]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        // Premultiplied "over": faint points pile up into bright edges where the surface turns away,
        // like a scan's silhouette, without the face washing out the way additive light would.
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: POINT_SIZE },
          uAspect: { value: 1 },
          uTicks: { value: bus.ticks },
          uRegions: { value: bus.regions },
          uPulse: { value: 0 },
          uScanned: { value: SCANNED_TINT },
          uOpacity: { value: 1 },
          uGain: { value: 1 },
          // The app's ink, action and scanTickFilled (src/styles/tokens.css).
          uInk: { value: color('#ECF2EF') },
          uCool: { value: color('#7FB6D1') },
          uMint: { value: color('#8FE3CF') },
        },
      }),
    [bus],
  );

  useEffect(() => {
    // Points scale with the stage, with a floor so a phone's smaller stage keeps them visible; a small
    // stage also gets a little more light, since it has fewer points to build the shape.
    const scale = size.height / 600;
    material.uniforms.uSize.value = Math.max(POINT_SIZE * scale, 1.5) * dpr;
    material.uniforms.uGain.value = Math.min(Math.max(Math.pow(1 / scale, 0.6), 1), 1.35);
    material.uniforms.uAspect.value = size.width / size.height;
  }, [material, size.width, size.height, dpr]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(() => {
    const t = bus.now();
    material.uniforms.uTime.value = t;
    const sincePulse = t - bus.pulseAt;
    material.uniforms.uPulse.value = sincePulse >= 0 ? 0.55 * Math.exp(-sincePulse * 2.4) : 0;
    // The scanned tint holds until the pulse, then fades over about a second and a half.
    material.uniforms.uScanned.value = sincePulse >= 0 ? SCANNED_TINT * Math.exp(-sincePulse * 2.2) : SCANNED_TINT;

    // The scan already springs the heading (src/lib/scan.ts, HeadingSpring), so the head takes it as is.
    // Face right is +yaw; face up is -pitch.
    const l = look.current;
    l.yaw = bus.poster ? 0 : bus.look.yaw;
    l.pitch = bus.poster ? 0 : bus.look.pitch;

    const g = group.current;
    if (g) {
      const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH_SECONDS);
      g.rotation.set(BASE_PITCH - l.pitch, BASE_YAW + l.yaw, 0);
      g.scale.setScalar(1 + 0.012 * breath);
      g.position.y = -0.05 + 0.03 * Math.sin((2 * Math.PI * t) / 11);
    }
    if (!firstFrame.current) {
      firstFrame.current = true;
      // Ready after this frame is on screen.
      requestAnimationFrame(() => onFirstFrame());
    }
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} />
    </group>
  );
}

function Scene({ opts, bus, visibility }: { opts: SceneOptions; bus: Bus; visibility: ReturnType<typeof createVisibility> }) {
  const active = useSyncExternalStore(visibility.subscribe, visibility.get);
  const [dpr, setDpr] = useState(opts.poster ? 2 : Math.min(window.devicePixelRatio || 1, 2));
  return (
    <Canvas
      dpr={dpr}
      frameloop={opts.poster ? 'always' : active ? 'always' : 'never'}
      // Above eye level (about 12°), so each scan line curves around the head instead of being seen
      // edge-on as a straight line, without looking down on the crown.
      camera={{ fov: 30, position: [0, 1.4, 6.4], near: 0.1, far: 30 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.poster }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        camera.lookAt(0, -0.14, 0);
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {!opts.poster && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(1, d - 0.5))}
          onFallback={() => opts.onSlow()}
        />
      )}
      <Head data={opts.points} bus={bus} onFirstFrame={opts.onReady} />
    </Canvas>
  );
}

export function mountHeadScene(opts: SceneOptions): SceneHandle {
  const bus = createBus(!!opts.poster);
  const visibility = createVisibility(opts.container);
  const root = createRoot(opts.container);
  root.render(<Scene opts={opts} bus={bus} visibility={visibility} />);
  const rad = Math.PI / 180;

  return {
    look(right, up) {
      bus.look.yaw = right * rad;
      bus.look.pitch = up * rad;
    },
    tick(index) {
      if (index >= 0 && index < 60) bus.ticks[index] = bus.now();
    },
    pulse() {
      bus.pulseAt = bus.now();
    },
    reset() {
      bus.ticks.fill(-1);
      bus.pulseAt = -100;
    },
    setRegion(region, amount) {
      bus.regions[region] = amount;
    },
    setPaused(paused) {
      bus.hold(paused);
      visibility.setPaused(paused);
    },
    destroy() {
      visibility.destroy();
      root.unmount();
    },
  };
}
