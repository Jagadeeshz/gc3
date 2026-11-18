'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * The ribbon hero.
 *
 * Six pods start folded into a ribbon that runs away from the camera, and unroll
 * into a 3×2 grid as the reader scrolls. The fold is a real 3D curve — the cards are
 * skinned onto it — so the ribbon turns, tips and recedes instead of sliding.
 *
 * Adapted from the Vante engine with three deliberate changes:
 *   · the cards are our six pods, drawn to canvas textures at runtime. The original
 *     streamed third-party mp4s from someone else's bucket; nothing should load
 *     from a host we do not control, and a capability card does not need video.
 *   · the palette is the site's, not the original near-black/lavender.
 *   · three lives in the bundle rather than behind a CDN import map, and the whole
 *     engine is skipped under reduced motion — the static grid renders instead, so
 *     a reader who has asked for stillness still gets every pod, every price.
 */

type Pod = {
  name: string;
  pool: string;
  composition: string;
  note: string;
};

const PODS: readonly Pod[] = [
  { name: 'Creative', pool: '120 credits', composition: '1 manager · 2 specialists · 2 agents', note: 'Brand systems, campaign visuals, production artwork' },
  { name: 'Growth', pool: '240 credits', composition: '1 manager · 4 specialists · 4 agents', note: 'Performance, lifecycle and the analytics behind them' },
  { name: 'Strategy', pool: '360 credits', composition: '1 manager · 6 specialists · 6 agents', note: 'Positioning, roadmaps and commercial models' },
  { name: 'Automation', pool: 'per credit', composition: 'Custom team, scoped per engagement', note: 'Process audits, internal tooling, the manual step' },
  { name: 'Interactive', pool: 'per credit', composition: 'Custom team, scoped per engagement', note: 'Product surfaces, prototypes, front-end builds' },
  { name: 'REMAU', pool: '240h / month', composition: 'Shared pod · 280h peak', note: 'Continuous capacity for work that never stops' },
];

const FACTS = 'ONE MANAGER · ONE POOL · UP TO THREE CLIENTS PER POD';

