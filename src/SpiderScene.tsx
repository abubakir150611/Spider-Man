import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ── Math utils ──────────────────────────────────────────────────────────────
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ss = (lo: number, hi: number, x: number) => {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fadeAlpha = (t: number, s: number, fi: number, fo: number, e: number) => {
  if (t <= s || t >= e) return 0;
  if (t < s + fi) return (t - s) / fi;
  if (t > e - fo) return (e - t) / fo;
  return 1;
};

// ── Camera keyframes ─────────────────────────────────────────────────────────
interface KF { t: number; px: number; py: number; pz: number; lx: number; ly: number; lz: number }
const CAM: KF[] = [
  { t: 0.000, px: 0,    py: 0.15, pz: 7.5,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.055, px: 0,    py: 0.1,  pz: 5.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.115, px: 0.42, py: 0.35, pz: 2.4,  lx: 0.38, ly: 0.28, lz: 0   },
  { t: 0.175, px: 0.40, py: 0.32, pz: 1.0,  lx: 0.40, ly: 0.32, lz: 0   },
  { t: 0.245, px: 0.39, py: 0.30, pz: -2.5, lx: 0,    ly: 0,    lz: -12 },
  { t: 0.330, px: 0,    py: 0,    pz: 6.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.405, px: 0,    py: 0,    pz: 0.7,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.470, px: 0,    py: 1.8,  pz: 3.5,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.540, px: 2.8,  py: 1.2,  pz: 4.5,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.615, px: 0,    py: 0,    pz: 1.0,  lx: 0,    ly: 0,    lz: -1  },
  { t: 0.685, px: 0,    py: -0.4, pz: 5.0,  lx: 0,    ly: -0.4, lz: 0   },
  { t: 0.755, px: 0,    py: 0,    pz: 6.5,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.835, px: -2.5, py: 0.2,  pz: 7.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.875, px: 0,    py: 0,    pz: 6.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.910, px: 0.6,  py: 0,    pz: 6.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.940, px: -0.6, py: 0,    pz: 6.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 0.968, px: 0,    py: 0,    pz: 9.0,  lx: 0,    ly: 0,    lz: 0   },
  { t: 1.000, px: 0,    py: 0.2,  pz: 10.5, lx: 0,    ly: 0,    lz: 0   },
];

function getCam(t: number) {
  let i = 0;
  while (i < CAM.length - 2 && CAM[i + 1].t <= t) i++;
  const k0 = CAM[i], k1 = CAM[i + 1];
  const span = k1.t - k0.t;
  const lt = span < 0.0001 ? 0 : easeIO(clamp((t - k0.t) / span, 0, 1));
  return {
    px: lerp(k0.px, k1.px, lt), py: lerp(k0.py, k1.py, lt), pz: lerp(k0.pz, k1.pz, lt),
    lx: lerp(k0.lx, k1.lx, lt), ly: lerp(k0.ly, k1.ly, lt), lz: lerp(k0.lz, k1.lz, lt),
  };
}

function sceneFromT(t: number): number {
  const r = [0, 0.075, 0.145, 0.270, 0.365, 0.450, 0.545, 0.640, 0.705, 0.770, 0.840, 0.880, 0.912, 0.942, 0.962, 1.01];
  for (let i = 0; i < r.length - 1; i++) if (t >= r[i] && t < r[i + 1]) return i;
  return 14;
}

// ── Builders ─────────────────────────────────────────────────────────────────

function buildEyeShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.30, 0);
  s.bezierCurveTo(-0.22, 0.22, 0.06, 0.30, 0.30, 0.18);
  s.bezierCurveTo(0.50, 0.08, 0.54, -0.04, 0.43, -0.18);
  s.bezierCurveTo(0.25, -0.30, -0.08, -0.26, -0.30, 0);
  return s;
}

