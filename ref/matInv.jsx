// LinearRegressionVisualizer.jsx
import React, { useState, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── helper: creates a labelled 3D arrow from `from` to `to` ───
const Arrow = ({ from, to, color, label }) => {
  const direction = useMemo(() => {
    const d = new THREE.Vector3().subVectors(to, from);
    const len = d.length();
    if (len < 1e-6) return { dir: new THREE.Vector3(0, 1, 0), length: 0 };
    return { dir: d.normalize(), length: len };
  }, [from, to]);

  // cylinder + cone arrow body
  const shaftLength = Math.max(0, direction.length - 0.35);
  const headLength = Math.min(0.35, direction.length * 0.25);
  const headWidth = headLength * 0.8;
  const shaftRef = useRef();
  const headRef = useRef();

  // compute world position for the label (slightly past the tip)
  const labelPosition = useMemo(() => {
    return new THREE.Vector3().copy(to).addScaledVector(direction.dir, 0.3);
  }, [to, direction.dir]);

  if (direction.length < 0.01) return null;

  return (
    <group position={from.toArray()}>
      {/* align arrow along Y axis, then rotate to direction */}
      <group quaternion={
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.dir
        )
      }>
        <mesh ref={shaftRef} position={[0, shaftLength / 2, 0]}>
          <cylinderGeometry args={[0.05, 0.05, shaftLength, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh ref={headRef} position={[0, shaftLength + headLength / 2, 0]}>
          <coneGeometry args={[headWidth, headLength, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      <Html position={labelPosition} center>
        <span style={{
          color,
          background: 'rgba(0,0,0,0.7)',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 'bold',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {label}
        </span>
      </Html>
    </group>
  );
};

// ─── Column‑space plane (parallelogram) ───
const ColumnPlane = ({ x1, x2, det }) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const v1 = new THREE.Vector3(0, 0, 0);
    const v2 = x1;
    const v3 = new THREE.Vector3().addVectors(x1, x2);
    const v4 = x2;
    const vertices = new Float32Array([
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,
      v3.x, v3.y, v3.z,
      v1.x, v1.y, v1.z,
      v3.x, v3.y, v3.z,
      v4.x, v4.y, v4.z,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return g;
  }, [x1, x2]);

  const isCollapsed = det < 0.5;
  const color = isCollapsed ? '#ef4444' : '#6366f1';
  const opacity = isCollapsed ? 0.12 : 0.22;

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ─── Dashed error line (residual) ───
const ErrorLine = ({ from, to }) => {
  // We use a line with dashed material; Drei's <Line> would work but we want dashes.
  // Simple approach: create a buffer geometry and use a LineDashedMaterial.
  const lineRef = useRef();
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]),
        3
      )
    );
    return g;
  }, [from, to]);

  // Update dashes when geometry changes
  React.useEffect(() => {
    if (lineRef.current) lineRef.current.computeLineDistances();
  }, [geometry]);

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineDashedMaterial
        color="#f97316"
        dashSize={0.18}
        gapSize={0.12}
        linewidth={2}
      />
    </lineSegments>
  );
};

// ─── The 3D scene (content inside Canvas) ───
const SceneContent = ({ t }) => {
  // Fixed vectors
  const x1 = useMemo(() => new THREE.Vector3(2, 1, 0), []);
  const x2_indep = useMemo(() => new THREE.Vector3(0, 2, 2), []);
  const x2_dep = useMemo(() => new THREE.Vector3(4, 2, 0), []); // 2 * x1
  const y = useMemo(() => new THREE.Vector3(1, 1, 3), []);

  // Interpolated feature 2
  const x2 = useMemo(
    () => new THREE.Vector3().lerpVectors(x2_indep, x2_dep, t),
    [t, x2_indep, x2_dep]
  );

  // Linear algebra
  const { det, w1, w2, yHat } = useMemo(() => {
    const x1x1 = x1.dot(x1);
    const x1x2 = x1.dot(x2);
    const x2x2 = x2.dot(x2);
    const d = x1x1 * x2x2 - x1x2 * x1x2;
    const x1y = x1.dot(y);
    const x2y = x2.dot(y);

    if (d < 1e-3) {
      const w1_ = x1y / x1x1;
      return { det: d, w1: w1_, w2: 0, yHat: x1.clone().multiplyScalar(w1_) };
    }
    const w1_ = (x2x2 * x1y - x1x2 * x2y) / d;
    const w2_ = (x1x1 * x2y - x1x2 * x1y) / d;
    const yHat_ = new THREE.Vector3()
      .addScaledVector(x1, w1_)
      .addScaledVector(x2, w2_);
    return { det: d, w1: w1_, w2: w2_, yHat: yHat_ };
  }, [x1, x2, y]);

  return (
    <>
      <axesHelper args={[3.5]} />
      <gridHelper args={[10, 10, '#334155', '#1e293b']} />

      <ColumnPlane x1={x1} x2={x2} det={det} />

      <Arrow from={new THREE.Vector3(0, 0, 0)} to={x1} color="#ef4444" label="x₁" />
      <Arrow from={new THREE.Vector3(0, 0, 0)} to={x2} color="#3b82f6" label="x₂" />
      <Arrow from={new THREE.Vector3(0, 0, 0)} to={y} color="#a855f7" label="y" />
      <Arrow from={new THREE.Vector3(0, 0, 0)} to={yHat} color="#22c55e" label="ŷ" />

      <ErrorLine from={yHat} to={y} />
    </>
  );
};

