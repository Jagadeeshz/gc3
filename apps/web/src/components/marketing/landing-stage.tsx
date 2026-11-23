'use client';

import { useEffect, useRef } from 'react';

/**
 * The landing stage.
 *
 * A three.js figure that stands behind three full-height sections and changes pose as
 * the reader scrolls: a wide shot in the intro, a close-up on the head in the product
 * section, and a close-up with a different face in the record section. The camera
 * blends between those states with the smoothed scroll, and follows the pointer by a
 * few degrees so the figure feels present rather than painted.
 *
 * Adapted from the reference build in three ways. The figure is a pod unit — chassis,
 * head, face ring — rather than a humanoid robot, because a robot says nothing about
 * what GC³ sells. The palette is the site's: dark ceramic, gold ring, gold screen. And
 * under reduced motion the whole scene is skipped in favour of a static figure, since a
 * continuous render loop is exactly what that preference is asking us not to run.
 */

const FIGURE_Y = 1.65;

const STATE = {
  // x parks the figure in the empty right-of-centre column, clear of the prompt box and
  // the headline. At the reference's 11.6 the unit filled the frame and sat on the copy.
  // lookX is where the camera aims, not where it stands: aiming left of the unit is what
  // puts the unit on the right of the frame. Offsetting the camera instead kept it centred.
  intro: { lookX: -0.32, z: 10.4, y: 0.72, lookY: 0.34, bodyYaw: -0.12, headYaw: -0.06, headPitch: 0.08, headRoll: 0.04 },
  product: { lookX: -0.26, z: 10.0, y: 0.78, lookY: 0.38, bodyYaw: -0.06, headYaw: 0.0, headPitch: 0.04, headRoll: 0 },
  record: { lookX: -0.85, z: 9.8, y: 0.84, lookY: 0.85, bodyYaw: 0.08, headYaw: 0.06, headPitch: 0.02, headRoll: -0.03 },
};