/** Diamond spider-web grid painted onto a canvas, used as a diffuse+bump map on suit fabric. */
function buildWebPatternTexture(cells = 7, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e2e2e2";
  ctx.fillRect(0, 0, size, size);
  const step = size / cells;
  ctx.strokeStyle = "rgba(5,5,5,0.8)";
  ctx.lineWidth = Math.max(2, size / 170);
  ctx.beginPath();
  for (let i = -cells; i <= cells * 2; i++) {
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step - size, size);
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step + size, size);
  }
  ctx.stroke();
  // Fine fabric grain
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Tapers the bottom rows of a unit sphere inward to form a jaw/chin point. */
function taperJaw(geo: THREE.SphereGeometry, startY = -0.1, minTaper = 0.32): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < startY) {
      const t = clamp((startY - y) / (startY + 1), 0, 1);
      const taper = lerp(1, minTaper, easeIO(t));
      pos.setX(i, x * taper);
      pos.setZ(i, z * taper);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function buildMask(): { group: THREE.Group; eyeL: THREE.Mesh; eyeR: THREE.Mesh } {
  const group = new THREE.Group();

  const webTex = buildWebPatternTexture(7, 512);
  webTex.repeat.set(9, 6);

  const headGeo = new THREE.SphereGeometry(1, 128, 96);
  taperJaw(headGeo);
  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a0018, roughness: 0.34, metalness: 0.55,
    clearcoat: 0.5, clearcoatRoughness: 0.28,
    map: webTex, bumpMap: webTex, bumpScale: 0.022,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.scale.set(1.0, 1.22, 0.90);
  group.add(head);

  // Fine embossed web lines tracing the same diamond grid, for a crisper silhouette highlight
  const buf: number[] = [];
  const R = 20, C = 12, S = 48;
  for (let r = 0; r < R; r++) {
    const phi = (r / R) * Math.PI * 2;
    for (let s = 0; s < S; s++) {
      const t1 = (s / S) * Math.PI, t2 = ((s + 1) / S) * Math.PI;
      buf.push(
        1.009 * Math.sin(t1) * Math.cos(phi), 1.009 * 1.22 * Math.cos(t1), 1.009 * 0.9 * Math.sin(t1) * Math.sin(phi),
        1.009 * Math.sin(t2) * Math.cos(phi), 1.009 * 1.22 * Math.cos(t2), 1.009 * 0.9 * Math.sin(t2) * Math.sin(phi),
      );
    }
  }
  for (let c = 1; c <= C; c++) {
    const th = (c / (C + 1)) * Math.PI;
    const py = 1.22 * Math.cos(th), cr = 0.90 * Math.sin(th);
    const segs = Math.max(28, Math.round(cr * 60));
    for (let s = 0; s < segs; s++) {
      const a1 = (s / segs) * Math.PI * 2, a2 = ((s + 1) / segs) * Math.PI * 2;
      buf.push(cr * Math.cos(a1) * 1.009, py * 1.009, cr * Math.sin(a1) * 1.009,
               cr * Math.cos(a2) * 1.009, py * 1.009, cr * Math.sin(a2) * 1.009);
    }
  }
  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute("position", new THREE.Float32BufferAttribute(buf, 3));
  group.add(new THREE.LineSegments(webGeo, new THREE.LineBasicMaterial({ color: 0x1e0000, transparent: true, opacity: 0.35 })));

  const eyeOutlineGeo = new THREE.ShapeGeometry(buildEyeShape(), 48);
  const eyeOutlineMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const eyeGeo = new THREE.ShapeGeometry(buildEyeShape(), 48);
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0.95, clearcoat: 1.0,
    emissive: 0xffffff, emissiveIntensity: 0.8,
  });

  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.scale.setScalar(0.54);
  eyeL.position.set(0.37, 0.28 * 1.22, 0.85 * 0.90 + 0.012);
  eyeL.rotation.set(0.08, -0.25, -0.16);
  group.add(eyeL);
  const eyeOutlineL = new THREE.Mesh(eyeOutlineGeo, eyeOutlineMat);
  eyeOutlineL.scale.setScalar(0.54 * 1.16);
  eyeOutlineL.position.set(0.37, 0.28 * 1.22, 0.85 * 0.90 + 0.004);
  eyeOutlineL.rotation.copy(eyeL.rotation);
  group.add(eyeOutlineL);

  const eyeR = new THREE.Mesh(eyeGeo, eyeMat.clone());
  eyeR.scale.set(-0.54, 0.54, 0.54);
  eyeR.position.set(-0.37, 0.28 * 1.22, 0.85 * 0.90 + 0.012);
  eyeR.rotation.set(0.08, 0.25, 0.16);
  group.add(eyeR);
  const eyeOutlineR = new THREE.Mesh(eyeOutlineGeo, eyeOutlineMat);
  eyeOutlineR.scale.set(-0.54 * 1.16, 0.54 * 1.16, 0.54 * 1.16);
  eyeOutlineR.position.set(-0.37, 0.28 * 1.22, 0.85 * 0.90 + 0.004);
  eyeOutlineR.rotation.copy(eyeR.rotation);
  group.add(eyeOutlineR);

  return { group, eyeL, eyeR };
}

interface LensLayer { mesh: THREE.Mesh; rim: THREE.Mesh; baseZ: number }
function buildLens(): { group: THREE.Group; layers: LensLayer[] } {
  const group = new THREE.Group();
  const layers: LensLayer[] = [];
  const defs = [
    { r: 0.44, h: 0.045, color: 0x88aacc, op: 0.22, z: 0.00 },
    { r: 0.41, h: 0.035, color: 0xaaddff, op: 0.32, z: 0.07 },
    { r: 0.38, h: 0.030, color: 0x00ffcc, op: 0.18, z: 0.14 },
    { r: 0.35, h: 0.030, color: 0x0088ff, op: 0.28, z: 0.20 },
    { r: 0.32, h: 0.020, color: 0xffffff, op: 0.14, z: 0.25 },
  ];
  defs.forEach((d) => {
    const geo = new THREE.CylinderGeometry(d.r, d.r, d.h, 80, 1, true);
    const mat = new THREE.MeshPhysicalMaterial({
      color: d.color, roughness: 0, metalness: 0, transparent: true, opacity: d.op, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = d.z;
    group.add(mesh);

    const rimGeo = new THREE.TorusGeometry(d.r, 0.005, 8, 80);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.z = d.z;
    group.add(rim);

    layers.push({ mesh, rim, baseZ: d.z });
  });

  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.30, 64), new THREE.MeshBasicMaterial({ color: 0x000e1a, transparent: true, opacity: 0.9 }));
  inner.position.z = 0.26;
  group.add(inner);

  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 64), new THREE.MeshBasicMaterial({ color: 0x0066aa, transparent: true, opacity: 0.12 }));
  glow.position.z = 0.27;
  group.add(glow);

  return { group, layers };
}