// ─── UI: slider and math display ───
const ControlPanel = ({ t, setT, math, x1, x2, y }) => {
  const isCollapsed = t > 0.95;

  const formatW = (val) => {
    if (Math.abs(val) > 100) return val < 0 ? '−∞' : '∞';
    return val.toFixed(2);
  };

  const detClass = isCollapsed ? 'text-red-400' : 'text-indigo-400';
  const wClass = isCollapsed ? 'text-red-400' : 'text-green-400';

  return (
    <div className="p-6 space-y-6 bg-slate-900 text-white overflow-y-auto max-h-screen">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="bg-indigo-600 w-8 h-8 rounded flex items-center justify-center text-sm">XᵀX</span>
          Multicollinearity & The Inverse
        </h1>
        <p className="text-sm text-slate-400 mt-1 leading-relaxed">
          Visualize why linearly dependent features break the Normal Equation:{' '}
          <span className="math-font text-indigo-400 bg-slate-800 px-1.5 py-0.5 rounded">
            w = (XᵀX)⁻¹Xᵀy
          </span>
        </p>
      </div>

      {/* slider */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-semibold text-slate-300">Linear Dependence</label>
          <span className={`text-xs font-bold px-2 py-1 rounded ${
            isCollapsed ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
          }`}>
            {isCollapsed ? 'Linearly Dependent' : 'Independent'}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={t}
          onChange={(e) => setT(parseFloat(e.target.value))}
          className="w-full mb-2"
        />
        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>x₂ ⟂ x₁</span>
          <span>x₂ = 2x₁ (Collapsed)</span>
        </div>
      </div>

      {/* Design Matrix X */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Design Matrix X (3×2)</div>
        <div className="flex items-center justify-center gap-4 font-mono text-sm">
          <span className="text-slate-400">X =</span>
          <div className="matrix-bracket text-slate-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
              <span className="text-red-400">{x1.x.toFixed(1)}</span>
              <span className="text-blue-400">{x2.x.toFixed(1)}</span>
              <span className="text-red-400">{x1.y.toFixed(1)}</span>
              <span className="text-blue-400">{x2.y.toFixed(1)}</span>
              <span className="text-red-400">{x1.z.toFixed(1)}</span>
              <span className="text-blue-400">{x2.z.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gram Matrix XᵀX */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Gram Matrix XᵀX (2×2)</div>
        <div className="flex items-center justify-center gap-4 font-mono text-sm">
          <span className="text-slate-400">XᵀX =</span>
          <div className="matrix-bracket text-slate-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
              <span>{math.x1x1.toFixed(1)}</span>
              <span>{math.x1x2.toFixed(1)}</span>
              <span>{math.x1x2.toFixed(1)}</span>
              <span>{math.x2x2.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center">
          <span className="text-sm text-slate-400">Determinant:</span>
          <span className={`text-lg font-bold font-mono ${detClass}`}>{math.det.toFixed(2)}</span>
        </div>
      </div>

      {/* Weights */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Optimal Weights (w)</div>
        <div className="flex items-center justify-center gap-4 font-mono text-sm">
          <span className="text-slate-400">w =</span>
          <div className="matrix-bracket text-slate-300">
            <div className="grid grid-cols-1 gap-y-1 text-right w-16">
              <span className={wClass}>{formatW(math.w1)}</span>
              <span className={wClass}>{formatW(math.w2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className={`rounded-xl p-4 text-sm leading-relaxed ${
        isCollapsed
          ? 'bg-red-900/20 border border-red-500/30 text-red-200'
          : 'bg-indigo-900/20 border border-indigo-500/30 text-indigo-200'
      }`}>
        {isCollapsed ? (
          <>
            <strong className="text-red-400 block mb-2">⚠️ Singular Matrix (Algebraic Failure)</strong>
            The plane has collapsed into a 1D line. The determinant of XᵀX is 0.<br /><br />
            To reach the projection ŷ, the weights must satisfy:{' '}
            <span className="font-mono bg-slate-900 px-1 rounded text-white">
              {math.x1x1.toFixed(1)}w₁ + {math.x1x2.toFixed(1)}w₂ = {(math.yHat.dot(x1)).toFixed(1)}
            </span>.<br /><br />
            There are <em>infinitely many</em> solutions for (w₁, w₂). The inverse formula (XᵀX)⁻¹
            requires dividing by the determinant (0), causing the weights to explode to infinity.
            The model cannot choose a unique solution.
          </>
        ) : (
          <>
            <strong className="text-indigo-400 block mb-2">✅ Invertible System</strong>
            The columns of X are linearly independent and span a 2D plane. The determinant of XᵀX
            is non‑zero ({math.det.toFixed(1)}), so the inverse (XᵀX)⁻¹ exists.<br /><br />
            There is exactly <em>one unique</em> weight vector w that minimizes the orthogonal
            error (orange dashed line) to reach the projection ŷ.
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Layout ───
export default function LinearRegressionVisualizer() {
  const [t, setT] = useState(0);

  // Fixed vectors (for math display only)
  const x1 = useMemo(() => new THREE.Vector3(2, 1, 0), []);
  const x2_indep = useMemo(() => new THREE.Vector3(0, 2, 2), []);
  const x2_dep = useMemo(() => new THREE.Vector3(4, 2, 0), []);
  const y = useMemo(() => new THREE.Vector3(1, 1, 3), []);
  const x2 = useMemo(() => new THREE.Vector3().lerpVectors(x2_indep, x2_dep, t), [t, x2_indep, x2_dep]);

  // Recalculate math values for the UI panel
  const math = useMemo(() => {
    const x1x1 = x1.dot(x1);
    const x1x2 = x1.dot(x2);
    const x2x2 = x2.dot(x2);
    const det = x1x1 * x2x2 - x1x2 * x1x2;
    const x1y = x1.dot(y);
    const x2y = x2.dot(y);
    let w1, w2, yHat;
    if (det < 1e-3) {
      w1 = x1y / x1x1;
      w2 = 0;
      yHat = x1.clone().multiplyScalar(w1);
    } else {
      w1 = (x2x2 * x1y - x1x2 * x2y) / det;
      w2 = (x1x1 * x2y - x1x2 * x1y) / det;
      yHat = new THREE.Vector3().addScaledVector(x1, w1).addScaledVector(x2, w2);
    }
    return { x1x1, x1x2, x2x2, det, x1y, x2y, w1, w2, yHat };
  }, [x1, x2, y]);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-slate-900">
      {/* 3D canvas */}
      <div className="relative flex-1 min-h-[50vh] lg:min-h-0">
        <Canvas
          camera={{ position: [5, 4, 6], fov: 45 }}
          style={{ background: '#020617' }}
        >
          <OrbitControls enableDamping dampingFactor={0.08} />
          <SceneContent t={t} />
        </Canvas>
        {/* legend overlay */}
        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-xs space-y-2 pointer-events-none">
          {[
            { color: '#ef4444', label: 'x₁ (Feature 1)' },
            { color: '#3b82f6', label: 'x₂ (Feature 2)' },
            { color: '#a855f7', label: 'y (Target)' },
            { color: '#22c55e', label: 'ŷ (Projection)' },
            { color: '#6366f1', label: 'Column Space', isPlane: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              {item.isPlane ? (
                <span className="w-3 h-3 rounded bg-indigo-500/30 border border-indigo-400" />
              ) : (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              )}
              <span style={{ color: item.color }} className="font-bold">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-[450px] border-l border-slate-800 overflow-y-auto">
        <ControlPanel t={t} setT={setT} math={math} x1={x1} x2={x2} y={y} />
      </div>
    </div>
  );
}