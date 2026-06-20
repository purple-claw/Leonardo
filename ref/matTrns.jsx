import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html, Instances, Instance, MeshTransmissionMaterial } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { InlineMath, BlockMath } from 'react-katex';
import {
  Layers, Compass, TrendingUp, TrendingDown, Minus,
  Play, Pause, SkipForward, RotateCcw,
  ChevronDown, Sparkles, BarChart3, Grid3x3, ArrowRight,
  Info, Zap, Eye, Box, Mouse, ArrowDown
} from 'lucide-react';
import * as THREE from 'three';

// ============================================================
// MATH UTILITIES
// ============================================================
function createRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateBasePoints3D(n = 300, seed = 42) {
  const rng = createRNG(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rng(), 1e-10);
    const u2 = rng();
    const u3 = Math.max(rng(), 1e-10);
    const u4 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    const pts2d = [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
    const r2 = Math.sqrt(-2 * Math.log(u3));
    const z = r2 * Math.cos(2 * Math.PI * u4);
    pts.push([pts2d[0], pts2d[1], z]);
  }
  return pts;
}

function transformPoints3D(base, s1, s2, s3, theta, phi) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const cp = Math.cos(phi), sp = Math.sin(phi);
  return base.map(([x, y, z]) => {
    let sx = s1 * x, sy = s2 * y, sz = s3 * z;
    let rx = ct * sx - st * sy;
    let ry = st * sx + ct * sy;
    let rz = sz;
    let fx = cp * rx + sp * rz;
    let fy = ry;
    let fz = -sp * rx + cp * rz;
    return [fx, fy, fz];
  });
}

function matMul3x3(A, B) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}

function matVec3x3(A, v) {
  return [
    A[0][0]*v[0] + A[0][1]*v[1] + A[0][2]*v[2],
    A[1][0]*v[0] + A[1][1]*v[1] + A[1][2]*v[2],
    A[2][0]*v[0] + A[2][1]*v[1] + A[2][2]*v[2],
  ];
}

function matInverse3x3(A) {
  const det = A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])
            - A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])
            + A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
  const inv_det = 1/det;
  return [
    [(A[1][1]*A[2][2]-A[1][2]*A[2][1])*inv_det, (A[0][2]*A[2][1]-A[0][1]*A[2][2])*inv_det, (A[0][1]*A[1][2]-A[0][2]*A[1][1])*inv_det],
    [(A[1][2]*A[2][0]-A[1][0]*A[2][2])*inv_det, (A[0][0]*A[2][2]-A[0][2]*A[2][0])*inv_det, (A[0][2]*A[1][0]-A[0][0]*A[1][2])*inv_det],
    [(A[1][0]*A[2][1]-A[1][1]*A[2][0])*inv_det, (A[0][1]*A[2][0]-A[0][0]*A[2][1])*inv_det, (A[0][0]*A[1][1]-A[0][1]*A[1][0])*inv_det],
  ];
}

function matLerp3x3(A, B, t) {
  return A.map((row, i) => row.map((val, j) => val + (B[i][j] - val) * t));
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ============================================================
// SCROLL PROGRESS HOOK
// ============================================================
function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const total = ref.current.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const p = Math.max(0, Math.min(1, -rect.top / total));
      setProgress(p);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [ref]);
  
  return progress;
}

// ============================================================
// SHARED STYLES
// ============================================================
const cardStyle = "relative bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden";
const sliderStyle = "w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.5)]";

