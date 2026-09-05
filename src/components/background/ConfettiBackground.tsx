"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { useTheme } from "@theme/ThemeProvider";

// --- Simplex-like noise (self-contained, no dependency) ---
function hash(x: number, y: number, z: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash(ix, iy, iz);
  const b = hash(ix + 1, iy, iz);
  const c = hash(ix, iy + 1, iz);
  const d = hash(ix + 1, iy + 1, iz);
  const e = hash(ix, iy, iz + 1);
  const f = hash(ix + 1, iy, iz + 1);
  const g = hash(ix, iy + 1, iz + 1);
  const h = hash(ix + 1, iy + 1, iz + 1);

  return a + (b - a) * ux +
    (c - a) * uy + (a - b - c + d) * ux * uy +
    (e - a) * uz + (a - b - e + f) * ux * uz +
    (a - c - e + g) * uy * uz +
    (-a + b + c - d + e - f - g + h) * ux * uy * uz;
}

function noise3D(x: number, y: number, z: number): number {
  return smoothNoise(x, y, z) * 2 - 1;
}

const CONFETTI_SVGS: { src: string; w: number; h: number; weight: number }[] = [
  { src: "/backgrounds/confetti/blue-line-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/gold-line-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/pink-line-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/green-line-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/blue-wave-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/gold-wave-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/pink-wave-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/green-wave-short.svg", w: 80, h: 40, weight: 1.5 },
  { src: "/backgrounds/confetti/blue-circle.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/gold-circle.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/pink-circle.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/green-circle.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/blue-diamond.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/gold-diamond.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/pink-diamond.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/green-diamond.svg", w: 60, h: 60, weight: 1 },
  { src: "/backgrounds/confetti/blue-triangle-sm.svg", w: 40, h: 40, weight: 1 },
  { src: "/backgrounds/confetti/blue-triangle-lg.svg", w: 80, h: 80, weight: 1 },
  { src: "/backgrounds/confetti/gold-triangle-sm.svg", w: 40, h: 40, weight: 1 },
  { src: "/backgrounds/confetti/gold-triangle-lg.svg", w: 80, h: 80, weight: 1 },
  { src: "/backgrounds/confetti/pink-triangle-sm.svg", w: 40, h: 40, weight: 1 },
  { src: "/backgrounds/confetti/pink-triangle-lg.svg", w: 80, h: 80, weight: 1 },
  { src: "/backgrounds/confetti/green-triangle-sm.svg", w: 40, h: 40, weight: 1 },
  { src: "/backgrounds/confetti/green-triangle-lg.svg", w: 80, h: 80, weight: 1 },
];