export function LandingStage() {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let dead = false;
    let raf = 0;
    let dispose: (() => void) | undefined;

    (async () => {
      const THREE = await import('three');
      const { RoundedBoxGeometry } = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
      const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
      if (dead) return;

      const el = canvas.current;
      if (!el) return;

      const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.9;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1f, 0.7));

      const key = new THREE.DirectionalLight(0xe9f0ff, 1.6);
      key.position.set(-3, 5, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.radius = 6;
      key.shadow.bias = -0.0005;
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x22d3ee, 1.1);
      rim.position.set(4, 2, -4);
      scene.add(rim);

      const fill = new THREE.PointLight(0xc9911a, 2.2, 6);
      fill.position.set(-3.2, 1.2, 0.6);
      scene.add(fill);

      // ---- materials
      const shell = new THREE.MeshPhysicalMaterial({ color: 0x232228, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.3 });
      const shellLight = new THREE.MeshPhysicalMaterial({ color: 0x2c2b33, roughness: 0.34, clearcoat: 0.45 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x14131a, roughness: 0.55, metalness: 0.3 });
      const pedestal = new THREE.MeshStandardMaterial({ color: 0x1b1a22, roughness: 0.85 });

      // the face ring: a conic canvas used as both map and emissive, on the prism stops
      const ringCanvas = document.createElement('canvas');
      ringCanvas.width = ringCanvas.height = 512;
      const rc = ringCanvas.getContext('2d');
      if (rc) {
        const g = rc.createConicGradient(3.49, 256, 256);
        g.addColorStop(0.0, '#8f6bff');
        g.addColorStop(0.18, '#4b2bff');
        g.addColorStop(0.34, '#0a7bff');
        g.addColorStop(0.5, '#22d3ee');
        g.addColorStop(0.66, '#00e1b4');
        g.addColorStop(0.82, '#4b2bff');
        g.addColorStop(1.0, '#8f6bff');
        rc.fillStyle = g;
        rc.fillRect(0, 0, 512, 512);
      }
      const ringTex = new THREE.CanvasTexture(ringCanvas);
      ringTex.colorSpace = THREE.SRGBColorSpace;
      const ringMat = new THREE.MeshPhysicalMaterial({
        map: ringTex,
        emissiveMap: ringTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.12,
        roughness: 0.5,
        clearcoat: 0.35,
      });

      // ---- face: canvas texture, eyes normally, a mark in the record section
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = faceCanvas.height = 512;
      const fx = faceCanvas.getContext('2d')!;
      let quote = false;
      let blink = 1;
      let blinkAt = 2.5 + Math.random() * 3;

      const drawFace = () => {
        fx.fillStyle = '#0b0b10';
        fx.fillRect(0, 0, 512, 512);
        fx.shadowColor = 'rgba(242,213,130,0.9)';
        fx.shadowBlur = 18;
        fx.fillStyle = '#f2d582';

        if (!quote) {
          const eye = (cx: number, cy: number) => {
            fx.beginPath();
            fx.ellipse(cx, cy, 30, 38 * blink, 0, 0, Math.PI * 2);
            fx.fill();
          };
          eye(196, 262);
          eye(316, 252);
        } else {
          fx.font = '700 300px Georgia, serif';
          fx.textAlign = 'center';
          fx.fillText('\u201c', 256, 420);
        }
      };
      drawFace();
      const faceTex = new THREE.CanvasTexture(faceCanvas);
      faceTex.colorSpace = THREE.SRGBColorSpace;

      const screenMat = new THREE.MeshPhysicalMaterial({
        color: 0x0b0b10,
        roughness: 0.15,
        clearcoat: 1,
        emissiveMap: faceTex,
        emissive: 0xffffff,
        emissiveIntensity: 1.6,
      });

      // ---- figure
      // Seated by a constant rather than by camera aim: the hero band is bounded by the nav
      // above and the facts strip below, and shifting this one number moves the whole figure
      // inside that box without re-deriving the camera.
      const figure = new THREE.Group();
      figure.position.y = FIGURE_Y;
      scene.add(figure);

      const ped = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.42, 2.0, 4, 0.06), pedestal);
      ped.position.y = -1.86;
      ped.receiveShadow = true;
      figure.add(ped);

      // a soft contact shadow, so the unit is standing on the plinth rather than near it
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.15, 48),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.645;
      figure.add(shadow);

      const body = new THREE.Group();
      figure.add(body);

      const torso = new THREE.Mesh(new RoundedBoxGeometry(1.42, 1.24, 1.0, 5, 0.24), shell);
      torso.position.y = -0.86;
      torso.castShadow = true;
      body.add(torso);

      const chest = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.26, 0.94, 4, 0.1), shellLight);
      chest.position.set(0, -0.44, 0.05);
      body.add(chest);

      // three indicators: the pods, in miniature
      [0x8f6bff, 0x22d3ee, 0x00e1b4].forEach((c, i) => {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.035, 12, 12),
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 }),
        );
        led.position.set(-0.15 + i * 0.15, -0.86, 0.455);
        body.add(led);
      });

      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.22, 16), dark);
      neck.position.y = -0.22;
      body.add(neck);

      const head = new THREE.Group();
      head.position.y = 0.56;
      body.add(head);

      const skull = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.2, 1.16, 6, 0.18), shell);
      skull.castShadow = true;
      head.add(skull);

      const back = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.96, 0.8, 4, 0.14), dark);
      back.position.z = -0.2;
      head.add(back);

      // the face ring, drawn as a frame
      const ringShape = new THREE.Shape();
      const rr = 0.12;
      const w = 0.62, h = 0.58;
      ringShape.moveTo(-w + rr, -h);
      ringShape.lineTo(w - rr, -h);
      ringShape.quadraticCurveTo(w, -h, w, -h + rr);
      ringShape.lineTo(w, h - rr);
      ringShape.quadraticCurveTo(w, h, w - rr, h);
      ringShape.lineTo(-w + rr, h);
      ringShape.quadraticCurveTo(-w, h, -w, h - rr);
      ringShape.lineTo(-w, -h + rr);
      ringShape.quadraticCurveTo(-w, -h, -w + rr, -h);
      const hole = new THREE.Path();
      const iw = 0.5, ih = 0.47;
      hole.moveTo(-iw, -ih);
      hole.lineTo(iw, -ih);
      hole.lineTo(iw, ih);
      hole.lineTo(-iw, ih);
      hole.lineTo(-iw, -ih);
      ringShape.holes.push(hole);

      const ringGeo = new THREE.ExtrudeGeometry(ringShape, {
        depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3,
      });
      const faceRing = new THREE.Mesh(ringGeo, ringMat);
      faceRing.position.z = 0.6;
      head.add(faceRing);

      const screen = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.8, 0.06, 4, 0.1), screenMat);
      screen.position.z = 0.66;
      head.add(screen);

      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 20), shellLight);
        ear.rotation.z = Math.PI / 2;
        ear.position.set(s * 0.76, 0.02, 0);
        head.add(ear);
      });

      // ---- layout
      const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener('resize', resize);

      // ---- scroll and pointer
      let scrollP = 0;
      let smoothP = 0;
      let px = 0, py = 0, sx = 0, sy = 0;

      const onScroll = () => {
        scrollP = Math.min(2, Math.max(0, window.scrollY / window.innerHeight));
      };
      const onMove = (e: PointerEvent) => {
        px = (e.clientX / window.innerWidth - 0.5) * 2;
        py = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('pointermove', onMove, { passive: true });
      onScroll();

      const mix = (a: number, b: number, t: number) => a + (b - a) * t;
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

      const target = new THREE.Vector3();
      let quoteOn = false;

      let lastDim = -1;
      const tick = (time: number) => {
        const t = time / 1000;
        smoothP += (scrollP - smoothP) * 0.08;

        // 1 in the hero, fading to a faint presence once the catalogue band arrives
        const dim = smoothP <= 0.5 ? 1 : Math.max(0.32, 1 - (smoothP - 0.5) * 1.5);
        const sized = window.innerWidth < 900 ? dim * 0.22 : dim;
        if (Math.abs(sized - lastDim) > 0.01) {
          el.style.opacity = String(sized);
          lastDim = sized;
        }
        sx += (px - sx) * 0.06;
        sy += (py - sy) * 0.06;

        // two bands remain, so the stage blends intro -> record across one viewport
        const a = STATE.intro;
        const b = STATE.record;
        const k = ease(Math.min(1, smoothP));

        const z = mix(a.z, b.z, k) * (window.innerWidth < 900 ? 1.25 : 1);
        const y = mix(a.y, b.y, k) + sy * -0.1;
        const lookY = mix(a.lookY, b.lookY, k);
        const lookX = mix(a.lookX, b.lookX, k) * (window.innerWidth < 900 ? 1.15 : 1);

        // A phone is a third as wide, so the same distance puts the figure behind the
        // headline. Pulling the camera back keeps its height a sensible share of the screen.
        const depth = window.innerWidth < 900 ? z * 1.62 : z;
        camera.position.set(sx * 0.22, y, depth);
        target.set(lookX, lookY, 0);
        camera.lookAt(target);

        body.rotation.y = mix(a.bodyYaw, b.bodyYaw, k) + sx * 0.18;
        head.rotation.y = mix(a.headYaw, b.headYaw, k) + sx * 0.6;
        head.rotation.x = mix(a.headPitch, b.headPitch, k) + sy * 0.18;
        head.rotation.z = mix(a.headRoll, b.headRoll, k);

        // idle, and louder than a resting pose: a slow breathing bob, a look-around sweep,
        // a head tilt that answers the pointer harder than the body does, and a ring that pulses
        const sweep = Math.sin(t * 0.42) * 0.17 + Math.sin(t * 0.17) * 0.08;
        body.position.y = Math.sin(t * 1.15) * 0.045;
        body.rotation.y += Math.sin(t * 0.3) * 0.045;
        head.rotation.y += sweep;
        head.rotation.x += Math.sin(t * 0.55) * 0.05;
        head.rotation.z += Math.sin(t * 0.7) * 0.035;
        ringMat.emissiveIntensity = 0.1 + 0.09 * (0.5 + 0.5 * Math.sin(t * 1.7));

        // blink, and the face mode change
        blinkAt -= 1 / 60;
        if (blinkAt <= 0) {
          blink = 0.1;
          if (blinkAt < -0.18) {
            blink = 1;
            blinkAt = 2.5 + Math.random() * 3;
            drawFace();
            faceTex.needsUpdate = true;
          }
        }

        const wantQuote = smoothP > 1.55;
        if (wantQuote !== quoteOn) {
          quoteOn = wantQuote;
          quote = wantQuote;
          drawFace();
          faceTex.needsUpdate = true;
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      dispose = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pointermove', onMove);
        renderer.dispose();
        pmrem.dispose();
        ringTex.dispose();
        faceTex.dispose();
      };
    })();

    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" className="nova-canvas" />;
}