/** Draws one pod onto a canvas, in the site's own type and palette. */
function podTexture(THREE: typeof import('three'), pod: Pod, index: number) {
  const W = 1024;
  const H = 644;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return new THREE.Texture();

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#17161d');
  grad.addColorStop(1, '#0d0c11');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // gold rim
  g.strokeStyle = 'rgba(242,213,130,0.34)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);

  // the mark, top right: a quarter arc, the same geometry the brand uses
  g.strokeStyle = 'rgba(242,213,130,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(W - 130, 118, 58, Math.PI * 0.55, Math.PI * 1.62);
  g.stroke();

  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.beginPath();
  g.arc(W - 130, 118, 26, 0, Math.PI * 2);
  g.fill();

  // index
  g.fillStyle = '#c9911a';
  g.font = '700 34px Georgia, "Times New Roman", serif';
  g.fillText(String(index + 1).padStart(2, '0'), 56, 96);

  // name
  g.fillStyle = '#ffffff';
  g.font = '700 84px Georgia, "Times New Roman", serif';
  g.fillText(pod.name, 56, 208);

  // the one line about the outcome
  g.fillStyle = '#b9b8bb';
  g.font = '400 26px system-ui, -apple-system, Segoe UI, sans-serif';
  const words = pod.note.split(' ');
  let line = '';
  let y = 264;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > W - 120) {
      g.fillText(line, 56, y);
      line = w;
      y += 36;
    } else {
      line = test;
    }
  }
  if (line) g.fillText(line, 56, y);

  // pool
  g.fillStyle = '#f2d582';
  g.font = '500 30px "DM Mono", ui-monospace, monospace';
  g.fillText(pod.pool, 56, H - 108);

  // composition
  g.fillStyle = '#8d8b86';
  g.font = '400 22px "DM Mono", ui-monospace, monospace';
  g.fillText(pod.composition, 56, H - 62);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function RibbonHero() {
  const shell = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const l1 = useRef<HTMLDivElement | null>(null);
  const l2 = useRef<HTMLDivElement | null>(null);
  const cap = useRef<HTMLDivElement | null>(null);
  const rule = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const finale = useRef<HTMLDivElement | null>(null);
  const [staticMode, setStaticMode] = useState(false);

  useEffect(() => {
    // Cancel whatever sits above the band by measuring the band itself. Reading a
    // nav's height was wrong: the site nav is two stacked bars, and measuring the
    // first header left the stage 37px low, which pushed the footer off-screen.
    if (shell.current) {
      const top = shell.current.getBoundingClientRect().top + window.scrollY;
      shell.current.style.marginTop = `-${Math.round(top)}px`;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStaticMode(true);
      return;
    }

    let dead = false;
    let raf = 0;
    let dispose: (() => void) | undefined;

    (async () => {
      const THREE = await import('three');
      if (dead) return;

      const el = canvas.current;
      const stageEl = stage.current;
      const trackEl = track.current;
      if (!el || !stageEl || !trackEl) return;

      const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const FOV = 35;
      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

      // ---- the path the ribbon is skinned onto
      const SAMPLES = 1200;
      const pathP: import('three').Vector3[] = [];
      const pathT: import('three').Vector3[] = [];
      const PH0 = -1.5;
      const PH1 = Math.PI * 2 + 1.35;
      let path: import('three').CatmullRomCurve3;
      let PATH_L = 1;

      const span = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
      const mix = (a: number, b: number, t: number) => a + (b - a) * t;
      const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
      const ease = (t: number) => t * t * (3 - 2 * t);
      const out = (t: number) => 1 - (1 - t) ** 3;

      const buildPath = () => {
        const pts: import('three').Vector3[] = [];
        for (let i = 0; i <= 160; i++) {
          const t = i / 160;
          const ph = mix(PH0, PH1, t);
          const cs = Math.cos(ph);
          const u = 2 * t - 1;
          const depth = cs > 0 ? 7.6 + 16.4 * cs ** 0.9 : 7.6 + 2.2 * cs;
          const edge = 0.84 + 0.5 * span(0.14 - t, 0, 0.14) + 0.8 * span(t, 0.84, 1);
          pts.push(
            new THREE.Vector3(
              edge * Math.sin(ph) * depth * 0.561,
              0.5 * Math.sign(u) * Math.abs(u) ** 1.4 * depth * 0.63,
              -depth,
            ),
          );
        }
        path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        path.arcLengthDivisions = 1500;
        PATH_L = path.getLength();
        pathP.length = 0;
        pathT.length = 0;
        for (let i = 0; i <= SAMPLES; i++) {
          const u = i / SAMPLES;
          pathP.push(path.getPointAt(u));
          pathT.push(path.getTangentAt(u));
        }
      };

      const op = new THREE.Vector3();
      const ot = new THREE.Vector3();
      const up = new THREE.Vector3();
      const Y = new THREE.Vector3(0, 1, 0);
      const vp = new THREE.Vector3();
      const at = (s: number, p: import('three').Vector3, t: import('three').Vector3) => {
        const f = clamp01(s / PATH_L) * SAMPLES;
        const i = Math.min(SAMPLES - 1, Math.floor(f));
        const k = f - i;
        const pa = pathP[i];
        const pb = pathP[i + 1];
        const ta = pathT[i];
        const tb = pathT[i + 1];
        if (!pa || !pb || !ta || !tb) return;
        p.lerpVectors(pa, pb, k);
        t.lerpVectors(ta, tb, k).normalize();
      };

      // ---- cards
      const CARD_W = 2.1;
      const CARD_H = 1.32;
      const GAP = 0.03;
      const STEP = CARD_W + GAP;
      const NX = 28;
      const NY = 3;

      const vs = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
      const fs = `uniform sampler2D map;uniform float ready,radius,fade;varying vec2 vUv;
void main(){
  vec2 q=(abs(vUv-.5)-.5)*vec2(1.59,1.)+radius;
  float d=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
  float px=fwidth(d),a=1.-smoothstep(-px,px,d);
  if(a<.01)discard;
  vec3 c=texture2D(map,vUv).rgb;
  float edge=smoothstep(-.012-px,-.012,d);
  gl_FragColor=vec4(mix(c,vec3(1.),edge*.12),a*fade);
}`;

      const cards = PODS.map((pod, i) => {
        const tex = podTexture(THREE, pod, i);
        const geo = new THREE.PlaneGeometry(1, 1, NX, NY);
        const mat = new THREE.ShaderMaterial({
          vertexShader: vs,
          fragmentShader: fs,
          transparent: true,
          side: THREE.DoubleSide,
          uniforms: {
            map: { value: tex },
            ready: { value: 1 },
            radius: { value: 0.018 },
            fade: { value: 1 },
          },
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        scene.add(mesh);
        return { i, pod, tex, geo, mat, mesh, rect: null as null | { x: number; y: number; w: number; h: number; vw: number; vh: number; c: number; r: number } };
      });

      // ---- layout
      const GZ = 8;
      let W = 1;
      let H = 1;
      let asp = 1;
      let cols = 3;
      let rows = 2;
      let tanH = 0.3153;

      const resize = () => {
        W = window.innerWidth;
        H = window.innerHeight;
        asp = W / H;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H, false);
        camera.aspect = asp;
        camera.fov = asp < 16 / 9 ? (Math.atan(0.561 / asp) * 360) / Math.PI : FOV;
        camera.updateProjectionMatrix();
        tanH = Math.tan((camera.fov * Math.PI) / 360);
        cols = asp < 0.9 ? 2 : 3;
        rows = asp < 0.9 ? 3 : 2;
      };

      const grid = (i: number) => {
        const vh = 2 * GZ * tanH;
        const vw = vh * asp;
        const gw = vw * (cols === 3 ? 0.74 : 0.88);
        const gap = gw * 0.017;
        const cw = (gw - gap * (cols - 1)) / cols;
        const ch = cw / (CARD_W / CARD_H);
        const gh = ch * rows + gap * 1.6 * (rows - 1);
        const c = i % cols;
        const r = Math.floor(i / cols);
        return {
          x: -gw / 2 + cw / 2 + c * (cw + gap),
          y: gh / 2 - ch / 2 - r * (ch + gap * 1.6),
          w: cw,
          h: ch,
          vw,
          vh,
          c,
          r,
        };
      };

      // ---- scroll
      let target = 0;
      let p = 0;
      const readScroll = () => {
        const rect = trackEl.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        target = scrollable > 0 ? clamp01(-rect.top / scrollable) : 0;
      };

      const poseRibbon = (c: (typeof cards)[number], head: number) => {
        const pos = c.geo.attributes.position as import('three').BufferAttribute;
        const centre = head - c.i * STEP;
        for (let iy = 0; iy <= NY; iy++) {
          for (let ix = 0; ix <= NX; ix++) {
            const k = iy * (NX + 1) + ix;
            const lu = ix / NX - 0.5;
            const lv = 0.5 - iy / NY;
            at(centre + lu * CARD_W, op, ot);
            up.copy(Y).addScaledVector(ot, -Y.dot(ot)).normalize();
            vp.copy(op).addScaledVector(up, lv * CARD_H);
            pos.setXYZ(k, vp.x, vp.y, vp.z);
          }
        }
        pos.needsUpdate = true;
      };

      const poseGrid = (c: (typeof cards)[number], q: number) => {
        const g = grid(c.i);
        const pos = c.geo.attributes.position as import('three').BufferAttribute;
        const dx = (g.c - (cols - 1) / 2) * 1.2;
        const dy = g.r < rows / 2 ? 1 : -1;
        const ox = dx * g.vw * 0.62 * (1 - q);
        const oy = dy * g.vh * (g.c === 1 ? 0.95 : 0.34) * (1 - q);
        const tilt = (1 - q) * 0.22 * (g.c - 1 || 0.5) * dy;
        const cs = Math.cos(tilt);
        const sn = Math.sin(tilt);
        for (let iy = 0; iy <= NY; iy++) {
          for (let ix = 0; ix <= NX; ix++) {
            const k = iy * (NX + 1) + ix;
            const x = (ix / NX - 0.5) * g.w;
            const y = (0.5 - iy / NY) * g.h;
            pos.setXYZ(
              k,
              g.x + ox + x * cs - y * sn,
              g.y + oy + x * sn + y * cs,
              -GZ - (1 - q) * 0.6 * Math.sin((ix / NX) * Math.PI),
            );
          }
        }
        pos.needsUpdate = true;
        c.rect = g;
      };

      const RIB_A = 0.14;
      const RIB_B = 0.63;

      const render = () => {
        const pp = p;
        const rise = 1 - out(span(pp, 0, 0.12));
        const run = mix(0, 76, span(pp, 0.02, 0.58));
        if (l1.current) l1.current.style.transform = `translate3d(${run}vw,${rise * 10}vh,0)`;
        if (l2.current) l2.current.style.transform = `translate3d(${-run}vw,${rise * 10}vh,0)`;

        if (cap.current) {
          cap.current.style.opacity = String(1 - span(pp, 0.52, 0.57));
          cap.current.style.transform = `translate(-50%,calc(-50% + ${rise * 10}vh))`;
        }
        if (rule.current) rule.current.style.transform = `scaleX(${ease(span(pp, 0.72, 0.86))})`;

        // the ribbon dissolves as the finale arrives; the two never share the frame
        const dissolve = 1 - ease(span(pp, 0.6, 0.68));
        if (l1.current) l1.current.style.opacity = String(1 - span(pp, 0.52, 0.62));
        if (l2.current) l2.current.style.opacity = String(1 - span(pp, 0.52, 0.62));
        if (finale.current) {
          const fin = ease(span(pp, 0.66, 0.8));
          finale.current.style.opacity = String(fin);
          // the -50% is the centring, not decoration: dropping it pinned the block
          // to the 50% mark and pushed the headline off the right edge
          finale.current.style.transform = `translate3d(-50%, ${(1 - fin) * 28}px, 0)`;
          finale.current.style.pointerEvents = fin > 0.6 ? 'auto' : 'none';
        }

        const pr = span(pp, RIB_A, RIB_B);
        const head = mix(0, PATH_L + cards.length * STEP, pr);

        for (const c of cards) {
          const s = head - c.i * STEP;
          const end = PATH_L - CARD_W;
          // No 3x2 hand-off: the ribbon is allowed to run out and dissolve. The
          // grid it used to settle into repeated what the catalogue already says,
          // and it fought the story beat that closes the sequence.
          const running = s < head;
          c.mesh.visible = running && s > CARD_W - STEP;
          c.rect = null;
          if (c.mesh.visible) poseRibbon(c, head);
          c.mat.uniforms.fade!.value = dissolve;
        }

        renderer.render(scene, camera);
      };

      const loop = () => {
        p += (target - p) * 0.09;
        if (Math.abs(target - p) < 0.00005) p = target;
        render();
        raf = requestAnimationFrame(loop);
      };

      resize();
      buildPath();
      readScroll();
      window.addEventListener('resize', resize);
      window.addEventListener('scroll', readScroll, { passive: true });
      raf = requestAnimationFrame(loop);

      dispose = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('scroll', readScroll);
        for (const c of cards) {
          c.geo.dispose();
          c.mat.dispose();
          c.tex.dispose();
        }
        renderer.dispose();
      };
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      dispose?.();
    };
  }, []);

  if (staticMode) {
    return (
      <section className="border-b border-hairline bg-transparent py-20">
        <div className="shell">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
            Capability pods
          </p>
          <h1 className="mt-3 max-w-[24ch] font-display text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.03] tracking-[-0.03em] text-ghost">
            Your challenges. Our solutions.
          </h1>
          <p className="mt-5 max-w-[62ch] text-[14.5px] leading-[1.8] text-ghost-muted">
            Six pods, each a standing team on a published credit pool. One manager is accountable from the
            first request to the last invoice.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PODS.map((pod) => (
              <li key={pod.name} className="rounded-[14px] border border-hairline bg-obsidian-soft p-5">
                <p className="font-display text-[20px] text-ghost">{pod.name}</p>
                <p className="mt-1 font-mono text-[11px] text-[color:var(--color-gold-light)]">{pod.pool}</p>
                <p className="mt-2 text-[12.5px] leading-[1.6] text-ghost-muted">{pod.composition}</p>
              </li>
            ))}
          </ul>
          <Link href="/pricing" className="mt-8 inline-flex items-center gap-2 rounded-full btn-gold px-5 py-2.5 text-[13px] font-semibold">
            See published pricing
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section ref={shell} className="ribbon-hero">
      <div ref={track} className="ribbon-hero__track">
        <div ref={stage} className="ribbon-hero__stage">
          <div ref={l1} className="ribbon-hero__line ribbon-hero__line--1">
            <span>YOUR CHALLENGES</span>
          </div>
          <div ref={l2} className="ribbon-hero__line ribbon-hero__line--2">
            <span>OUR SOLUTIONS</span>
          </div>

          <div ref={cap} className="ribbon-hero__cap">
            Six pods. One pool. One named manager.
          </div>

          <div ref={rule} className="ribbon-hero__rule" />
          <canvas ref={canvas} className="ribbon-hero__canvas" />

          {/* The close: the ribbon has run out, and the band states what the
              company is rather than repeating the catalogue one screen early. */}
          <div ref={finale} className="ribbon-hero__finale">
            <p className="ribbon-hero__finale-eyebrow">Quantocos / global systems</p>
            <h2 className="ribbon-hero__finale-title">Intelligence, engineered at the edge.</h2>
            <p className="ribbon-hero__finale-body">
              Autonomous AI capability execution and multi-agent workflows built for enterprise scale.
            </p>
            <Link href="/pods" className="ribbon-hero__finale-cta">
              See the pods
            </Link>
          </div>

          <footer className="ribbon-hero__bot">
            <p>
              GC³ composes one standing team around one outcome and sells it on one subscription — a named
              manager, a defined roster, a published credit pool.
            </p>
            <div className="ribbon-hero__facts">{FACTS}</div>
            <Link href="/pods" className="ribbon-hero__more">
              See the pods
            </Link>
          </footer>
        </div>
      </div>
    </section>
  );
}