export default function ConfettiBackground() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const isDarkRef = useRef(false);

  useEffect(() => {
    isDarkRef.current = theme === "dark";
  }, [theme]);

  useEffect(() => {
    const loadImages = async () => {
      await Promise.all(
        CONFETTI_SVGS.map(
          (svg) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.src = svg.src;
              img.onload = () => {
                imagesRef.current.set(svg.src, img);
                resolve();
              };
              img.onerror = () => resolve();
            })
        )
      );
      setImagesLoaded(true);
    };
    loadImages();
  }, []);

  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const Engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
    const { World, Bodies, Body, Events, Runner, Composite } = Matter;

    const width = canvas.width;
    const height = canvas.height;
    const wallThickness = 200;

    const walls = [
      Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { isStatic: true, restitution: 0.8 }),
      Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true, restitution: 0.8 }),
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, { isStatic: true, restitution: 0.8 }),
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, { isStatic: true, restitution: 0.8 }),
    ];
    World.add(Engine.world, walls);

    type DepthLayer = 0 | 1 | 2;
    const depthConfig: Record<DepthLayer, { scaleRange: [number, number]; frictionAir: number; opacity: number; blur: number; driftFactor: number }> = {
      0: { scaleRange: [0.2, 0.35], frictionAir: 0.05, opacity: 0.3, blur: 2, driftFactor: 0.35 },
      1: { scaleRange: [0.35, 0.6], frictionAir: 0.035, opacity: 0.65, blur: 0.5, driftFactor: 0.9 },
      2: { scaleRange: [0.55, 0.85], frictionAir: 0.02, opacity: 1.0, blur: 0, driftFactor: 1.8 },
    };

    const area = width * height;
    const baseArea = 390 * 844;
    const rawCount = Math.floor(26 * Math.pow(area / baseArea, 0.5));
    const confettiCount = Math.max(24, Math.min(80, rawCount));
    for (let i = 0; i < confettiCount; i++) {
      const totalWeight = CONFETTI_SVGS.reduce((sum, s) => sum + s.weight, 0);
      let random = Math.random() * totalWeight;
      let svgInfo = CONFETTI_SVGS[0];
      for (const s of CONFETTI_SVGS) {
        random -= s.weight;
        if (random <= 0) {
          svgInfo = s;
          break;
        }
      }

      const depthRoll = Math.random();
      const depth: DepthLayer = depthRoll < 0.35 ? 0 : depthRoll < 0.75 ? 1 : 2;
      const cfg = depthConfig[depth];

      const baseScale = cfg.scaleRange[0] + Math.random() * (cfg.scaleRange[1] - cfg.scaleRange[0]);
      const w = svgInfo.w * baseScale;
      const h = svgInfo.h * baseScale;
      const x = Math.random() * width;
      const y = Math.random() * height;

      const body = Bodies.rectangle(x, y, w, h, {
        restitution: 0.6,
        friction: 0.001,
        frictionAir: cfg.frictionAir,
        angle: Math.random() * Math.PI * 2,
        density: 0.001,
      });

      Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.002);

      (body as any).svgKey = svgInfo.src;
      (body as any).baseScale = baseScale;
      (body as any).depth = depth;
      (body as any).depthConfig = cfg;

      (body as any).noiseOffsetX = Math.random() * 1000;
      (body as any).noiseOffsetY = Math.random() * 1000;
      (body as any).noiseOffsetZ = Math.random() * 1000;

      (body as any).energy = 0.3 + Math.random() * 0.5;
      (body as any).energyPhase = Math.random() * Math.PI * 2;

      (body as any).wobbleFreq = 0.3 + Math.random() * 0.4;
      (body as any).wobblePhase = Math.random() * Math.PI * 2;
      (body as any).wobbleAmp = 0.05 + Math.random() * 0.1;

      World.add(Engine.world, body);
    }

    let time = 0;
    Events.on(Engine, "beforeUpdate", () => {
      time += 0.016;
      const mouse = mouseRef.current;

      const globalFlowX = Math.sin(time * 0.03) * 0.000005;
      const globalFlowY = Math.cos(time * 0.025) * 0.000005;

      Composite.allBodies(Engine.world).forEach((body: Matter.Body) => {
        if (body.isStatic) return;

        const cfg = (body as any).depthConfig;
        const energy = (body as any).energy as number;
        const noiseZ = (body as any).noiseOffsetZ as number;

        const nx = (body as any).noiseOffsetX as number;
        const ny = (body as any).noiseOffsetY as number;
        const noiseVal = noise3D(
          (body.position.x + nx) * 0.0008,
          (body.position.y + ny) * 0.0008,
          time * 0.24 + noiseZ
        );

        const angle = noiseVal * Math.PI * 2;
        const forceScale = 0.00006 * cfg.driftFactor * energy;

        Body.applyForce(body, body.position, {
          x: Math.cos(angle) * forceScale + globalFlowX,
          y: Math.sin(angle) * forceScale + globalFlowY,
        });

        if (Math.random() < 0.0008) {
          Body.applyForce(body, body.position, {
            x: (Math.random() - 0.5) * 0.00005 * energy,
            y: (Math.random() - 0.5) * 0.00005 * energy,
          });
        }

        if (mouse.active) {
          const dx = body.position.x - mouse.x;
          const dy = body.position.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 260 && dist > 5) {
            const tangentX = -dy / dist;
            const tangentY = dx / dist;
            const swirlForce = 0.00022 * (1 - dist / 260) * (energy * 0.5 + 0.5);
            Body.applyForce(body, body.position, {
              x: tangentX * swirlForce,
              y: tangentY * swirlForce,
            });
          }
        }
      });
    });

    const runner = Runner.create();
    Runner.run(runner, Engine);

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      Composite.allBodies(Engine.world).forEach((body: Matter.Body) => {
        if (body.isStatic) return;
        const svgKey = (body as any).svgKey as string;
        const img = imagesRef.current.get(svgKey);
        if (!img) return;

        const baseScale = (body as any).baseScale as number;
        const cfg = (body as any).depthConfig;
        const wobbleFreq = (body as any).wobbleFreq as number;
        const wobblePhase = (body as any).wobblePhase as number;
        const wobbleAmp = (body as any).wobbleAmp as number;

        ctx.save();
        ctx.translate(body.position.x, body.position.y);

        const wobble = Math.sin(time * wobbleFreq + wobblePhase) * wobbleAmp;
        ctx.rotate(body.angle + wobble);

        if (isDarkRef.current) {
          const glowIntensity = cfg.opacity;
          ctx.shadowBlur = 6 + cfg.blur * 3;
          ctx.shadowColor = `rgba(255, 240, 200, ${0.15 * glowIntensity})`;
        } else if (cfg.blur > 0) {
          ctx.shadowBlur = cfg.blur * 4;
          ctx.shadowColor = "rgba(255,255,255,0.12)";
        }

        ctx.globalAlpha = cfg.opacity;

        ctx.drawImage(
          img,
          -img.width * baseScale / 2,
          -img.height * baseScale / 2,
          img.width * baseScale,
          img.height * baseScale
        );

        ctx.restore();
      });

      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      Runner.stop(runner);
      Matter.Engine.clear(Engine);
      cancelAnimationFrame(frameId);
    };
  }, [imagesLoaded]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      aria-hidden="true"
      style={{ cursor: "default", pointerEvents: "none" }}
    />
  );
}