function SectionHeader({ icon: Icon, title, subtitle, color = 'cyan' }) {
  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    pink: 'bg-pink-500/10 text-pink-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-base md:text-lg font-semibold text-white tracking-wide">{title}</h2>
        {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ============================================================
// 3D SCROLL WRAPPER
// ============================================================
function ScrollScene3D({ children, height = '300vh', canvasChildren, overlayContent }) {
  const containerRef = useRef();
  const progress = useScrollProgress(containerRef);

  return (
    <div ref={containerRef} style={{ height }} className="relative">
      <div className="sticky top-0 h-screen w-full flex">
        {/* 3D Canvas */}
        <div className="w-full lg:w-3/5 h-full relative">
          <Canvas camera={{ position: [6, 4, 6], fov: 45 }} gl={{ antialias: true, alpha: true }}>
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight position={[-5, -5, -5]} intensity={0.3} color="#06b6d4" />
            {canvasChildren(progress)}
            <OrbitControls enablePan={false} minDistance={3} maxDistance={20} enableDamping dampingFactor={0.05} />
            <gridHelper args={[20, 20, '#ffffff10', '#ffffff05']} />
          </Canvas>
          {/* Scroll indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowDown size={16} className="text-zinc-500" />
            </motion.div>
            <span className="text-[9px] text-zinc-600 font-mono">Scroll to transform</span>
          </div>
          {/* Progress bar */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400/50 rounded-full transition-all duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        {/* Overlay Content */}
        <div className="hidden lg:flex w-2/5 h-full flex-col justify-center p-8 overflow-y-auto">
          {overlayContent(progress)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3D ARROW COMPONENT
// ============================================================
function Arrow3D({ from, to, color, thickness = 0.04, label, labelOffset = [0, 0.3, 0] }) {
  const dir = new THREE.Vector3(to[0]-from[0], to[1]-from[1], to[2]-from[2]);
  const len = dir.length();
  if (len < 0.01) return null;
  dir.normalize();
  
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  
  return (
    <group>
      {/* Shaft */}
      <mesh position={[(from[0]+to[0])/2, (from[1]+to[1])/2, (from[2]+to[2])/2]} quaternion={quaternion}>
        <cylinderGeometry args={[thickness, thickness, len * 0.85, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Head */}
      <mesh position={to} quaternion={quaternion}>
        <coneGeometry args={[thickness * 3, len * 0.15, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Label */}
      {label && (
        <Html position={[to[0]+labelOffset[0], to[1]+labelOffset[1], to[2]+labelOffset[2]]} center distanceFactor={8}>
          <div className="text-[10px] font-mono whitespace-nowrap px-1.5 py-0.5 rounded bg-black/70 border border-white/10" style={{ color }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================
// SCENE 1: 3D DATA CLOUD
// ============================================================
const BASE_POINTS_3D = generateBasePoints3D(300, 42);

function DataCloudScene({ progress }) {
  const sigma1 = 1 + progress * 3;
  const sigma2 = 1;
  const sigma3 = 0.6;
  const theta = Math.PI / 4;
  const phi = Math.PI / 6;

  const points = useMemo(() => transformPoints3D(BASE_POINTS_3D, sigma1, sigma2, sigma3, theta, phi), [sigma1, sigma2, sigma3, theta, phi]);
  
  const lambda1 = sigma1 * sigma1;
  const lambda2 = sigma2 * sigma2;
  const lambda3 = sigma3 * sigma3;

  const v1 = [Math.cos(theta)*Math.cos(phi), Math.sin(theta), -Math.cos(theta)*Math.sin(phi)];
  const v2 = [-Math.sin(theta), Math.cos(theta), 0];
  const v3 = [Math.cos(theta)*Math.sin(phi), Math.sin(theta)*0 , Math.cos(theta)*Math.cos(phi)];

  return (
    <>
      {/* Points */}
      {points.map(([x, y, z], i) => (
        <mesh key={i} position={[x, z, -y]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color="white" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Eigenvector arrows */}
      <Arrow3D from={[0,0,0]} to={[v1[0]*sigma1*1.5, v1[2]*sigma1*1.5, -v1[1]*sigma1*1.5]} color="#06b6d4" label={`v₁ (λ₁=${lambda1.toFixed(1)})`} />
      <Arrow3D from={[0,0,0]} to={[v2[0]*sigma2*1.5, v2[2]*sigma2*1.5, -v2[1]*sigma2*1.5]} color="#ec4899" label={`v₂ (λ₂=${lambda2.toFixed(1)})`} />
      <Arrow3D from={[0,0,0]} to={[v3[0]*sigma3*1.5, v3[2]*sigma3*1.5, -v3[1]*sigma3*1.5]} color="#eab308" label={`v₃ (λ₃=${lambda3.toFixed(1)})`} />

      {/* Ellipsoid wireframe */}
      <mesh rotation={[0, -theta, phi]} position={[0,0,0]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#06b6d4" wireframe transparent opacity={0.15} />
        <group scale={[sigma1*2, sigma3*2, sigma2*2]} />
      </mesh>
      <mesh scale={[sigma1*2, sigma3*2, sigma2*2]} rotation={[0, -theta, phi]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#06b6d4" wireframe transparent opacity={0.12} />
      </mesh>
    </>
  );
}

function DataCloudCard() {
  return (
    <ScrollScene3D
      height="300vh"
      canvasChildren={(progress) => <DataCloudScene progress={progress} />}
      overlayContent={(progress) => (
        <div className="space-y-8">
          <SectionHeader icon={Compass} title="The Shape of Data" subtitle="3D covariance geometry" color="cyan" />
          
          <motion.div 
            key={progress < 0.33 ? 'a' : progress < 0.66 ? 'b' : 'c'}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {progress < 0.33 && (
              <div className="space-y-3">
                <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <span className="text-cyan-400 font-bold">Phase 1: Isotropic Cloud</span><br/>
                    At the start, all eigenvalues are roughly equal. The data forms a sphere — no direction is special. Every axis has the same variance.
                  </p>
                </div>
                <p className="text-[11px] text-zinc-500">
                  <InlineMath math="\lambda_1 \approx \lambda_2 \approx \lambda_3 \approx 1" />
                </p>
              </div>
            )}
            {progress >= 0.33 && progress < 0.66 && (
              <div className="space-y-3">
                <div className="p-4 bg-pink-500/5 border border-pink-500/10 rounded-xl">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <span className="text-pink-400 font-bold">Phase 2: Stretching Begins</span><br/>
                    The first eigenvalue grows. The cloud elongates along <InlineMath math="\mathbf{v}_1" />. The cyan arrow lengthens — more variance lives in this direction. The ellipsoid stretches.
                  </p>
                </div>
                <p className="text-[11px] text-zinc-500">
                  <InlineMath math="\lambda_1 > \lambda_2 \approx \lambda_3" /> — the cloud becomes cigar-shaped.
                </p>
              </div>
            )}
            {progress >= 0.66 && (
              <div className="space-y-3">
                <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    <span className="text-yellow-400 font-bold">Phase 3: Dominant Direction</span><br/>
                    <InlineMath math="\lambda_1 \gg \lambda_2, \lambda_3" />. Almost all variance lives along ONE direction. This is the regime where PCA shines — you can project onto v₁ and lose almost nothing.
                  </p>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Orbit the scene with your mouse to see the 3D structure. The data is essentially flat — a pancake viewed edge-on.
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Live eigenvalue display */}
          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Live Eigenvalues</p>
            {[
              { label: 'λ₁', val: (1+progress*3)**2, color: '#06b6d4' },
              { label: 'λ₂', val: 1, color: '#ec4899' },
              { label: 'λ₃', val: 0.36, color: '#eab308' },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-[10px] font-mono text-zinc-400 w-6">{e.label}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-200" style={{ width: `${(e.val / 16) * 100}%`, backgroundColor: e.color, opacity: 0.7 }} />
                </div>
                <span className="text-[10px] font-mono w-10 text-right" style={{ color: e.color }}>{e.val.toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <Mouse size={12} />
            <span>Drag to orbit • Scroll to transform</span>
          </div>
        </div>
      )}
    />
  );
}

// ============================================================
// SCENE 2: 3D REPEATED TRANSFORM
// ============================================================
function RepeatTransformScene({ progress, lambda }) {
  const layers = Math.floor(progress * 20);
  const baseVec = [1, 0.6, 0.3];
  
  const history = useMemo(() => {
    const h = [[...baseVec]];
    for (let i = 0; i < 20; i++) {
      const prev = h[h.length - 1];
      h.push([prev[0] * lambda, prev[1] * lambda, prev[2] * lambda]);
    }
    return h;
  }, [lambda]);

  const isExploding = lambda > 1.01;
  const isVanishing = lambda < 0.99;
  const color = isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308';

  const currentVec = history[Math.min(layers, 20)];
  const magnitude = Math.sqrt(currentVec[0]**2 + currentVec[1]**2 + currentVec[2]**2);

  return (
    <>
      {/* Trail spheres */}
      {history.slice(0, layers + 1).map((pt, i) => {
        const opacity = 0.15 + (i / Math.max(layers, 1)) * 0.6;
        const scale = 0.05 + (i / Math.max(layers, 1)) * 0.08;
        return (
          <mesh key={i} position={[pt[0], pt[2], -pt[1]]}>
            <sphereGeometry args={[scale, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={opacity} />
          </mesh>
        );
      })}

      {/* Trail lines */}
      {history.slice(0, layers + 1).map((pt, i) => {
        if (i === 0) return null;
        const prev = history[i-1];
        return (
          <Line key={`l${i}`} points={[prev, pt]} color={color} lineWidth={1.5} transparent opacity={0.3} />
        );
      })}

      {/* Current vector arrow */}
      {layers >= 0 && (
        <Arrow3D from={[0,0,0]} to={currentVec} color={color} thickness={0.05} label={`Layer ${layers}: |v|=${magnitude.toFixed(2)}`} labelOffset={[0, 0.4, 0]} />
      )}

      {/* Origin marker */}
      <mesh position={[0,0,0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
      </mesh>
    </>
  );
}

function RepeatTransformCard() {
  const [lambda, setLambda] = useState(1.2);
  const containerRef = useRef();
  const progress = useScrollProgress(containerRef);
  
  const layers = Math.floor(progress * 20);
  const magnitude = Math.pow(lambda, layers) * Math.sqrt(1 + 0.6**2 + 0.3**2);
  const isExploding = lambda > 1.01;
  const isVanishing = lambda < 0.99;

  return (
    <div ref={containerRef} style={{ height: '300vh' }} className="relative">
      <div className="sticky top-0 h-screen w-full flex">
        <div className="w-full lg:w-3/5 h-full relative">
          <Canvas camera={{ position: [5, 3, 5], fov: 45 }} gl={{ antialias: true }}>
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight position={[-5, -5, -5]} intensity={0.3} color={isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308'} />
            <RepeatTransformScene progress={progress} lambda={lambda} />
            <OrbitControls enablePan={false} minDistance={2} maxDistance={25} enableDamping dampingFactor={0.05} />
            <gridHelper args={[20, 20, '#ffffff10', '#ffffff05']} />
          </Canvas>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowDown size={16} className="text-zinc-500" />
            </motion.div>
            <span className="text-[9px] text-zinc-600 font-mono">Scroll to advance layers</span>
          </div>
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-100" style={{ width: `${progress * 100}%`, backgroundColor: isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308' }} />
          </div>
        </div>

        <div className="hidden lg:flex w-2/5 h-full flex-col justify-center p-8 overflow-y-auto">
          <div className="space-y-6">
            <SectionHeader icon={Zap} title="Repeated Transformations" subtitle="Scroll to step through layers" color="yellow" />

            {/* Lambda control */}
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-zinc-400 font-medium">Eigenvalue λ</label>
                <span className={`text-sm font-mono font-bold ${isExploding ? 'text-red-400' : isVanishing ? 'text-cyan-400' : 'text-yellow-400'}`}>
                  {lambda.toFixed(2)}
                </span>
              </div>
              <input type="range" min="0.3" max="1.8" step="0.01" value={lambda}
                onChange={e => setLambda(+e.target.value)} className={sliderStyle}
                style={{ accentColor: isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308' }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-cyan-400/60">Vanishing</span>
                <span className="text-[9px] text-yellow-400/60">Stable (λ=1)</span>
                <span className="text-[9px] text-red-400/60">Exploding</span>
              </div>
            </div>

            {/* Status */}
            <motion.div 
              key={isExploding ? 'exp' : isVanishing ? 'van' : 'stable'}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-xl border ${isExploding ? 'bg-red-500/5 border-red-500/20' : isVanishing ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {isExploding ? <TrendingUp size={14} className="text-red-400" /> : isVanishing ? <TrendingDown size={14} className="text-cyan-400" /> : <Minus size={14} className="text-yellow-400" />}
                <span className={`text-xs font-bold ${isExploding ? 'text-red-400' : isVanishing ? 'text-cyan-400' : 'text-yellow-400'}`}>
                  {isExploding ? 'EXPLODING' : isVanishing ? 'VANISHING' : 'STABLE'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                Layer {layers} / 20<br/>
                |v| = λⁿ = {lambda.toFixed(2)}^{layers} = {Math.pow(lambda, layers).toFixed(4)}<br/>
                Magnitude ≈ {magnitude.toFixed(2)}
              </p>
            </motion.div>

            {/* Scroll-driven explanation */}
            <motion.div
              key={progress < 0.3 ? 'a' : progress < 0.7 ? 'b' : 'c'}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              {progress < 0.3 && (
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    <span className="text-yellow-400 font-bold">Early layers:</span> The vector is still near its original magnitude. Each multiplication by λ hasn't compounded enough to matter yet.
                  </p>
                </div>
              )}
              {progress >= 0.3 && progress < 0.7 && (
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    <span className="text-yellow-400 font-bold">Mid layers:</span> The exponential nature becomes visible. The trail of spheres shows the compounding — each step multiplies the previous magnitude by λ.
                  </p>
                </div>
              )}
              {progress >= 0.7 && (
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    <span className="text-yellow-400 font-bold">Deep layers:</span>
                    {isExploding && " The vector has exploded to astronomical magnitude. In a real network, this is where gradients become NaN and training crashes."}
                    {isVanishing && " The vector has collapsed to near-zero. In a real network, the signal is indistinguishable from noise — the network can't learn."}
                    {!isExploding && !isVanishing && " The vector maintains stable magnitude. This is the goal of careful weight initialization (e.g., Xavier/He init)."}
                  </p>
                </div>
              )}
            </motion.div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              <Mouse size={12} />
              <span>Drag to orbit • Scroll to advance layers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SCENE 3: 3D DIAGONALIZATION
// ============================================================
function DiagonalizationScene({ progress }) {
  // A = [[2,1,0],[1,2,0],[0,0,1.5]]
  // Eigenvalues: 3, 1, 1.5
  // Eigenvectors: [1/√2, 1/√2, 0], [-1/√2, 1/√2, 0], [0, 0, 1]
  const sqrt2 = Math.SQRT2;
  const V = [[1/sqrt2, -1/sqrt2, 0], [1/sqrt2, 1/sqrt2, 0], [0, 0, 1]];
  const Vinv = matInverse3x3(V);
  const D = [[3, 0, 0], [0, 1, 0], [0, 0, 1.5]];
  const I = [[1,0,0],[0,1,0],[0,0,1]];

  // Continuous transformation: t goes from 0 to 3
  const t = progress * 3;
  
  // Step 0→1: Apply V⁻¹ (interpolate from I to V⁻¹)
  // Step 1→2: Apply D (interpolate from I to D)
  // Step 2→3: Apply V (interpolate from I to V)
  const M1 = matLerp3x3(I, Vinv, clamp(t, 0, 1));
  const M2 = matLerp3x3(I, D, clamp(t - 1, 0, 1));
  const M3 = matLerp3x3(I, V, clamp(t - 2, 0, 1));
  
  const M = matMul3x3(M3, matMul3x3(M2, M1));

  // Generate grid
  const gridSize = 2;
  const gridStep = 1;
  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = -gridSize; i <= gridSize; i += gridStep) {
      for (let j = -gridSize; j <= gridSize; j += gridStep) {
        // Lines along x
        lines.push({ from: [-gridSize, i, j], to: [gridSize, i, j], axis: 'x' });
        // Lines along y
        lines.push({ from: [i, -gridSize, j], to: [i, gridSize, j], axis: 'y' });
        // Lines along z
        lines.push({ from: [i, j, -gridSize], to: [i, j, gridSize], axis: 'z' });
      }
    }
    return lines;
  }, []);

  const transformedLines = useMemo(() => {
    return gridLines.map(line => ({
      ...line,
      from: matVec3x3(M, line.from),
      to: matVec3x3(M, line.to),
    }));
  }, [M, gridLines]);

  // Test vector
  const testVec = [1, 0.5, 0.3];
  const transformedTestVec = matVec3x3(M, testVec);

  // Eigenvector arrows (always visible, but highlighted based on step)
  const eigenvectors = [
    { v: [V[0][0], V[1][0], V[2][0]], color: '#06b6d4', label: 'v₁ (λ=3)' },
    { v: [V[0][1], V[1][1], V[2][1]], color: '#ec4899', label: 'v₂ (λ=1)' },
    { v: [V[0][2], V[1][2], V[2][2]], color: '#eab308', label: 'v₃ (λ=1.5)' },
  ];

  const step = t < 1 ? 0 : t < 2 ? 1 : 2;

  return (
    <>
      {/* Grid lines */}
      {transformedLines.map((line, i) => {
        const axisColors = { x: '#ef4444', y: '#22c55e', z: '#3b82f6' };
        return (
          <Line key={i} points={[line.from, line.to]} color={axisColors[line.axis]} lineWidth={0.8} transparent opacity={0.25} />
        );
      })}

      {/* Grid intersection points */}
      {transformedLines.filter((_, i) => i % 3 === 0).map((line, i) => (
        <mesh key={`p${i}`} position={line.from}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={0.3} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Test vector */}
      <Arrow3D from={[0,0,0]} to={transformedTestVec} color="#f59e0b" thickness={0.06} label="Av" labelOffset={[0, 0.4, 0]} />

      {/* Eigenvector arrows */}
      {eigenvectors.map((ev, i) => (
        <Arrow3D key={i} from={[0,0,0]} to={[ev.v[0]*2.5, ev.v[1]*2.5, ev.v[2]*2.5]} 
          color={ev.color} thickness={0.03} label={ev.label} 
          labelOffset={[ev.v[0]*0.3, ev.v[1]*0.3 + 0.3, ev.v[2]*0.3]} />
      ))}

      {/* Origin */}
      <mesh position={[0,0,0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.8} />
      </mesh>
    </>
  );
}

function DiagonalizationCard() {
  const containerRef = useRef();
  const progress = useScrollProgress(containerRef);
  const t = progress * 3;
  const step = t < 1 ? 0 : t < 2 ? 1 : 2;

  const stepInfo = [
    { title: 'Original Space', desc: 'The grid and vector in the standard basis. The transformation A mixes scaling along the eigenvector directions.', color: '#a855f7' },
    { title: 'After V⁻¹ (Translate In)', desc: 'We rotate into the eigenvector basis. The grid axes now align with the natural directions of A. The vector is expressed in "eigen-coordinates".', color: '#06b6d4' },
    { title: 'After D (Scale)', desc: 'In the eigenvector basis, A is just D — pure scaling! Each axis is independently scaled by its eigenvalue. No mixing. This is the "simple language".', color: '#eab308' },
    { title: 'After V (Translate Out) = A', desc: 'We rotate back to the original basis. The net result is exactly A applied to the original vector. A = VDV⁻¹ is confirmed.', color: '#ec4899' },
  ];

  const currentStep = Math.min(Math.floor(t), 2);
  const info = stepInfo[currentStep];

  return (
    <div ref={containerRef} style={{ height: '400vh' }} className="relative">
      <div className="sticky top-0 h-screen w-full flex">
        <div className="w-full lg:w-3/5 h-full relative">
          <Canvas camera={{ position: [7, 5, 7], fov: 40 }} gl={{ antialias: true }}>
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <pointLight position={[-5, -5, -5]} intensity={0.3} color="#a855f7" />
            <DiagonalizationScene progress={progress} />
            <OrbitControls enablePan={false} minDistance={4} maxDistance={20} enableDamping dampingFactor={0.05} />
            <gridHelper args={[20, 20, '#ffffff08', '#ffffff03']} />
          </Canvas>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <ArrowDown size={16} className="text-zinc-500" />
            </motion.div>
            <span className="text-[9px] text-zinc-600 font-mono">Scroll to step through V⁻¹ → D → V</span>
          </div>
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-purple-400/50 rounded-full transition-all duration-100" style={{ width: `${progress * 100}%` }} />
          </div>
          {/* Step indicator */}
          <div className="absolute top-8 left-4 flex gap-1">
            {['V⁻¹', 'D', 'V'].map((label, i) => (
              <div key={i} className={`px-2 py-0.5 rounded text-[9px] font-mono transition-all ${currentStep >= i ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-zinc-600 border border-white/5'}`}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex w-2/5 h-full flex-col justify-center p-8 overflow-y-auto">
          <div className="space-y-6">
            <SectionHeader icon={Grid3x3} title="Diagonalization" subtitle="A = VDV⁻¹ in 3D" color="purple" />

            {/* Current step info */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border"
              style={{ backgroundColor: `${info.color}08`, borderColor: `${info.color}20` }}
            >
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: info.color }}>
                Step {currentStep}: {info.title}
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">{info.desc}</p>
            </motion.div>

            {/* Matrices */}
            <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">The Decomposition</p>
              <div className="flex items-center gap-2 justify-center text-xs font-mono">
                <span className="text-white">A</span>
                <span className="text-zinc-600">=</span>
                <span className="text-cyan-400">V</span>
                <span className="text-yellow-400">D</span>
                <span className="text-pink-400">V⁻¹</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] text-cyan-400 mb-1">V (eigenvectors)</p>
                  <p className="text-[9px] font-mono text-zinc-400">Rotates INTO eigenbasis</p>
                </div>
                <div>
                  <p className="text-[9px] text-yellow-400 mb-1">D (eigenvalues)</p>
                  <p className="text-[9px] font-mono text-zinc-400">Pure scaling: 3, 1, 1.5</p>
                </div>
                <div>
                  <p className="text-[9px] text-pink-400 mb-1">V⁻¹ (inverse)</p>
                  <p className="text-[9px] font-mono text-zinc-400">Rotates BACK out</p>
                </div>
              </div>
            </div>

            {/* Power insight */}
            <div className="p-4 bg-gradient-to-r from-purple-500/5 to-yellow-500/5 rounded-xl border border-white/5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Why This Matters</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                <InlineMath math="\mathbf{A}^{100} = \mathbf{V}\mathbf{D}^{100}\mathbf{V}^{-1}" /> — and <InlineMath math="\mathbf{D}^{100}" /> is trivial:
              </p>
              <div className="mt-2 space-y-1 text-[10px] font-mono">
                <p className="text-yellow-400">3¹⁰⁰ = 5.15 × 10⁴⁷ <span className="text-red-400">(explodes!)</span></p>
                <p className="text-cyan-400">1¹⁰⁰ = 1 <span className="text-green-400">(stable)</span></p>
                <p className="text-pink-400">1.5¹⁰⁰ = 4.06 × 10¹⁷ <span className="text-red-400">(explodes slower)</span></p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              <Mouse size={12} />
              <span>Drag to orbit • Scroll to transform</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PCA CARD (2D - kept as-is, it's about bars not spatial transforms)
// ============================================================
function PCACard() {
  const [lambda1, setLambda1] = useState(950);
  const [lambda2, setLambda2] = useState(45);
  const [lambda3, setLambda3] = useState(4);
  const [lambda4, setLambda4] = useState(1);

  const total = lambda1 + lambda2 + lambda3 + lambda4;
  const lambdas = [lambda1, lambda2, lambda3, lambda4];
  const fractions = lambdas.map(l => l / total);
  const cumulative = fractions.reduce((acc, f) => {
    acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + f);
    return acc;
  }, []);
  const colors = ['#06b6d4', '#ec4899', '#eab308', '#22c55e'];
  const labels = ['λ₁', 'λ₂', 'λ₃', 'λ₄'];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className={cardStyle + " p-6 md:p-8"}>
      <SectionHeader icon={BarChart3} title="PCA & Compression" subtitle="How much information can you throw away?" color="pink" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Eigenvalue Magnitudes</p>
          <div className="space-y-3">
            {lambdas.map((l, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono" style={{ color: colors[i] }}>{labels[i]}</span>
                  <span className="text-xs font-mono text-zinc-400">{l} ({(fractions[i]*100).toFixed(1)}%)</span>
                </div>
                <div className="h-6 bg-white/5 rounded-lg overflow-hidden relative">
                  <motion.div className="h-full rounded-lg" style={{ backgroundColor: colors[i], opacity: 0.7 }}
                    animate={{ width: `${fractions[i] * 100}%` }} transition={{ duration: 0.4 }} />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-mono text-white/80">{(cumulative[i]*100).toFixed(1)}% cumulative</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {lambdas.map((l, i) => (
              <div key={i}>
                <label className="text-[10px] font-mono" style={{ color: colors[i] }}>{labels[i]}: {l}</label>
                <input type="range" min="1" max="1000" step="1" value={l}
                  onChange={e => {
                    const val = +e.target.value;
                    if (i === 0) setLambda1(val);
                    if (i === 1) setLambda2(val);
                    if (i === 2) setLambda3(val);
                    if (i === 3) setLambda4(val);
                  }}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer" style={{ accentColor: colors[i] }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">The Compression Insight</p>
            <div className="space-y-2">
              <p className="text-xs text-zinc-300">Keeping only <span className="text-cyan-400 font-bold">1 direction</span> captures:</p>
              <p className="text-2xl font-bold text-cyan-400 font-mono">{(fractions[0]*100).toFixed(1)}%</p>
              <p className="text-xs text-zinc-300">Keeping <span className="text-cyan-400 font-bold">2 directions</span> captures:</p>
              <p className="text-2xl font-bold text-pink-400 font-mono">{(cumulative[1]*100).toFixed(1)}%</p>
              <p className="text-[11px] text-zinc-500 mt-2">You cut the data size by 50% while keeping almost everything that matters.</p>
            </div>
          </div>
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">The Suitcase Analogy</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Packing a suitcase: you don't pack 10 identical socks. You pack the items that capture the most <em>variety</em>. 
              Eigenvalues tell you which "directions" in your data contain the most variety. The tiny-eigenvalue directions are the identical socks — 
              you can safely leave them behind.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CHECK-IN CARD
// ============================================================
function CheckInCard() {
  const [openQ, setOpenQ] = useState(null);
  const questions = [
    {
      q: 'If a dataset\'s covariance matrix has eigenvalues λ₁ = 500 and λ₂ = 2, what does the data cloud look like?',
      hint: 'Think about the rice grains on the table...',
      answer: 'Long and thin — like a cigar or a vein of gold. The first eigenvector direction has 250× more spread than the second. Almost all the "action" in this data happens along one direction.',
      color: 'cyan'
    },
    {
      q: 'In A = VDV⁻¹, what is D doing, and why is it simpler than A?',
      hint: 'Think about the translator analogy...',
      answer: 'D is the "conversation in the simple language." It just scales each eigenvector direction by its eigenvalue — no rotation, no mixing between directions. A looks complicated only because we\'re viewing it from the wrong angle.',
      color: 'purple'
    },
    {
      q: 'If you scroll the repeated transform scene with λ = 1.3 to layer 20, what happens to the vector magnitude?',
      hint: 'Think about compounding...',
      answer: 'The magnitude becomes 1.3²⁰ × |v₀| ≈ 190 × |v₀|. The vector has grown 190-fold. In a real 20-layer network, this is where activations explode and training becomes unstable.',
      color: 'yellow'
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className={cardStyle + " p-6 md:p-8"}>
      <SectionHeader icon={Sparkles} title="Check-In" subtitle="Test your intuition" color="green" />
      <div className="space-y-3">
        {questions.map((item, i) => (
          <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
            <button onClick={() => setOpenQ(openQ === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${item.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : item.color === 'purple' ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {i + 1}
                </span>
                <span className="text-xs text-zinc-300">{item.q}</span>
              </div>
              <motion.div animate={{ rotate: openQ === i ? 180 : 0 }}>
                <ChevronDown size={16} className="text-zinc-500" />
              </motion.div>
            </button>
            <AnimatePresence>
              {openQ === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                  <div className="px-4 pb-4">
                    <p className="text-[10px] text-zinc-500 italic mb-2">{item.hint}</p>
                    <div className={`p-3 rounded-lg ${item.color === 'cyan' ? 'bg-cyan-500/5 border border-cyan-500/10' : item.color === 'purple' ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-yellow-500/5 border border-yellow-500/10'}`}>
                      <p className="text-xs text-zinc-300 leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function EigenvalueSimulator3D() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.03] via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 text-center relative">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-400 mb-4">
              <Box size={12} className="text-cyan-400" />
              SB5-B • Eigenvalues & Data Geometry • 3D Interactive
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              The Shape of Data
            </h1>
            <p className="text-sm text-zinc-500 mt-3 max-w-lg mx-auto leading-relaxed">
              Scroll through 3D transformations to build intuition for eigenvalues, PCA, 
              exploding/vanishing gradients, and diagonalization.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1"><Mouse size={10} /> Drag to orbit</span>
              <span className="flex items-center gap-1"><ArrowDown size={10} /> Scroll to transform</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 3D Scroll Scenes */}
      <DataCloudCard />
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <PCACard />
      </div>

      <RepeatTransformCard />
      <DiagonalizationCard />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <CheckInCard />
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 py-8 text-center">
        <p className="text-[10px] text-zinc-600">
          Made with ❤️ by Purpleclaw - ©Leonardo 2026.
        </p>
      </div>
    </div>
  );
}