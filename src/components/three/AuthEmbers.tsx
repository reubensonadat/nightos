import { useEffect, useRef } from "react";
import * as THREE from "three";

type AuthEmbersProps = {
  className?: string;
};

const SILK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SILK_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
    float t = uTime * 0.05;

    float q = fbm(p * 2.1 + vec2(t, -t * 0.6));
    float r = fbm(p * 1.5 + q * 1.4 + vec2(t * 0.8, t * 0.35));
    float w = fbm(p * 1.15 - q * 1.2 + vec2(-t * 0.45, t * 0.65));

    float bandA = smoothstep(0.32, 0.95, r);
    float bandB = smoothstep(0.42, 1.05, w);
    float silk = max(bandA * 0.85, bandB * 0.55);
    float luma = 0.4 + 0.6 * fbm(p * 3.0 - q + vec2(t, t * 0.5));

    vec3 khaki = vec3(0.878, 0.769, 0.576);
    vec3 isabelline = vec3(0.949, 0.933, 0.902);
    vec3 gold = vec3(0.769, 0.604, 0.333);
    vec3 col = mix(khaki, isabelline, luma * 0.45);
    col = mix(col, gold, luma * luma * 0.35);

    float fade = smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.84, vUv.y);
    fade *= smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);

    float alpha = silk * (0.16 + 0.14 * luma) * fade;
    gl_FragColor = vec4(col, alpha);
  }
`;

const PALETTE = [new THREE.Color("#f2eee6"), new THREE.Color("#d0ba98"), new THREE.Color("#c4903a")];

export function AuthEmbers({ className }: AuthEmbersProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    if (!mount || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 9;

    /* ── aurora silk plane ── */
    const silk = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: SILK_VERT,
        fragmentShader: SILK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
        },
      }),
    );
    silk.position.z = -4.5;
    silk.renderOrder = 0;
    scene.add(silk);

    /* ── ember field ── */
    const COUNT = reduced ? 220 : 520;
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 2);
    const seeds = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
      velocities[i * 2 + 0] = 0;
      velocities[i * 2 + 1] = 0;
      seeds[i] = Math.random() * Math.PI * 2;
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.17,
      map: createDotTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 1;
    scene.add(points);

    const halfH = Math.tan((55 * Math.PI) / 360) * 9;
    let halfW = halfH * (mount.clientWidth / Math.max(1, mount.clientHeight));

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      halfW = halfH * (w / Math.max(1, h));
      silk.scale.set(halfW * 2, halfH * 2, 1);
      silk.material.uniforms.uRes.value.set(w, h);
    };

    const pointer = { x: 0, y: 0, wx: 0, wy: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      pointer.wx = pointer.x * halfW;
      pointer.wy = pointer.y * halfH;
    };

    let raf = 0;
    let fade = 0;
    const clock = new THREE.Clock();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = reduced ? 0 : clock.getElapsedTime();
      silk.material.uniforms.uTime.value = t;

      const pos = geometry.attributes.position.array as Float32Array;
      const R = 2.4;
      const R2 = R * R;
      for (let i = 0; i < COUNT; i++) {
        const xi = i * 3;
        const vi = i * 2;
        const dx = pointer.wx - pos[xi];
        const dy = pointer.wy - pos[xi + 1];
        const d2 = dx * dx + dy * dy;

        let vx = velocities[vi];
        let vy = velocities[vi + 1];

        if (!reduced && d2 < R2) {
          vx += dy * 0.028 - dx * 0.004;
          vy += -dx * 0.028 - dy * 0.004;
        }
        const cap = 0.035;
        vx = Math.max(-cap, Math.min(cap, vx));
        vy = Math.max(-cap, Math.min(cap, vy));
        vx *= 0.97;
        vy *= 0.97;

        pos[xi] += vx + Math.sin(t * 0.35 + seeds[i]) * 0.0009;
        pos[xi + 1] += vy + Math.sin(t * 0.27 + seeds[i] * 1.7) * 0.0011;
        pos[xi + 2] = Math.sin(seeds[i] * 2.3 + t * 0.22) * 2.2;

        if (pos[xi] > halfW + 0.6) pos[xi] = -halfW - 0.6;
        if (pos[xi] < -halfW - 0.6) pos[xi] = halfW + 0.6;
        if (pos[xi + 1] > halfH + 0.6) pos[xi + 1] = -halfH - 0.6;
        if (pos[xi + 1] < -halfH - 0.6) pos[xi + 1] = halfH + 0.6;

        velocities[vi] = vx;
        velocities[vi + 1] = vy;
      }
      geometry.attributes.position.needsUpdate = true;

      if (!reduced) {
        points.rotation.y = Math.sin(t * 0.05) * 0.06;
        points.rotation.z = t * 0.015;
        material.opacity = 0.55 + Math.sin(t * 0.9) * 0.1;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.55, 0.035);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, -pointer.y * 0.4, 0.035);
        camera.lookAt(0, 0, 0);
      } else {
        material.opacity = 0.5;
      }

      fade = Math.min(1, fade + 0.012);
      mount.style.opacity = String(fade);
      renderer.render(scene, camera);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        clock.getDelta();
        raf = requestAnimationFrame(tick);
      }
    });

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      (silk.material as THREE.ShaderMaterial).dispose();
      silk.geometry.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      mount.style.opacity = "1";
    };
  }, []);

  return (
    <div ref={mountRef} className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ opacity: 0 }}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}

function createDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}