function buildTunnel(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const z = -i * 1.4;
    const r = 0.48 + Math.sin(i * 0.45) * 0.1;
    const t = i / 24;
    const col = new THREE.Color().setHSL(0.58 + t * 0.06, 0.85, 0.18 + t * 0.12);
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.007, 8, 96),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 - t * 0.1 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z;
    g.add(mesh);

    // Data lines radiating inward
    if (i % 3 === 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, z, r * Math.cos(i), r * Math.sin(i), z], 3));
      g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.25 })));
    }
  }

  const partGeo = new THREE.BufferGeometry();
  const pc = 700;
  const pp = new Float32Array(pc * 3);
  for (let i = 0; i < pc; i++) {
    const a = Math.random() * Math.PI * 2, d = -Math.random() * 33, sp = 0.22 + Math.random() * 0.32;
    pp[i * 3] = Math.cos(a) * sp; pp[i * 3 + 1] = Math.sin(a) * sp; pp[i * 3 + 2] = d;
  }
  partGeo.setAttribute("position", new THREE.Float32BufferAttribute(pp, 3));
  g.add(new THREE.Points(partGeo, new THREE.PointsMaterial({ color: 0x00ddff, size: 0.03, transparent: true, opacity: 0.75 })));
  return g;
}

function buildFabric(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(7, 7, 80, 80);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLightSweep: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vNorm;
      uniform float uTime;
      void main() {
        vUv = uv; vNorm = normal;
        vec3 p = position;
        p.z += sin(p.x * 9.0 + uTime * 0.8) * 0.015 + sin(p.y * 9.0 + uTime * 0.6) * 0.015;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vNorm;
      uniform float uTime; uniform float uLightSweep;
      void main() {
        vec2 uv = vUv * 44.0;
        float gx = mod(uv.x, 1.0), gy = mod(uv.y, 1.0);
        float fx = smoothstep(0.42, 0.5, gx) * (1.0 - smoothstep(0.5, 0.58, gx));
        float fy = smoothstep(0.42, 0.5, gy) * (1.0 - smoothstep(0.5, 0.58, gy));
        float f = max(fx, fy);
        vec3 base = vec3(0.13, 0.02, 0.02);
        vec3 fiber = vec3(0.27, 0.06, 0.07);
        vec3 col = mix(base, fiber, f);
        float sweep = sin(vUv.x * 6.28 - uLightSweep * 2.2) * 0.5 + 0.5;
        col += vec3(0.08, 0.01, 0.01) * sweep * smoothstep(0.0, 0.3, sweep);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -0.12;
  return m;
}

function buildWebPattern(): THREE.Group {
  const g = new THREE.Group();
  const radials = 20, rings = 10, outer = 3.2, inner = 0.1;
  const buf: number[] = [];
  for (let i = 0; i < radials; i++) {
    const a = (i / radials) * Math.PI * 2;
    buf.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * outer, 0, Math.sin(a) * outer);
  }
  for (let j = 1; j <= rings; j++) {
    const r = inner + (j / rings) * (outer - inner);
    for (let i = 0; i < radials; i++) {
      const a1 = (i / radials) * Math.PI * 2, a2 = ((i + 1) / radials) * Math.PI * 2;
      buf.push(Math.cos(a1)*r, 0, Math.sin(a1)*r, Math.cos(a2)*r, 0, Math.sin(a2)*r);
    }
  }
  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute("position", new THREE.Float32BufferAttribute(buf, 3));
  g.add(new THREE.LineSegments(webGeo, new THREE.LineBasicMaterial({ color: 0xcc1122, transparent: true, opacity: 0.9 })));

  // Animated pulse ring
  const pGeo = new THREE.TorusGeometry(0.01, 0.005, 8, 32);
  const pMesh = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xff4466 }));
  pMesh.rotation.x = Math.PI / 2;
  pMesh.name = "webPulse";
  g.add(pMesh);
  return g;
}

function buildAISphere(): { group: THREE.Group; nodes: THREE.Mesh[] } {
  const g = new THREE.Group();
  const nodes: THREE.Mesh[] = [];

  const icoGeo = new THREE.IcosahedronGeometry(1.5, 3);
  const edgesGeo = new THREE.EdgesGeometry(icoGeo);
  g.add(new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color: 0x003344, transparent: true, opacity: 0.3 })));
  g.add(new THREE.Points(icoGeo, new THREE.PointsMaterial({ color: 0x00ccff, size: 0.045, transparent: true, opacity: 0.9 })));

  const outerEdges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.4, 2));
  g.add(new THREE.LineSegments(outerEdges, new THREE.LineBasicMaterial({ color: 0x001a22, transparent: true, opacity: 0.18 })));

  const nodeDefs = [
    { pos: [1.5, 0, 0], label: "ENV" }, { pos: [-1.5, 0, 0], label: "MOTION" },
    { pos: [0, 1.5, 0], label: "TARGET" }, { pos: [0, -1.5, 0], label: "STATUS" },
    { pos: [0, 0, 1.5], label: "HUD" }, { pos: [0, 0, -1.5], label: "SYNC" },
  ];
  nodeDefs.forEach(({ pos }) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    node.position.set(pos[0], pos[1], pos[2]);
    g.add(node);
    nodes.push(node);
  });

  // Data streams (animated lines between nodes)
  for (let i = 0; i < 8; i++) {
    const a1 = Math.random() * Math.PI * 2, a2 = Math.random() * Math.PI;
    const x1 = 1.5 * Math.sin(a2) * Math.cos(a1), y1 = 1.5 * Math.cos(a2), z1 = 1.5 * Math.sin(a2) * Math.sin(a1);
    const a3 = a1 + Math.PI * (0.3 + Math.random()), a4 = a2 + 0.5;
    const x2 = 1.5 * Math.sin(a4) * Math.cos(a3), y2 = 1.5 * Math.cos(a4), z2 = 1.5 * Math.sin(a4) * Math.sin(a3);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.Float32BufferAttribute([x1, y1, z1, x2, y2, z2], 3));
    const lMat = new THREE.LineBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0 });
    const line = new THREE.LineSegments(lGeo, lMat);
    line.name = `stream_${i}`;
    g.add(line);
  }

  // Core
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), new THREE.MeshBasicMaterial({ color: 0x00ffff })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.12 })));

  return { group: g, nodes };
}

