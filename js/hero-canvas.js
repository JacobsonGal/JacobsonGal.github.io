const NODE_COUNT = 72;
const LINK_DISTANCE = 140;
const ACCENT = { h: 205, s: 68, l: 42 };

function hsla(h, s, l, a) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  const hero = document.getElementById('top');
  if (!canvas || !hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let nodes = [];
  let mouse = { x: 0.5, y: 0.5, active: false };
  let frame = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedNodes();
  }

  function seedNodes() {
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1 + Math.random() * 2,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    frame += 1;
    ctx.clearRect(0, 0, width, height);

    const mx = mouse.active ? mouse.x * width : width * 0.55;
    const my = mouse.active ? mouse.y * height : height * 0.4;

    nodes.forEach((node) => {
      const dx = mx - node.x;
      const dy = my - node.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = Math.min(80 / dist, 0.08);
      node.vx += (dx / dist) * force * 0.02;
      node.vy += (dy / dist) * force * 0.02;
      node.vx *= 0.99;
      node.vy *= 0.99;
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;
      node.x = Math.max(0, Math.min(width, node.x));
      node.y = Math.max(0, Math.min(height, node.y));
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK_DISTANCE) continue;
        const alpha = (1 - d / LINK_DISTANCE) * 0.35;
        ctx.strokeStyle = hsla(ACCENT.h, ACCENT.s, 65, alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    nodes.forEach((node) => {
      const glow = 0.45 + Math.sin(frame * 0.04 + node.pulse) * 0.25;
      ctx.fillStyle = hsla(ACCENT.h, ACCENT.s, 72, glow);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (mouse.active) {
      ctx.strokeStyle = hsla(ACCENT.h, ACCENT.s, 70, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx, my, 120, 0, Math.PI * 2);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  hero.addEventListener('mousemove', (event) => {
    const rect = hero.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width;
    mouse.y = (event.clientY - rect.top) / rect.height;
    mouse.active = true;
  });

  hero.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
}
