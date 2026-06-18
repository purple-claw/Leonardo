import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InlineMath, BlockMath } from 'react-katex';
import {
  Layers, Compass, TrendingUp, TrendingDown, Minus,
  Play, Pause, SkipForward, RotateCcw,
  ChevronDown, Sparkles, BarChart3, Grid3x3, ArrowRight,
  Info, Zap, Eye, Box
} from 'lucide-react';

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

function generateBasePoints(n = 200, seed = 42) {
  const rng = createRNG(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rng(), 1e-10);
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    pts.push([r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)]);
  }
  return pts;
}

function transformPoints(base, s1, s2, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return base.map(([z1, z2]) => {
    const x = s1 * z1, y = s2 * z2;
    return [c * x - s * y, s * x + c * y];
  });
}

function matMul2x2(A, B) {
  return [
    [A[0][0]*B[0][0] + A[0][1]*B[1][0], A[0][0]*B[0][1] + A[0][1]*B[1][1]],
    [A[1][0]*B[0][0] + A[1][1]*B[1][0], A[1][0]*B[0][1] + A[1][1]*B[1][1]],
  ];
}

function matVec2x2(A, v) {
  return [A[0][0]*v[0] + A[0][1]*v[1], A[1][0]*v[0] + A[1][1]*v[1]];
}

function matInverse2x2(A) {
  const det = A[0][0]*A[1][1] - A[0][1]*A[1][0];
  return [[A[1][1]/det, -A[0][1]/det], [-A[1][0]/det, A[0][0]/det]];
}

// ============================================================
// SHARED STYLES
// ============================================================
const cardStyle = "relative bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 md:p-8 hover:border-white/[0.12] transition-all duration-300";
const sliderStyle = "w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(6,182,212,0.5)]";
const badgeStyle = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono";

// ============================================================
// SECTION HEADER
// ============================================================
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
    <div className="flex items-center gap-3 mb-6">
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
// CARD 1: DATA CLOUD WITH EIGENVECTORS
// ============================================================
const BASE_POINTS = generateBasePoints(200, 42);