function buildSpiderEmblem(): THREE.Group {
  const g = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.save(); ctx.translate(256, 185); ctx.scale(1.0, 1.3);
  ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(256, 318); ctx.scale(1.25, 1.05);
  ctx.beginPath(); ctx.arc(0, 0, 74, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.lineWidth = 15; ctx.lineCap = "round"; ctx.strokeStyle = "#ffffff";
  const legs = [
    [[256,200],[155,138],[80,82]], [[256,210],[178,162],[108,136]],
    [[256,224],[170,210],[95,210]], [[256,238],[172,268],[100,280]],
    [[256,200],[357,138],[432,82]], [[256,210],[334,162],[404,136]],
    [[256,224],[342,210],[417,210]], [[256,238],[340,268],[412,280]],
  ];
  legs.forEach(pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  const emblem = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.0),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08 })
  );
  g.add(emblem);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.014, 8, 80), new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.7 })));
  return g;
}

function generateSuitParticles(count: number, variant: number): Float32Array {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const rng = Math.random();
    if (rng < 0.14) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
      p[i*3] = Math.sin(ph)*Math.cos(th)*0.24; p[i*3+1] = 1.95 + Math.sin(ph)*Math.sin(th)*0.24*1.2; p[i*3+2] = Math.cos(ph)*0.24*0.9;
    } else if (rng < 0.48) {
      p[i*3] = (Math.random()-0.5)*0.72*(1+variant*0.1); p[i*3+1] = 0.62+Math.random()*1.05; p[i*3+2] = (Math.random()-0.5)*0.62;
    } else if (rng < 0.68) {
      const side = Math.random() > 0.5 ? 1 : -1;
      p[i*3] = side*(0.46+Math.random()*0.22); p[i*3+1] = 0.75+Math.random()*0.95; p[i*3+2] = (Math.random()-0.5)*0.28;
    } else {
      const side = Math.random() > 0.5 ? 1 : -1;
      p[i*3] = side*(0.13+Math.random()*0.12); p[i*3+1] = -0.95+Math.random()*1.55; p[i*3+2] = (Math.random()-0.5)*0.28;
    }
    if (variant === 2) { p[i*3] *= 1.08; p[i*3+2] += Math.random()*0.15; }
  }
  return p;
}

