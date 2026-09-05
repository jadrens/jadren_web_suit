"use client";

import { useEffect, useRef, useState } from "react";
import Matter from "matter-js";

const AVATAR_SIZE = 35;
const DRAG_RADIUS_MULTIPLIER = 3;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  hue: number;
  angle: number;
  angleVel: number;
  isAvatarFragment: boolean;
}

export default function BouncingAvatar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const hasStarted = useRef(false);
  const avatarRef = useRef<any>(null);
  const startPosRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const hueRef = useRef(Math.random() * 360);
  const lastWallBounceRef = useRef(0);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const squashRef = useRef({ x: 1, y: 1 });

  // Start when user clicks footer avatar
  useEffect(() => {
    const avatarEl = document.querySelector('footer img[alt="jadren"]');
    const handleClick = () => {
      if (hasStarted.current) return;
      hasStarted.current = true;

      if (avatarEl) {
        const rect = avatarEl.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        startPosRef.current = {
          x: rect.left + rect.width / 2,
          y: rect.top - 50,
          size: size / 2,
        };
      }

      setVisible(true);
      avatarEl?.remove();
    };

    avatarEl?.addEventListener("click", handleClick);
    return () => avatarEl?.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!visible) return;

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

    const Engine = Matter.Engine.create({ gravity: { x: 0, y: 1.2 } });
    const { World, Bodies, Body, Runner } = Matter;

    const width = canvas.width;
    const height = canvas.height;
    const wallThickness = 100;

    const startX = startPosRef.current?.x ?? width / 2;
    const startY = startPosRef.current?.y ?? height / 2;
    const radius = startPosRef.current?.size ?? AVATAR_SIZE;

    const walls = [
      Bodies.rectangle(width / 2, -wallThickness / 2, width * 2, wallThickness, { isStatic: true, restitution: 0.85 }),
      Bodies.rectangle(width / 2, height + wallThickness / 2, width * 2, wallThickness, { isStatic: true, restitution: 0.85 }),
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true, restitution: 0.85 }),
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true, restitution: 0.85 }),
    ];
    World.add(Engine.world, walls);

    const avatar = Bodies.circle(startX, startY, radius, {
      restitution: 0.7,
      friction: 0.001,
      frictionAir: 0.001,
      density: 0.01,
    });
    avatarRef.current = avatar;
    World.add(Engine.world, avatar);

    Body.setVelocity(avatar, { x: (Math.random() - 0.5) * 4, y: 2 });
    Body.setAngularVelocity(avatar, (Math.random() - 0.5) * 0.1);

    const runner = Runner.create();
    Runner.run(runner, Engine);

    const handleClick = (e: MouseEvent) => {
      const dx = e.clientX - avatar.position.x;
      const dy = e.clientY - avatar.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dragRadius = radius * DRAG_RADIUS_MULTIPLIER;

      if (dist <= dragRadius && dist > 1) {
        const forceMagnitude = 3.58;
        const torqueMagnitude = (dx / dist) * 0.02;
        Body.applyForce(avatar, avatar.position, {
          x: (dx / dist) * forceMagnitude,
          y: (dy / dist) * forceMagnitude,
        });
        Body.setAngularVelocity(avatar, avatar.angularVelocity + torqueMagnitude);
      }
    };

    document.addEventListener("click", handleClick);

    let prevVelX = avatar.velocity.x;
    let prevVelY = avatar.velocity.y;

    const avatarImg = new Image();
    avatarImg.src = "/avatar.svg";
    avatarImgRef.current = avatarImg;

    let frameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const body = avatar;
      let x = body.position.x;
      let y = body.position.y;
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);

      const margin = radius;
      let clamped = false;
      let newVx = body.velocity.x;
      let newVy = body.velocity.y;

      if (x < -margin) {
        x = -margin;
        newVx = Math.abs(newVx);
        clamped = true;
        squashRef.current = { x: 0.6, y: 1.4 };
      } else if (x > canvas.width + margin) {
        x = canvas.width + margin;
        newVx = -Math.abs(newVx);
        clamped = true;
        squashRef.current = { x: 0.6, y: 1.4 };
      }

      if (y < -margin) {
        y = -margin;
        newVy = Math.abs(newVy);
        clamped = true;
        squashRef.current = { x: 1.4, y: 0.6 };
      } else if (y > canvas.height + margin) {
        y = canvas.height + margin;
        newVy = -Math.abs(newVy);
        clamped = true;
        squashRef.current = { x: 1.4, y: 0.6 };
      }

      if (clamped) {
        Body.setPosition(body, { x, y });
        Body.setVelocity(body, { x: newVx, y: newVy });
        if (speed > 3) {
          spawnFragments(x, y, speed, radius, body.angle);
        }
      }

      const velFlipX = (prevVelX > 0) !== (body.velocity.x > 0) && Math.abs(body.velocity.x) > 2;
      const velFlipY = (prevVelY > 0) !== (body.velocity.y > 0) && Math.abs(body.velocity.y) > 2;
      if ((velFlipX || velFlipY) && speed > 3 && Date.now() - lastWallBounceRef.current > 100) {
        if (velFlipX) squashRef.current = { x: 0.6, y: 1.4 };
        if (velFlipY) squashRef.current = { x: 1.4, y: 0.6 };
        spawnFragments(x, y, speed, radius, body.angle);
        lastWallBounceRef.current = Date.now();
      }
      prevVelX = body.velocity.x;
      prevVelY = body.velocity.y;

      if (speed > 1.5 && Math.random() > 0.3) {
        spawnTrailParticle(x, y, speed, radius);
      }

      updateAndDrawParticles(ctx);

      hueRef.current = (hueRef.current + 0.3) % 360;

      const s = squashRef.current;
      s.x += (1 - s.x) * 0.15;
      s.y += (1 - s.y) * 0.15;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s.x, s.y);

      ctx.save();
      ctx.beginPath();
      ctx.arc(3, 3, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fill();
      ctx.restore();

      ctx.rotate(body.angle);

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      const hue = (hueRef.current + speed * 5) % 360;
      ctx.fillStyle = `hsl(${hue}, 15%, 95%)`;
      ctx.fill();
      ctx.strokeStyle = `hsl(${hue}, 30%, 80%)`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
      ctx.clip();

      if (avatarImg.complete) {
        ctx.drawImage(avatarImg, -radius + 1, -radius + 1, (radius - 1) * 2, (radius - 1) * 2);
      }

      ctx.restore();

      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("click", handleClick);
      Runner.stop(runner);
      Matter.Engine.clear(Engine);
      cancelAnimationFrame(frameId);
    };
  }, [visible]);

  function spawnFragments(x: number, y: number, speed: number, radius: number, avatarAngle: number) {
    const count = Math.floor(3 + Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 1.2;
      const srcDist = Math.random() * radius * 0.7;
      const fragRadius = radius * (0.15 + Math.random() * 0.4);
      particlesRef.current.push({
        x: x + Math.cos(angle) * srcDist,
        y: y + Math.sin(angle) * srcDist,
        vx: Math.cos(angle) * (1.5 + Math.random() * speed * 0.6),
        vy: Math.sin(angle) * (1.5 + Math.random() * speed * 0.6),
        life: 0,
        maxLife: 18 + Math.random() * 22,
        radius: fragRadius,
        hue: 0,
        angle: avatarAngle + (Math.random() - 0.5) * 1.5,
        angleVel: (Math.random() - 0.5) * 0.25,
        isAvatarFragment: true,
      });
    }
  }

  function spawnTrailParticle(x: number, y: number, speed: number, radius: number) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.8 + Math.random() * 0.4);
    particlesRef.current.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * speed * 0.3,
      vy: (Math.random() - 0.5) * speed * 0.3,
      life: 0,
      maxLife: 15 + Math.random() * 25,
      radius: 1 + Math.random() * 2.5,
      hue: (hueRef.current + Math.random() * 60 - 30 + 360) % 360,
      angle: 0,
      angleVel: 0,
      isAvatarFragment: false,
    });
  }

  function updateAndDrawParticles(ctx: CanvasRenderingContext2D) {
    const img = avatarImgRef.current;
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.angle += p.angleVel;

      const alpha = 1 - p.life / p.maxLife;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.isAvatarFragment && img?.complete) {
        const r = p.radius;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        const srcX = ((Math.sin(p.angle * 3.7) * 0.5 + 0.5) * r * 2);
        const srcY = ((Math.cos(p.angle * 2.3) * 0.5 + 0.5) * r * 2);
        ctx.drawImage(img, srcX, srcY, r * 3, r * 3, -r, -r, r * 2, r * 2);
      } else {
        const size = p.radius * (1 - p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue}, 90%, 65%)`;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  if (!visible) return null;

  return (
    <canvas ref={canvasRef} className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }} />
  );
}