function DataCloudCard() {
  const [sigma1, setSigma1] = useState(2.5);
  const [sigma2, setSigma2] = useState(0.8);
  const [theta, setTheta] = useState(Math.PI / 5);

  const points = useMemo(() => transformPoints(BASE_POINTS, sigma1, sigma2, theta), [sigma1, sigma2, theta]);
  const lambda1 = sigma1 * sigma1;
  const lambda2 = sigma2 * sigma2;
  const v1 = [Math.cos(theta), Math.sin(theta)];
  const v2 = [-Math.sin(theta), Math.cos(theta)];

  const covA = sigma1*sigma1*Math.cos(theta)**2 + sigma2*sigma2*Math.sin(theta)**2;
  const covB = (sigma1*sigma1 - sigma2*sigma2)*Math.cos(theta)*Math.sin(theta);
  const covD = sigma1*sigma1*Math.sin(theta)**2 + sigma2*sigma2*Math.cos(theta)**2;

  const arrowScale = 1.8;
  const viewRange = Math.max(sigma1, sigma2) * 3.5 + 1;
  const vr = Math.min(Math.max(viewRange, 4), 15);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className={cardStyle}>
      <SectionHeader icon={Compass} title="The Shape of Data" subtitle="Eigenvectors reveal the natural axes of variation" color="cyan" />
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* SVG Visualization */}
        <div className="lg:col-span-3">
          <div className="aspect-square bg-black/50 rounded-xl border border-white/5 overflow-hidden">
            <svg viewBox={`${-vr} ${-vr} ${vr*2} ${vr*2}`} className="w-full h-full">
              {/* Grid */}
              {Array.from({length: Math.floor(vr)*2+1}, (_, i) => i - Math.floor(vr)).map(i => (
                <React.Fragment key={i}>
                  <line x1={-vr} y1={i} x2={vr} y2={i} stroke="white" strokeOpacity="0.04" strokeWidth="0.02" />
                  <line x1={i} y1={-vr} x2={i} y2={vr} stroke="white" strokeOpacity="0.04" strokeWidth="0.02" />
                </React.Fragment>
              ))}
              {/* Axes */}
              <line x1={-vr} y1={0} x2={vr} y2={0} stroke="white" strokeOpacity="0.15" strokeWidth="0.03" />
              <line x1={0} y1={-vr} x2={0} y2={vr} stroke="white" strokeOpacity="0.15" strokeWidth="0.03" />
              
              {/* Covariance Ellipse */}
              <ellipse cx={0} cy={0} rx={sigma1 * 2} ry={sigma2 * 2}
                transform={`rotate(${-theta * 180 / Math.PI})`}
                fill="none" stroke="#06b6d4" strokeWidth="0.04" strokeDasharray="0.15 0.1" opacity="0.4" />
              <ellipse cx={0} cy={0} rx={sigma1} ry={sigma2}
                transform={`rotate(${-theta * 180 / Math.PI})`}
                fill="none" stroke="#06b6d4" strokeWidth="0.03" strokeDasharray="0.1 0.08" opacity="0.25" />

              {/* Data Points */}
              {points.map(([x, y], i) => (
                <circle key={i} cx={x} cy={-y} r={vr > 8 ? 0.06 : 0.08} fill="white" opacity={0.35} />
              ))}

              {/* Eigenvector 1 (primary - cyan) */}
              <line x1={0} y1={0} x2={v1[0]*sigma1*arrowScale} y2={-v1[1]*sigma1*arrowScale}
                stroke="#06b6d4" strokeWidth="0.1" opacity="0.9" />
              <polygon points={`${v1[0]*sigma1*arrowScale},${-v1[1]*sigma1*arrowScale} ${v1[0]*sigma1*arrowScale - v1[0]*0.3 + v1[1]*0.15},${-v1[1]*sigma1*arrowScale + v1[1]*0.3 + v1[0]*0.15} ${v1[0]*sigma1*arrowScale - v1[0]*0.3 - v1[1]*0.15},${-v1[1]*sigma1*arrowScale + v1[1]*0.3 - v1[0]*0.15}`}
                fill="#06b6d4" opacity="0.9" />

              {/* Eigenvector 2 (secondary - pink) */}
              <line x1={0} y1={0} x2={v2[0]*sigma2*arrowScale} y2={-v2[1]*sigma2*arrowScale}
                stroke="#ec4899" strokeWidth="0.08" opacity="0.8" />
              <polygon points={`${v2[0]*sigma2*arrowScale},${-v2[1]*sigma2*arrowScale} ${v2[0]*sigma2*arrowScale - v2[0]*0.25 + v2[1]*0.12},${-v2[1]*sigma2*arrowScale + v2[1]*0.25 + v2[0]*0.12} ${v2[0]*sigma2*arrowScale - v2[0]*0.25 - v2[1]*0.12},${-v2[1]*sigma2*arrowScale + v2[1]*0.25 - v2[0]*0.12}`}
                fill="#ec4899" opacity="0.8" />

              {/* Labels */}
              <text x={v1[0]*sigma1*arrowScale*1.1} y={-v1[1]*sigma1*arrowScale*1.1} fill="#06b6d4" fontSize={vr > 8 ? "0.4" : "0.5"} fontFamily="monospace" textAnchor="middle">
                v₁ (λ₁={lambda1.toFixed(1)})
              </text>
              <text x={v2[0]*sigma2*arrowScale*1.2} y={-v2[1]*sigma2*arrowScale*1.2} fill="#ec4899" fontSize={vr > 8 ? "0.35" : "0.45"} fontFamily="monospace" textAnchor="middle">
                v₂ (λ₂={lambda2.toFixed(1)})
              </text>
            </svg>
          </div>
        </div>

        {/* Controls & Info */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Sliders */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-zinc-400 font-medium">σ₁ (Spread along v₁)</label>
                <span className="text-xs font-mono text-cyan-400">{sigma1.toFixed(1)}</span>
              </div>
              <input type="range" min="0.3" max="4" step="0.1" value={sigma1} onChange={e => setSigma1(+e.target.value)} className={sliderStyle} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-zinc-400 font-medium">σ₂ (Spread along v₂)</label>
                <span className="text-xs font-mono text-pink-400">{sigma2.toFixed(1)}</span>
              </div>
              <input type="range" min="0.1" max="4" step="0.1" value={sigma2} onChange={e => setSigma2(+e.target.value)} className={sliderStyle} style={{accentColor: '#ec4899'}} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-zinc-400 font-medium">θ (Rotation)</label>
                <span className="text-xs font-mono text-yellow-400">{(theta * 180 / Math.PI).toFixed(0)}°</span>
              </div>
              <input type="range" min="0" max={Math.PI} step="0.01" value={theta} onChange={e => setTheta(+e.target.value)} className={sliderStyle} style={{accentColor: '#eab308'}} />
            </div>
          </div>

          {/* Eigenvalue Display */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Eigenvalues</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-cyan-400" />
                <span className="text-xs text-zinc-300 font-mono">λ₁ = σ₁² = {lambda1.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-pink-400" />
                <span className="text-xs text-zinc-300 font-mono">λ₂ = σ₂² = {lambda2.toFixed(2)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-white/5">
                <span className="text-[10px] text-zinc-500">Ratio λ₁/λ₂ = </span>
                <span className="text-xs font-mono text-yellow-400">{(lambda1/lambda2).toFixed(1)}×</span>
              </div>
            </div>
          </div>

          {/* Covariance Matrix */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Covariance Matrix C</p>
            <div className="flex items-center gap-1 justify-center">
              <span className="text-zinc-500 text-lg">[</span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-xs font-mono text-cyan-300 text-right">{covA.toFixed(2)}</span>
                <span className="text-xs font-mono text-zinc-400 text-right">{covB.toFixed(2)}</span>
                <span className="text-xs font-mono text-zinc-400 text-right">{covB.toFixed(2)}</span>
                <span className="text-xs font-mono text-pink-300 text-right">{covD.toFixed(2)}</span>
              </div>
              <span className="text-zinc-500 text-lg">]</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-6 p-4 bg-white/[0.02] rounded-xl border border-white/5">
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-cyan-400 font-semibold">The cyan arrow</span> points along the direction of maximum spread — the first eigenvector <InlineMath math="\mathbf{v}_1" />. 
          Its length is proportional to <InlineMath math="\sigma_1" />, and the eigenvalue <InlineMath math="\lambda_1 = \sigma_1^2" /> measures how much variance lives along this direction. 
          <span className="text-pink-400 font-semibold"> The pink arrow</span> is perpendicular — the second eigenvector. When <InlineMath math="\lambda_1 \gg \lambda_2" />, the data cloud is elongated like a cigar; when <InlineMath math="\lambda_1 \approx \lambda_2" />, it's roughly circular.
        </p>
      </div>
    </motion.div>
  );
}

// ============================================================
// CARD 2: PCA & VARIANCE EXPLAINED
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

  const [showProjection, setShowProjection] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className={cardStyle}>
      <SectionHeader icon={BarChart3} title="PCA & Compression" subtitle="How much information can you throw away?" color="pink" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Variance Bars */}
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
                  <motion.div 
                    className="h-full rounded-lg" 
                    style={{ backgroundColor: colors[i], opacity: 0.7 }}
                    animate={{ width: `${fractions[i] * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-mono text-white/80">{(cumulative[i]*100).toFixed(1)}% cumulative</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sliders */}
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

        {/* Suitcase Analogy & Insight */}
        <div className="flex flex-col gap-4">
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">The Compression Insight</p>
            <div className="space-y-2">
              <p className="text-xs text-zinc-300">
                Keeping only <span className="text-cyan-400 font-bold">1 direction</span> captures:
              </p>
              <p className="text-2xl font-bold text-cyan-400 font-mono">{(fractions[0]*100).toFixed(1)}%</p>
              <p className="text-xs text-zinc-300">
                Keeping <span className="text-cyan-400 font-bold">2 directions</span> captures:
              </p>
              <p className="text-2xl font-bold text-pink-400 font-mono">{(cumulative[1]*100).toFixed(1)}%</p>
              <p className="text-[11px] text-zinc-500 mt-2">
                You cut the data size by {(100 * (1 - 2/4)).toFixed(0)}% while keeping almost everything that matters.
              </p>
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

          <div className="bg-gradient-to-r from-cyan-500/5 to-pink-500/5 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">In Code</p>
            <pre className="text-[10px] font-mono text-zinc-400 overflow-x-auto">
{`cov_matrix = np.cov(centered_data.T)
eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)
# Keep top-k eigenvectors → PCA compression`}
            </pre>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CARD 3: REPEATED TRANSFORMATIONS (EXPLODING/VANISHING)
// ============================================================
function RepeatTransformCard() {
  const [eigenvalue, setEigenvalue] = useState(1.3);
  const [layers, setLayers] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState([[1, 0.6]]);

  const maxLayers = 20;

  useEffect(() => {
    if (!isPlaying) return;
    if (layers >= maxLayers) { setIsPlaying(false); return; }
    const timeout = setTimeout(() => {
      const last = history[history.length - 1];
      const next = [last[0] * eigenvalue, last[1] * eigenvalue];
      setHistory(prev => [...prev, next]);
      setLayers(prev => prev + 1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [isPlaying, layers, history, eigenvalue]);

  const handleStep = () => {
    if (layers >= maxLayers) return;
    const last = history[history.length - 1];
    const next = [last[0] * eigenvalue, last[1] * eigenvalue];
    setHistory(prev => [...prev, next]);
    setLayers(prev => prev + 1);
  };

  const handleReset = () => {
    setHistory([[1, 0.6]]);
    setLayers(0);
    setIsPlaying(false);
  };

  const handleEigenvalueChange = (val) => {
    setEigenvalue(val);
    handleReset();
  };

  const magnitude = Math.sqrt(history[layers][0]**2 + history[layers][1]**2);
  const isExploding = eigenvalue > 1.01;
  const isVanishing = eigenvalue < 0.99;

  const vr = 8;

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className={cardStyle}>
      <SectionHeader icon={Zap} title="Repeated Transformations" subtitle="Why gradients explode or vanish in deep networks" color="yellow" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Visualization */}
        <div className="lg:col-span-3">
          <div className="aspect-square bg-black/50 rounded-xl border border-white/5 overflow-hidden">
            <svg viewBox={`${-vr} ${-vr} ${vr*2} ${vr*2}`} className="w-full h-full">
              {/* Grid */}
              {[-6,-4,-2,2,4,6].map(i => (
                <React.Fragment key={i}>
                  <line x1={-vr} y1={i} x2={vr} y2={i} stroke="white" strokeOpacity="0.04" strokeWidth="0.02" />
                  <line x1={i} y1={-vr} x2={i} y2={vr} stroke="white" strokeOpacity="0.04" strokeWidth="0.02" />
                </React.Fragment>
              ))}
              <line x1={-vr} y1={0} x2={vr} y2={0} stroke="white" strokeOpacity="0.12" strokeWidth="0.03" />
              <line x1={0} y1={-vr} x2={0} y2={vr} stroke="white" strokeOpacity="0.12" strokeWidth="0.03" />

              {/* Trail */}
              {history.slice(0, layers + 1).map((pt, i) => {
                const opacity = 0.1 + (i / Math.max(layers, 1)) * 0.6;
                const scale = Math.min(Math.max(Math.sqrt(pt[0]**2 + pt[1]**2) * 0.1, 0.03), 0.2);
                return (
                  <circle key={i} cx={pt[0]} cy={-pt[1]} r={scale} 
                    fill={isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308'} 
                    opacity={opacity} />
                );
              })}

              {/* Trail lines */}
              {history.slice(0, layers + 1).map((pt, i) => {
                if (i === 0) return null;
                const prev = history[i-1];
                return (
                  <line key={`l${i}`} x1={prev[0]} y1={-prev[1]} x2={pt[0]} y2={-pt[1]}
                    stroke={isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308'}
                    strokeWidth="0.03" opacity={0.3} />
                );
              })}

              {/* Current vector */}
              {layers >= 0 && (
                <>
                  <line x1={0} y1={0} x2={history[layers][0]} y2={-history[layers][1]}
                    stroke={isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308'}
                    strokeWidth="0.08" opacity="0.9" />
                  <circle cx={history[layers][0]} cy={-history[layers][1]} r="0.15"
                    fill={isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308'} opacity="0.9" />
                </>
              )}

              {/* Magnitude label */}
              <text x={-vr + 0.3} y={-vr + 0.6} fill="white" fontSize="0.4" fontFamily="monospace" opacity="0.7">
                |v| = {magnitude.toFixed(2)}
              </text>
              <text x={-vr + 0.3} y={-vr + 1.1} fill="white" fontSize="0.35" fontFamily="monospace" opacity="0.5">
                Layer {layers} / {maxLayers}
              </text>
            </svg>
          </div>
        </div>

        {/* Controls */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs text-zinc-400 font-medium">Eigenvalue λ</label>
              <span className={`text-xs font-mono font-bold ${isExploding ? 'text-red-400' : isVanishing ? 'text-cyan-400' : 'text-yellow-400'}`}>
                {eigenvalue.toFixed(2)}
              </span>
            </div>
            <input type="range" min="0.1" max="2.0" step="0.01" value={eigenvalue}
              onChange={e => handleEigenvalueChange(+e.target.value)} className={sliderStyle}
              style={{ accentColor: isExploding ? '#ef4444' : isVanishing ? '#06b6d4' : '#eab308' }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-cyan-400/60">Vanishing</span>
              <span className="text-[9px] text-yellow-400/60">Stable</span>
              <span className="text-[9px] text-red-400/60">Exploding</span>
            </div>
          </div>

          {/* Status */}
          <div className={`rounded-xl p-4 border ${isExploding ? 'bg-red-500/5 border-red-500/20' : isVanishing ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              {isExploding ? <TrendingUp size={14} className="text-red-400" /> : isVanishing ? <TrendingDown size={14} className="text-cyan-400" /> : <Minus size={14} className="text-yellow-400" />}
              <span className={`text-xs font-bold ${isExploding ? 'text-red-400' : isVanishing ? 'text-cyan-400' : 'text-yellow-400'}`}>
                {isExploding ? 'EXPLODING' : isVanishing ? 'VANISHING' : 'STABLE'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {isExploding && `After ${maxLayers} layers: magnitude ≈ ${magnitude.toFixed(0)} → ∞ (overflow)`}
              {isVanishing && `After ${maxLayers} layers: magnitude ≈ ${magnitude.toExponential(2)} → 0 (underflow)`}
              {!isExploding && !isVanishing && `Magnitude stays near 1.0 across all layers.`}
            </p>
            <p className="text-[10px] text-zinc-500 mt-2 font-mono">
              |v| = λⁿ = {eigenvalue.toFixed(2)}^{layers} = {Math.pow(eigenvalue, layers).toFixed(4)}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={() => setIsPlaying(!isPlaying)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${isPlaying ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'}`}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={handleStep} disabled={layers >= maxLayers} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white border border-white/10 hover:bg-white/10 transition disabled:opacity-30">
              <SkipForward size={14} /> Step
            </button>
            <button onClick={handleReset} className="flex items-center justify-center px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white border border-white/10 hover:bg-white/10 transition">
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Each layer multiplies the signal by λ. After <InlineMath math="n" /> layers: <InlineMath math={`\\lambda^${layers} = ${Math.pow(eigenvalue, layers).toFixed(3)}`} />. 
              This is exactly why deep networks need careful weight initialization.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CARD 4: DIAGONALIZATION
// ============================================================
function DiagonalizationCard() {
  const [step, setStep] = useState(0);
  
  // Matrix A = [[2, 1], [1, 2]]
  // Eigenvalues: 3, 1; Eigenvectors: [1/√2, 1/√2], [-1/√2, 1/√2]
  const A = [[2, 1], [1, 2]];
  const sqrt2 = Math.SQRT2;
  const V = [[1/sqrt2, -1/sqrt2], [1/sqrt2, 1/sqrt2]];
  const Vinv = matInverse2x2(V);
  const D = [[3, 0], [0, 1]];

  // Grid points for visualization
  const gridPoints = useMemo(() => {
    const pts = [];
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        pts.push([i, j]);
      }
    }
    return pts;
  }, []);

  // Transform grid based on step
  const transformedGrid = useMemo(() => {
    return gridPoints.map(pt => {
      let p = [...pt];
      if (step >= 1) p = matVec2x2(Vinv, p); // V^(-1)
      if (step >= 2) p = matVec2x2(D, p);    // D
      if (step >= 3) p = matVec2x2(V, p);    // V
      return p;
    });
  }, [step, gridPoints]);

  // Test vector
  const testVec = [1, 0.5];
  const transformedVec = useMemo(() => {
    let v = [...testVec];
    if (step >= 1) v = matVec2x2(Vinv, v);
    if (step >= 2) v = matVec2x2(D, v);
    if (step >= 3) v = matVec2x2(V, v);
    return v;
  }, [step]);

  const stepLabels = ['Original Space', 'After V⁻¹ (Translate In)', 'After D (Scale)', 'After V (Translate Out) = A'];
  const stepDescriptions = [
    'The grid and vector in the standard basis. The transformation A mixes rotation and scaling.',
    'We change to the eigenvector basis. The grid axes now align with the natural directions of A.',
    'In the eigenvector basis, A is just D — pure scaling! Each axis is scaled by its eigenvalue.',
    'We transform back. The result is exactly A applied to the original vector. A = VDV⁻¹.',
  ];

  const vr = 5;

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} className={cardStyle}>
      <SectionHeader icon={Grid3x3} title="Diagonalization: The Translator" subtitle="A = VDV⁻¹ — seeing transformation in its natural basis" color="purple" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* SVG */}
        <div className="lg:col-span-3">
          <div className="aspect-square bg-black/50 rounded-xl border border-white/5 overflow-hidden">
            <svg viewBox={`${-vr} ${-vr} ${vr*2} ${vr*2}`} className="w-full h-full">
              {/* Grid */}
              {[-4,-3,-2,-1,0,1,2,3,4].map(i => (
                <React.Fragment key={i}>
                  <line x1={-vr} y1={i} x2={vr} y2={i} stroke="white" strokeOpacity="0.04" strokeWidth="0.02" />
                  <line x1={i} y1={-vr} x2={i} y2={vr} stroke="white" strokeOpacity="0.04" strokeWidth="0.02" />
                </React.Fragment>
              ))}
              <line x1={-vr} y1={0} x2={vr} y2={0} stroke="white" strokeOpacity="0.12" strokeWidth="0.03" />
              <line x1={0} y1={-vr} x2={0} y2={vr} stroke="white" strokeOpacity="0.12" strokeWidth="0.03" />

              {/* Transformed grid lines */}
              {[-3,-2,-1,0,1,2,3].map(i => {
                const hLine = gridPoints.filter(p => p[1] === i).sort((a,b) => a[0]-b[0]).map(p => {
                  let pt = [...p];
                  if (step >= 1) pt = matVec2x2(Vinv, pt);
                  if (step >= 2) pt = matVec2x2(D, pt);
                  if (step >= 3) pt = matVec2x2(V, pt);
                  return pt;
                });
                const vLine = gridPoints.filter(p => p[0] === i).sort((a,b) => a[1]-b[1]).map(p => {
                  let pt = [...p];
                  if (step >= 1) pt = matVec2x2(Vinv, pt);
                  if (step >= 2) pt = matVec2x2(D, pt);
                  if (step >= 3) pt = matVec2x2(V, pt);
                  return pt;
                });
                return (
                  <React.Fragment key={`g${i}`}>
                    {hLine.length > 1 && (
                      <polyline points={hLine.map(p => `${p[0]},${-p[1]}`).join(' ')}
                        fill="none" stroke="#a855f7" strokeWidth="0.03" opacity="0.3" />
                    )}
                    {vLine.length > 1 && (
                      <polyline points={vLine.map(p => `${p[0]},${-p[1]}`).join(' ')}
                        fill="none" stroke="#a855f7" strokeWidth="0.03" opacity="0.3" />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Grid points */}
              {transformedGrid.map((pt, i) => (
                <circle key={i} cx={pt[0]} cy={-pt[1]} r="0.06" fill="#a855f7" opacity="0.5" />
              ))}

              {/* Test vector */}
              <line x1={0} y1={0} x2={transformedVec[0]} y2={-transformedVec[1]}
                stroke="#eab308" strokeWidth="0.1" opacity="0.9" />
              <circle cx={transformedVec[0]} cy={-transformedVec[1]} r="0.12" fill="#eab308" opacity="0.9" />

              {/* Eigenvector directions (shown in step 1+) */}
              {step >= 1 && (
                <>
                  <line x1={-4*V[0][0]} y1={-4*(-V[1][0])} x2={4*V[0][0]} y2={4*(-V[1][0])}
                    stroke="#06b6d4" strokeWidth="0.04" strokeDasharray="0.1 0.1" opacity="0.4" />
                  <line x1={-4*V[0][1]} y1={-4*(-V[1][1])} x2={4*V[0][1]} y2={4*(-V[1][1])}
                    stroke="#ec4899" strokeWidth="0.04" strokeDasharray="0.1 0.1" opacity="0.4" />
                </>
              )}

              {/* Labels */}
              <text x={-vr+0.3} y={-vr+0.6} fill="#a855f7" fontSize="0.35" fontFamily="monospace" opacity="0.7">
                Step {step}: {stepLabels[step]}
              </text>
            </svg>
          </div>
        </div>

        {/* Controls & Matrices */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Step Controls */}
          <div className="flex gap-2">
            {[0,1,2,3].map(s => (
              <button key={s} onClick={() => setStep(s)}
                className={`flex-1 py-2 rounded-lg text-xs font-mono transition ${step === s ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-zinc-500 border border-white/5 hover:bg-white/10'}`}>
                {s}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed min-h-[2.5rem]">
            {stepDescriptions[step]}
          </p>

          {/* Matrices */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5 space-y-3">
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="text-center">
                <p className="text-[9px] text-zinc-500 mb-1">A</p>
                <div className="flex items-center gap-0.5 justify-center">
                  <span className="text-zinc-600 text-sm">[</span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-mono text-white text-right">{A[0][0]}</span>
                    <span className="text-[10px] font-mono text-white text-right">{A[0][1]}</span>
                    <span className="text-[10px] font-mono text-white text-right">{A[1][0]}</span>
                    <span className="text-[10px] font-mono text-white text-right">{A[1][1]}</span>
                  </div>
                  <span className="text-zinc-600 text-sm">]</span>
                </div>
              </div>
              <span className="text-zinc-600 text-center text-xs">=</span>
              <div className="text-center">
                <p className="text-[9px] text-zinc-500 mb-1">V · D · V⁻¹</p>
                <div className="flex items-center gap-0.5 justify-center">
                  <span className="text-[9px] font-mono text-cyan-400">V</span>
                  <span className="text-[9px] font-mono text-yellow-400">D</span>
                  <span className="text-[9px] font-mono text-pink-400">V⁻¹</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[9px] text-cyan-400 mb-1">V (eigenvectors)</p>
                <div className="flex items-center gap-0.5 justify-center">
                  <span className="text-zinc-600 text-xs">[</span>
                  <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                    <span className="text-[9px] font-mono text-cyan-300">{V[0][0].toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-cyan-300">{V[0][1].toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-cyan-300">{V[1][0].toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-cyan-300">{V[1][1].toFixed(2)}</span>
                  </div>
                  <span className="text-zinc-600 text-xs">]</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-yellow-400 mb-1">D (eigenvalues)</p>
                <div className="flex items-center gap-0.5 justify-center">
                  <span className="text-zinc-600 text-xs">[</span>
                  <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                    <span className="text-[9px] font-mono text-yellow-300">3</span>
                    <span className="text-[9px] font-mono text-zinc-600">0</span>
                    <span className="text-[9px] font-mono text-zinc-600">0</span>
                    <span className="text-[9px] font-mono text-yellow-300">1</span>
                  </div>
                  <span className="text-zinc-600 text-xs">]</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-pink-400 mb-1">V⁻¹</p>
                <div className="flex items-center gap-0.5 justify-center">
                  <span className="text-zinc-600 text-xs">[</span>
                  <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
                    <span className="text-[9px] font-mono text-pink-300">{Vinv[0][0].toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-pink-300">{Vinv[0][1].toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-pink-300">{Vinv[1][0].toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-pink-300">{Vinv[1][1].toFixed(2)}</span>
                  </div>
                  <span className="text-zinc-600 text-xs">]</span>
                </div>
              </div>
            </div>
          </div>

          {/* Power insight */}
          <div className="bg-gradient-to-r from-purple-500/5 to-yellow-500/5 rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Why This Matters for Deep Networks</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <InlineMath math="\mathbf{A}^{100} = \mathbf{V}\mathbf{D}^{100}\mathbf{V}^{-1}" /> — and <InlineMath math="\mathbf{D}^{100}" /> is trivial: just raise each eigenvalue to the 100th power. 
              <span className="text-yellow-400"> 3¹⁰⁰ = 5.15 × 10⁴⁷</span> (explodes!) while <span className="text-cyan-400"> 1¹⁰⁰ = 1</span> (stable).
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// CARD 5: CHECK-IN QUESTIONS
// ============================================================
function CheckInCard() {
  const [openQ, setOpenQ] = useState(null);

  const questions = [
    {
      q: 'If a dataset\'s covariance matrix has eigenvalues λ₁ = 500 and λ₂ = 2, what does the data cloud look like?',
      hint: 'Think about the rice grains on the table...',
      answer: 'Long and thin — like a cigar or a vein of gold. The first eigenvector direction has 250× more spread than the second. Almost all the "action" in this data happens along one direction. The second direction barely varies at all.',
      color: 'cyan'
    },
    {
      q: 'In A = VDV⁻¹, what is D doing, and why is it simpler than A?',
      hint: 'Think about the translator analogy...',
      answer: 'D is the "conversation in the simple language." It just scales each eigenvector direction by its eigenvalue — no rotation, no mixing between directions. A looks complicated (rotation + scaling mixed together) only because we\'re viewing it from the wrong angle. In the eigenvector basis, the transformation is pure, independent scaling along each axis.',
      color: 'purple'
    }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.4 }} className={cardStyle}>
      <SectionHeader icon={Sparkles} title="Check-In" subtitle="Test your intuition" color="green" />

      <div className="space-y-3">
        {questions.map((item, i) => (
          <div key={i} className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
            <button onClick={() => setOpenQ(openQ === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${item.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
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
                    <div className={`p-3 rounded-lg ${item.color === 'cyan' ? 'bg-cyan-500/5 border border-cyan-500/10' : 'bg-purple-500/5 border border-purple-500/10'}`}>
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
export default function EigenvalueSimulator() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.03] via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 text-center relative">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-400 mb-4">
              <Box size={12} className="text-cyan-400" />
              SB5-B • Eigenvalues & Data Geometry
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              The Shape of Data
            </h1>
            <p className="text-sm text-zinc-500 mt-3 max-w-lg mx-auto leading-relaxed">
              How eigenvalues reveal the natural axes of variation in any dataset — 
              and why this is the foundation of PCA, compression, and understanding deep networks.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <DataCloudCard />
        <PCACard />
        <RepeatTransformCard />
        <DiagonalizationCard />
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