function buildMorphParticles(count: number): THREE.Points {
  const posA = generateSuitParticles(count, 1);
  const posB = generateSuitParticles(count, 2);
  const posC = generateSuitParticles(count, 0);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posA.slice(), 3));
  geo.setAttribute("posB", new THREE.BufferAttribute(posB, 3));
  geo.setAttribute("posC", new THREE.BufferAttribute(posC, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uPhase: { value: 0 }, uColor: { value: new THREE.Color(0xcc1122) } },
    vertexShader: `
      attribute vec3 posB; attribute vec3 posC;
      uniform float uProgress; uniform float uPhase;
      void main() {
        float pi = 3.14159;
        float explode = sin(clamp(uProgress, 0.0, 1.0) * pi) * 1.8;
        vec3 a = (uPhase < 0.5) ? position : posB;
        vec3 b = (uPhase < 0.5) ? posB : posC;
        vec3 dir = normalize(a + vec3(0.001));
        vec3 pos = mix(a, b, uProgress) + dir * explode;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = 3.5 * (180.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float a = 1.0 - d * 2.0;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

function buildSuit(colorHex: number, accent: number, goldAccent?: boolean): THREE.Group {
  const g = new THREE.Group();
  const webTex = buildWebPatternTexture(6, 384);
  webTex.repeat.set(4, 4);
  const mk = (c: number, em?: number) => new THREE.MeshStandardMaterial({
    color: c, roughness: goldAccent ? 0.16 : 0.42, metalness: goldAccent ? 0.92 : 0.5,
    emissive: em ?? 0, emissiveIntensity: em ? 0.25 : 0,
    map: webTex, bumpMap: webTex, bumpScale: 0.018,
  });
  const accentMat = mk(accent);
  const bodyMat = mk(colorHex);
  const jointMat = mk(accent);

  // Head
  const headGeo = new THREE.SphereGeometry(0.23, 32, 28);
  taperJaw(headGeo, -0.05, 0.4);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.scale.set(1, 1.18, 0.9);
  head.position.set(0, 2.0, 0);
  g.add(head);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.1, 4, 12), bodyMat);
  neck.position.set(0, 1.78, 0);
  g.add(neck);

  // Torso: lathe-turned profile for a chest-to-waist taper instead of a plain cylinder
  const chestPts = [
    [0.30, 0.72], [0.36, 0.90], [0.405, 1.10], [0.40, 1.32], [0.33, 1.52], [0.21, 1.68],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const chest = new THREE.Mesh(new THREE.LatheGeometry(chestPts, 32), bodyMat);
  g.add(chest);

  const hipPts = [
    [0.24, 0.36], [0.30, 0.48], [0.335, 0.60], [0.31, 0.74],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const hips = new THREE.Mesh(new THREE.LatheGeometry(hipPts, 32), accentMat);
  g.add(hips);

  [-1, 1].forEach((side) => {
    // Shoulder joint
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 14), jointMat);
    shoulder.position.set(side * 0.44, 1.50, 0);
    g.add(shoulder);

    const uArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.36, 4, 12), accentMat);
    uArm.position.set(side * 0.55, 1.22, 0.03);
    uArm.rotation.z = side * 0.22;
    uArm.rotation.x = 0.10;
    g.add(uArm);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), bodyMat);
    elbow.position.set(side * 0.63, 0.90, 0.10);
    g.add(elbow);

    const lArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.36, 4, 12), bodyMat);
    lArm.position.set(side * 0.68, 0.62, 0.20);
    lArm.rotation.z = side * 0.30;
    lArm.rotation.x = -0.55;
    g.add(lArm);

    // Hip joint
    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 14), accentMat);
    hip.position.set(side * 0.19, 0.42, 0);
    g.add(hip);

    const uLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.52, 4, 14), accentMat);
    uLeg.position.set(side * 0.20, 0.06, 0);
    uLeg.rotation.x = 0.05;
    g.add(uLeg);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 12), bodyMat);
    knee.position.set(side * 0.21, -0.42, 0.01);
    g.add(knee);

    const lLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.50, 4, 14), bodyMat);
    lLeg.position.set(side * 0.21, -0.78, 0.03);
    lLeg.rotation.x = -0.06;
    g.add(lLeg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.32), bodyMat);
    foot.position.set(side * 0.21, -1.06, 0.09);
    g.add(foot);
  });

  // Spider emblem on chest
  const ec = document.createElement("canvas"); ec.width = 128; ec.height = 128;
  const ectx = ec.getContext("2d")!;
  ectx.fillStyle = "white";
  ectx.save(); ectx.translate(64, 46); ectx.scale(0.75, 1.0);
  ectx.beginPath(); ectx.arc(0, 0, 20, 0, Math.PI*2); ectx.fill(); ectx.restore();
  ectx.save(); ectx.translate(64, 82); ectx.scale(0.85, 0.75);
  ectx.beginPath(); ectx.arc(0, 0, 28, 0, Math.PI*2); ectx.fill(); ectx.restore();
  const eM = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ec), transparent: true, alphaTest: 0.1 })
  );
  eM.position.set(0, 1.12, 0.36);
  g.add(eM);

  return g;
}

function buildIronSpiderArms(): THREE.Group {
  const g = new THREE.Group();
  const armDefs = [
    { startAngle: 0.8, swing: 1.2, yStart: 0.4, downSwing: -1.4 },
    { startAngle: -0.8, swing: -1.2, yStart: 0.4, downSwing: -1.4 },
    { startAngle: 0.4, swing: 1.0, yStart: 0.0, downSwing: -1.0 },
    { startAngle: -0.4, swing: -1.0, yStart: 0.0, downSwing: -1.0 },
  ];
  armDefs.forEach(({ startAngle, swing, yStart, downSwing }, idx) => {
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j < 12; j++) {
      const t = j / 11;
      const angle = startAngle + swing * t;
      const r = 0.35 + t * 2.0;
      pts.push(new THREE.Vector3(
        Math.sin(angle) * r,
        yStart + downSwing * t * 0.8,
        -Math.cos(angle * 0.4) * r * 0.5
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 22, 0.042, 8, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.96, roughness: 0.06, emissive: 0x221100, emissiveIntensity: 0.2 });
    const arm = new THREE.Mesh(geo, mat);
    arm.name = `arm_${idx}`;
    g.add(arm);
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 8), mat.clone());
    claw.position.copy(pts[pts.length - 1]);
    claw.rotation.z = Math.PI / 2;
    g.add(claw);
  });
  return g;
}

function buildOrbitObjects(): THREE.Group {
  const g = new THREE.Group();
  const items = [
    { type: "mask",   r: 3.6, spd:  0.14, yOff:  0.5, phase: 0.0,  fadeT: 0.975 },
    { type: "web",    r: 2.9, spd: -0.19, yOff: -0.4, phase: 2.1,  fadeT: 0.982 },
    { type: "ai",     r: 4.1, spd:  0.11, yOff:  0.2, phase: 4.2,  fadeT: 0.970 },
    { type: "lens",   r: 3.2, spd: -0.16, yOff:  0.8, phase: 1.0,  fadeT: 0.988 },
    { type: "emblem", r: 2.5, spd:  0.21, yOff: -0.7, phase: 3.1,  fadeT: 0.994 },
  ];

  items.forEach(({ type, r, spd, yOff, phase, fadeT }) => {
    const pivot = new THREE.Group();
    pivot.userData = { orbitR: r, orbitSpd: spd, yOff, phase, fadeT };

    let child: THREE.Object3D;
    if (type === "mask") {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 20), new THREE.MeshStandardMaterial({ color: 0x880011, metalness: 0.8, roughness: 0.2 }));
      m.scale.set(1, 1.2, 0.9); child = m;
    } else if (type === "ai") {
      child = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 2), new THREE.MeshBasicMaterial({ color: 0x004466, wireframe: true, transparent: true, opacity: 0.6 }));
    } else if (type === "lens") {
      const lg = new THREE.Group();
      [0.3, 0.24, 0.18].forEach((lr, i) => {
        const lm = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, 0.04, 32), new THREE.MeshPhysicalMaterial({ color: 0x88aacc, transparent: true, opacity: 0.3 }));
        lm.rotation.x = Math.PI/2; lm.position.z = i * 0.06;
        lg.add(lm);
      });
      child = lg;
    } else if (type === "web") {
      const wbuf: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        wbuf.push(0, 0, 0, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
      }
      for (let j = 1; j <= 3; j++) {
        const wr = j * 0.17;
        for (let i = 0; i < 8; i++) {
          const a1 = (i/8)*Math.PI*2, a2 = ((i+1)/8)*Math.PI*2;
          wbuf.push(Math.cos(a1)*wr, 0, Math.sin(a1)*wr, Math.cos(a2)*wr, 0, Math.sin(a2)*wr);
        }
      }
      const wgeo = new THREE.BufferGeometry();
      wgeo.setAttribute("position", new THREE.Float32BufferAttribute(wbuf, 3));
      child = new THREE.LineSegments(wgeo, new THREE.LineBasicMaterial({ color: 0xcc1122, transparent: true, opacity: 0.9 }));
    } else {
      child = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    }
    pivot.add(child);
    g.add(pivot);
  });
  return g;
}

function buildBgParticles(): THREE.Points {
  const n = 1600;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i*3] = (Math.random()-0.5)*40; p[i*3+1] = (Math.random()-0.5)*24; p[i*3+2] = (Math.random()-0.5)*40;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x223344, size: 0.022, transparent: true, opacity: 0.45 }));
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  scrollProgress: number;
  mousePos: { x: number; y: number };
  onSceneChange: (s: number) => void;
  onHoveredSuit: (i: number) => void;
  isLoaded: boolean;
}

export default function SpiderScene({ scrollProgress, mousePos, onSceneChange, onHoveredSuit, isLoaded }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const loadedRef = useRef(false);
  const lensExplRef = useRef(0);   // 0=assembled, 1=exploded
  const lensExplTgt = useRef(0);
  const hovSuitRef = useRef(-1);

  useEffect(() => { scrollRef.current = scrollProgress; }, [scrollProgress]);
  useEffect(() => { mouseRef.current = mousePos; }, [mousePos]);
  useEffect(() => { loadedRef.current = isLoaded; }, [isLoaded]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050505);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.025);

    const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.01, 150);
    camera.position.set(0, 0.15, 7.5);

    // ── Post-processing ──
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.55, 0.72);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ── Raycaster ──
    const raycaster = new THREE.Raycaster();

    // ── Lights ──
    scene.add(new THREE.AmbientLight(0x0a0a1c, 1.1));
    const redL = new THREE.PointLight(0xff1828, 10, 18);
    redL.position.set(4, 1, 3); scene.add(redL);
    const blueL = new THREE.PointLight(0x1228ff, 10, 18);
    blueL.position.set(-4, 1, 3); scene.add(blueL);
    const topL = new THREE.DirectionalLight(0xffffff, 0.45);
    topL.position.set(0, 8, 5); scene.add(topL);
    const frontL = new THREE.PointLight(0xffffff, 1.2, 22);
    frontL.position.set(0, 0, 9);
    scene.add(frontL);

    // ── Build objects ──
    const { group: maskGroup, eyeL, eyeR } = buildMask();
    scene.add(maskGroup);

    const { group: lensGroup, layers: lensLayers } = buildLens();
    lensGroup.position.set(0.40, 0.28 * 1.22, 0.85 * 0.90 + 0.06);
    lensGroup.visible = false;
    scene.add(lensGroup);

    const tunnel = buildTunnel();
    tunnel.position.set(0.40, 0.28 * 1.22, 0.85 * 0.90 + 0.2);
    tunnel.visible = false;
    scene.add(tunnel);

    const fabric = buildFabric();
    fabric.visible = false;
    scene.add(fabric);

    const webPat = buildWebPattern();
    webPat.visible = false;
    scene.add(webPat);

    const { group: aiGroup, nodes: aiNodes } = buildAISphere();
    aiGroup.visible = false;
    scene.add(aiGroup);

    const emblemGroup = buildSpiderEmblem();
    emblemGroup.visible = false;
    emblemGroup.position.set(0, -0.3, 0);
    scene.add(emblemGroup);

    // Suits
    const SUIT_DEFS = [
      { color: 0x880012, accent: 0x112299 },
      { color: 0xcc1111, accent: 0x2211bb },
      { color: 0x880012, accent: 0x997700, gold: true },
      { color: 0x080808, accent: 0x770011 },
      { color: 0x040412, accent: 0x003344 },
    ];
    const suitsGroup = new THREE.Group();
    const suitMeshes: THREE.Group[] = [];
    SUIT_DEFS.forEach(({ color, accent, gold }, i) => {
      const s = buildSuit(color, accent, gold);
      s.position.x = (i - 2) * 2.8;
      suitsGroup.add(s);
      suitMeshes.push(s);
    });
    suitsGroup.visible = false;
    scene.add(suitsGroup);

    // Iron Spider arms
    const ironArms = buildIronSpiderArms();
    ironArms.visible = false;
    ironArms.position.set(0, 0, -0.5);
    scene.add(ironArms);

    // Morph particles
    const morphPts = buildMorphParticles(2000);
    morphPts.visible = false;
    scene.add(morphPts);

    // Orbit objects (final scene)
    const orbitGroup = buildOrbitObjects();
    orbitGroup.visible = false;
    scene.add(orbitGroup);

    const bgParts = buildBgParticles();
    scene.add(bgParts);

    // ── Smooth camera ──
    const camPos = new THREE.Vector3(0, 0.15, 7.5);
    const camTgt = new THREE.Vector3();
    let lastScene = -1;

    // ── Lens explosion state ──
    const LENS_EXPLODE_OFFSETS = [0.36, 0.22, 0.08, -0.08, -0.22];

    // ── Click handler for lens explosion ──
    const onClick = (e: MouseEvent) => {
      if (!lensGroup.visible) return;
      const mx = (e.clientX / window.innerWidth) * 2 - 1;
      const my = -((e.clientY / window.innerHeight) * 2 - 1);
      raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
      const hits = raycaster.intersectObjects(lensGroup.children, true);
      if (hits.length > 0) {
        lensExplTgt.current = lensExplTgt.current > 0.5 ? 0 : 1;
      }
    };
    window.addEventListener("click", onClick);

    // ── Animation ──
    let time = 0, animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.016;

      if (!loadedRef.current) { renderer.clear(); return; }

      const t = scrollRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Camera
      const cs = getCam(t);
      const cpt = new THREE.Vector3(cs.px + (mx - 0.5) * 0.1, cs.py - (my - 0.5) * 0.06, cs.pz);
      const clt = new THREE.Vector3(cs.lx, cs.ly, cs.lz);
      camPos.lerp(cpt, 0.05);
      camTgt.lerp(clt, 0.05);
      camera.position.copy(camPos);
      camera.lookAt(camTgt);

      // Scene detection
      const sc = sceneFromT(t);
      if (sc !== lastScene) { lastScene = sc; onSceneChange(sc); }

      // ── Mask ──
      const mA = fadeAlpha(t, 0, 0.02, 0.04, 0.27) +
                 fadeAlpha(t, 0.62, 0.04, 0.03, 0.82) +
                 fadeAlpha(t, 0.96, 0.02, 0.02, 1.01);
      maskGroup.visible = mA > 0.001;
      if (maskGroup.visible) {
        maskGroup.rotation.y = Math.sin(time * 0.18) * 0.08 + t * 0.6;
        maskGroup.rotation.x = (my - 0.5) * 0.05 + Math.sin(time * 0.14) * 0.02;
        maskGroup.rotation.z = (mx - 0.5) * 0.025;
        // Eye glow pulse
        const eyeMat = eyeL.material as THREE.MeshPhysicalMaterial;
        eyeMat.emissiveIntensity = 0.7 + Math.sin(time * 1.2) * 0.15;
        (eyeR.material as THREE.MeshPhysicalMaterial).emissiveIntensity = eyeMat.emissiveIntensity;
        // Eye follow mouse subtly
        const eyeFollowX = (mx - 0.5) * 0.03;
        const eyeFollowY = (my - 0.5) * -0.02;
        eyeL.rotation.y = -0.25 + eyeFollowX;
        eyeL.rotation.x = 0.08 + eyeFollowY;
        eyeR.rotation.y = 0.25 + eyeFollowX;
        eyeR.rotation.x = 0.08 + eyeFollowY;
      }

      // ── Lens explosion animation ──
      lensExplRef.current = lerp(lensExplRef.current, lensExplTgt.current, 0.06);
      const lA = fadeAlpha(t, 0.10, 0.04, 0.04, 0.36);
      lensGroup.visible = lA > 0.001;
      if (lensGroup.visible) {
        lensLayers.forEach((layer, i) => {
          const explZ = layer.baseZ + LENS_EXPLODE_OFFSETS[i] * lensExplRef.current;
          layer.mesh.position.z = lerp(layer.mesh.position.z, explZ, 0.08);
          layer.rim.position.z = layer.mesh.position.z;
          (layer.mesh.material as THREE.MeshPhysicalMaterial).opacity = lA * 0.3;
        });
        lensGroup.rotation.z = time * 0.25;
        // Eye-follow subtle tilt
        const tiltX = (mx - 0.5) * 0.06;
        const tiltY = (my - 0.5) * -0.04;
        lensGroup.rotation.x = lerp(lensGroup.rotation.x, tiltY, 0.08);
        lensGroup.position.set(0.40 + tiltX, 0.28 * 1.22, 0.85 * 0.90 + 0.06);
      }

      // ── Tunnel ──
      const tnA = fadeAlpha(t, 0.22, 0.04, 0.04, 0.36);
      tunnel.visible = tnA > 0.001;
      if (tunnel.visible) { tunnel.rotation.z = time * 0.45; }

      // ── Fabric ──
      const fabA = fadeAlpha(t, 0.33, 0.05, 0.05, 0.50);
      fabric.visible = fabA > 0.001;
      if (fabric.visible) {
        const mat = fabric.material as THREE.ShaderMaterial;
        mat.uniforms.uTime.value = time;
        mat.uniforms.uLightSweep.value = time;
      }

      // ── Web pattern ──
      const webA = fadeAlpha(t, 0.46, 0.04, 0.04, 0.57);
      webPat.visible = webA > 0.001;
      if (webPat.visible) {
        const rise = ss(0.46, 0.53, t);
        webPat.scale.y = lerp(0.01, 1, rise);
        webPat.rotation.y = time * 0.1;
        const pulse = webPat.getObjectByName("webPulse") as THREE.Mesh;
        if (pulse) {
          const r = (time % 4) / 4 * 3.2;
          pulse.geometry = new THREE.TorusGeometry(r, 0.006, 8, 64);
          pulse.rotation.x = Math.PI / 2;
          (pulse.material as THREE.MeshBasicMaterial).opacity = (1 - (time % 4) / 4) * webA;
        }
      }

      // ── AI sphere ──
      const aiA = fadeAlpha(t, 0.54, 0.05, 0.04, 0.68);
      aiGroup.visible = aiA > 0.001;
      if (aiGroup.visible) {
        aiGroup.rotation.y = time * 0.2;
        aiGroup.rotation.x = Math.sin(time * 0.13) * 0.18;
        aiGroup.scale.setScalar(lerp(0.1, 1, ss(0.54, 0.62, t)));
        // Data stream flicker
        aiGroup.children.forEach(c => {
          if (c.name.startsWith("stream_")) {
            const i = parseInt(c.name.split("_")[1]);
            const phase = (time + i * 0.7) % 3;
            ((c as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = phase < 1.5 ? phase / 1.5 * 0.5 : (3 - phase) / 1.5 * 0.5;
          }
        });
      }

      // ── Spider emblem ──
      const emA = fadeAlpha(t, 0.68, 0.04, 0.04, 0.82);
      emblemGroup.visible = emA > 0.001;
      if (emblemGroup.visible) {
        const form = ss(0.68, 0.76, t);
        emblemGroup.scale.setScalar(lerp(0.05, 1.7, easeIO(form)));
        emblemGroup.rotation.y = Math.sin(time * 0.22) * 0.18;
        emblemGroup.rotation.z = time * 0.04;
        emblemGroup.position.y = lerp(-2.5, -0.3, easeIO(form));
      }

      // ── Suits ──
      const suitsA = fadeAlpha(t, 0.80, 0.04, 0.04, 0.97);
      suitsGroup.visible = suitsA > 0.001;
      if (suitsGroup.visible) {
        suitsGroup.rotation.y = Math.sin(time * 0.12) * 0.04 + (mx - 0.5) * 0.10;

        // Raycasting for hover
        raycaster.setFromCamera(new THREE.Vector2((mx - 0.5) * 2, -(my - 0.5) * 2), camera);
        const suitChildren = suitMeshes.flatMap(s => s.children.filter(c => c instanceof THREE.Mesh) as THREE.Mesh[]);
        const hits = raycaster.intersectObjects(suitChildren, false);
        let newHov = -1;
        if (hits.length > 0) {
          const hitObj = hits[0].object;
          newHov = suitMeshes.findIndex(s => s.children.includes(hitObj));
        }
        if (newHov !== hovSuitRef.current) {
          hovSuitRef.current = newHov;
          onHoveredSuit(newHov);
        }

        suitMeshes.forEach((s, i) => {
          const delay = i * 0.022;
          const appear = ss(0.80 + delay, 0.845 + delay, t);
          s.scale.setScalar(lerp(0.4, 1, easeIO(appear)));
          const isHov = i === hovSuitRef.current;
          s.rotation.y = Math.sin(time * 0.18 + i * 0.9) * 0.05 + (isHov ? Math.sin(time * 0.5) * 0.08 : 0);
          s.children.forEach(c => {
            if (c instanceof THREE.Mesh) {
              const m = c.material as THREE.MeshStandardMaterial;
              if (!m.transparent) m.transparent = true;
              m.opacity = lerp(0, 1, easeIO(appear));
              m.emissiveIntensity = isHov ? Math.min((m.emissiveIntensity ?? 0) + 0.02, 0.5) : Math.max((m.emissiveIntensity ?? 0) - 0.01, 0.0);
            }
          });
        });
      }

      // ── Iron Spider arms ──
      const ironA = fadeAlpha(t, 0.91, 0.02, 0.02, 0.95);
      ironArms.visible = ironA > 0.001;
      if (ironA > 0) {
        ironArms.children.forEach((c, i) => {
          if (c instanceof THREE.Mesh && c.name.startsWith("arm_")) {
            c.rotation.y = Math.sin(time * 0.6 + i * 0.8) * 0.1;
          }
        });
        ironArms.scale.setScalar(lerp(0, 1, ss(0.91, 0.935, t)));
      }

      // ── Morph particles ──
      const morphPhaseAB = fadeAlpha(t, 0.905, 0.005, 0.005, 0.935);
      const morphPhaseBC = fadeAlpha(t, 0.935, 0.005, 0.005, 0.960);
      const morphActive = morphPhaseAB + morphPhaseBC;
      morphPts.visible = morphActive > 0.001;
      if (morphActive > 0) {
        const mat = morphPts.material as THREE.ShaderMaterial;
        if (morphPhaseAB > 0) {
          mat.uniforms.uPhase.value = 0;
          mat.uniforms.uProgress.value = ss(0.905, 0.935, t);
          mat.uniforms.uColor.value.setHex(0xcc1122);
        } else {
          mat.uniforms.uPhase.value = 1;
          mat.uniforms.uProgress.value = ss(0.935, 0.960, t);
          mat.uniforms.uColor.value.setHex(0xff3311);
        }
        mat.opacity = morphActive;
      }

      // ── Orbit final scene ──
      const orbitA = fadeAlpha(t, 0.96, 0.02, 0.02, 1.01);
      orbitGroup.visible = orbitA > 0.001;
      if (orbitA > 0) {
        orbitGroup.children.forEach((pivot) => {
          const { orbitR, orbitSpd, yOff, phase, fadeT } = pivot.userData;
          pivot.position.x = Math.cos(time * orbitSpd + phase) * orbitR;
          pivot.position.z = Math.sin(time * orbitSpd + phase) * orbitR;
          pivot.position.y = yOff + Math.sin(time * 0.28 + phase) * 0.25;
          pivot.rotation.y = time * 0.4;
          const itemAlpha = orbitA * (1 - ss(fadeT, fadeT + 0.012, t));
          pivot.children.forEach(c => {
            if (c instanceof THREE.Mesh || c instanceof THREE.LineSegments) {
              (c.material as THREE.Material & { opacity?: number }).opacity = itemAlpha;
              if (c.material) (c.material as THREE.Material & { transparent: boolean }).transparent = true;
            }
          });
        });
      }

      // ── Lights animation ──
      const la = time * 0.28;
      redL.position.set(4.5 * Math.cos(la), 1.2 + Math.sin(time * 0.38) * 0.5, 3.5 + Math.sin(la) * 2);
      blueL.position.set(-4.5 * Math.cos(la), 1.2 + Math.cos(time * 0.38) * 0.5, 3.5 - Math.sin(la) * 2);

      // ── Background ──
      bgParts.rotation.y = time * 0.004;
      bgParts.rotation.x = time * 0.002;

      composer.render();
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      bloom.resolution.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", onClick);
      renderer.dispose();
      composer.dispose();
    };
  }, [onSceneChange, onHoveredSuit]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
