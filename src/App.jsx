import { useRef, useEffect, useState } from "react";

// ─── Aura — Continuous High-Contrast Glass Matrix (v6.5) ─────────────────────
// Native Web Audio API Engine integrating premium external assets:
//  · EXPLANATION: Localhost audio silences are typically caused by missing CORS headers
//    on the media host (Catbox), causing the Web Audio API context to block the audio data.
//    To bypass this, we now route the tracks using standard HTMLAudioElements instead of
//    the AudioContext graph node system, which circumvents CORS media-blocking on local servers.
//  · RESTORED: Multi-layered staggered expanding rings animation for the listening phase.
//  · UPDATED: Dynamic contrast logic for Amelia Z credit text on dark/light background.
//  · UPDATED: Dynamic button styles for light mode (grey outline -> darker outline) and dark mode interactive reset state.

const DOT_SPACING = 24;
const IPHONE = { w: 393, h: 852 };

// AUDIO ASSETS DICTIONARY
const AUDIO_ASSETS = {
  ambient: "https://files.catbox.moe/kivdws.mp3",
  replies: [
    "https://files.catbox.moe/gcl23o.mp3", // Reply 1
    "https://files.catbox.moe/pffv8s.mp3", // Reply 2
    "https://files.catbox.moe/n6nrvn.mp3", // Reply 3
    "https://files.catbox.moe/f0r9v4.mp3", // Reply 4
  ],
};

const PALETTES = {
  idle: {
    bg: [12, 12, 13],
    text: "#ffffff",
    colors: [
      [255, 255, 255, 0.15],
      [255, 255, 255, 0.25],
      [255, 255, 255, 0.06],
    ],
  },
  excited: {
    bg: [15, 10, 14],
    text: "#ffe9d6",
    colors: [
      [255, 59, 31, 1],
      [255, 122, 26, 1],
      [255, 210, 63, 1],
      [255, 184, 200, 1],
      [74, 127, 181, 1],
      [95, 174, 95, 1],
    ],
  },
  calm: {
    bg: [15, 15, 17],
    text: "#cfe9ee",
    colors: [
      [63, 167, 196, 1],
      [127, 216, 208, 1],
      [159, 219, 226, 1],
      [189, 228, 239, 1],
      [28, 61, 82, 1],
    ],
  },
};

const SCRIPT = [
  {
    user: "I am having an excited day today!",
    emotion: "excited",
    reply: "Yes!! I can feel it — tell me everything!",
  },
  {
    user: "I just got my dream job offer!!",
    emotion: "excited",
    reply: "That's HUGE! You earned every single bit of this!",
  },
  {
    user: "But I am stressful now… so much to prepare",
    emotion: "calm",
    reply: "Let's slow it all down. One breath at a time.",
  },
  {
    user: "Okay… I'm breathing with you",
    emotion: "calm",
    reply: "Good. In for four… out for four. I'm right here.",
  },
];

function wrapWords(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = [];
  for (const wd of words) {
    const test = [...line, wd].join(" ");
    if (line.length && ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = [wd];
    } else line.push(wd);
  }
  if (line.length) lines.push(line);
  return lines;
}

const lerp = (a, b, k) => a + (b - a) * k;

export default function App() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const phaseRef = useRef("idle");
  const [phase, setPhase] = useState("idle");
  const moodRef = useRef("idle");
  const energyRef = useRef(0);
  const [turnCount, setTurnCount] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [isLightMode, setIsLightMode] = useState(true);
  const [btnHovered, setBtnHovered] = useState(false);
  const [resetPressed, setResetPressed] = useState(false);

  // Fallback Audio elements for pristine direct hardware channel delivery (Bypasses CORS limitations on Localhost)
  const ambientAudioRef = useRef(null);
  const speechAudioRef = useRef(null);

  const S = useRef({
    bg: [12, 12, 13],
    typing: null,
    userText: "",
    reply: null,
    gridNodes: [],
    ripples: [],
    pointer: { x: 0, y: 0, active: false },
    lastWordCount: 0,
    lastT: 0,
    energySmooth: 0,
    wavePhase: { idle: 0, exc: 0, calm: 0 },
    waveSpd: { exc: 0.0012, calm: 0.0003 },
    weights: { idle: 1, exc: 0, calm: 0 },
  }).current;

  const timers = useRef([]);
  const after = (fn, ms) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const setPhaseAll = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const initAudioEngine = () => {
    if (ambientAudioRef.current) return;

    const amb = new Audio(AUDIO_ASSETS.ambient);
    amb.loop = true;
    amb.volume = 0.35;
    ambientAudioRef.current = amb;
  };

  const playVoiceTrack = (index) => {
    if (!soundOn) return;

    if (speechAudioRef.current) {
      try {
        speechAudioRef.current.pause();
      } catch (e) {}
    }

    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = 0.08;
    }

    const voice = new Audio(AUDIO_ASSETS.replies[index]);
    speechAudioRef.current = voice;

    voice.play().catch((e) => console.log("Direct track blocked:", e));

    voice.onended = () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.volume = 0.35;
      }
      if (phaseRef.current === "responding") {
        setPhaseAll("ambient");
      }
    };
  };

  const handleSoundToggle = () => {
    const nextSoundState = !soundOn;
    setSoundOn(nextSoundState);

    if (nextSoundState) {
      initAudioEngine();
      if (ambientAudioRef.current) {
        ambientAudioRef.current.play().catch(() => {});
      }
    } else {
      if (ambientAudioRef.current) ambientAudioRef.current.pause();
      if (speechAudioRef.current) {
        try {
          speechAudioRef.current.pause();
        } catch (e) {}
      }
    }
  };

  const resetDemo = () => {
    clearTimers();
    if (speechAudioRef.current) {
      try {
        speechAudioRef.current.pause();
      } catch (e) {}
    }
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = 0.35;
    }
    setTurnCount(0);
    S.reply = null;
    S.typing = null;
    S.userText = "";
    S.ripples = [];
    moodRef.current = "idle";
    energyRef.current = 0;
    setPhaseAll("idle");
    updateNodeTargetRings("idle", 0);
  };

  const updateNodeTargetRings = (nextMood, energy) => {
    const nextPal = PALETTES[nextMood].colors;
    const isIdle = nextMood === "idle";
    const now = performance.now();

    for (const node of S.gridNodes) {
      const wasActive = node.active;

      let active = false;
      if (!isIdle) {
        if (energy === 0) active = node.focusDice > 0.79;
        else active = node.isFocal;
        if (energy >= 2 && !node.isFocal && node.focusDice > 0.5) active = true;
      }
      node.active = active;
      if (active && !wasActive) node.revealAt = now + Math.random() * 1300;
      else if (active) node.revealAt = 0;

      let layersCount = 1;
      if (!isIdle && active) {
        layersCount = 2 + Math.floor(Math.random() * (2 + energy));
      } else if (!isIdle) {
        layersCount = Math.random() > 0.8 ? 2 : 1;
      } else {
        layersCount = Math.random() > 0.92 ? 2 : 1;
      }

      node.targetRings = Array.from({ length: layersCount }, () => {
        const c = nextPal[Math.floor(Math.random() * nextPal.length)];
        const baseA = c[3] ?? 1.0;
        return [c[0], c[1], c[2], !isIdle && !active ? baseA * 0.18 : baseA];
      });
    }
  };

  const holdStart = () => {
    const p = phaseRef.current;
    if (p === "listening" || p === "thinking") return;
    clearTimers();
    if (speechAudioRef.current) {
      try {
        speechAudioRef.current.pause();
      } catch (e) {}
    }

    if (turnCount >= SCRIPT.length) {
      resetDemo();
      return;
    }
    S.reply = null;
    S.typing = {
      words: SCRIPT[turnCount].user.split(" "),
      start: performance.now(),
    };
    S.userText = "";
    setPhaseAll("listening");
  };

  const holdEnd = () => {
    if (phaseRef.current !== "listening") return;
    const currentTurnIdx = turnCount;
    const turn = SCRIPT[currentTurnIdx];
    S.userText = turn.user;
    S.typing = null;
    setPhaseAll("thinking");

    S.ripples.push({
      x: IPHONE.w / 2,
      y: IPHONE.h - 92,
      start: performance.now(),
      strength: 1.25,
    });

    after(() => {
      energyRef.current =
        turn.emotion === moodRef.current
          ? Math.min(2, energyRef.current + 1)
          : 0;
      moodRef.current = turn.emotion;
      updateNodeTargetRings(turn.emotion, energyRef.current);

      S.reply = {
        text: turn.reply,
        emotion: turn.emotion,
        start: performance.now(),
      };
      S.lastWordCount = 0;
      setPhaseAll("responding");

      playVoiceTrack(currentTurnIdx);

      setTurnCount((prev) => prev + 1);
      const nWords = turn.reply.split(/\s+/).length;
      const dur = turn.emotion === "excited" ? nWords * 220 + 4200 : 7800;
      after(() => {
        if (phaseRef.current === "responding") {
          if (ambientAudioRef.current) {
            ambientAudioRef.current.volume = 0.35;
          }
          setPhaseAll("ambient");
        }
      }, dur);
    }, 1200);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    const ctx = canvas.getContext("2d");
    const dotCanvas = document.createElement("canvas");
    const dctx = dotCanvas.getContext("2d");
    const blurCanvas = document.createElement("canvas");
    const bctx = blurCanvas.getContext("2d");

    let w = 0,
      h = 0,
      dpr = 1,
      raf = 0;
    let fontReady = false;

    const size = () => {
      const r = frame.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      dotCanvas.width = w * dpr;
      dotCanvas.height = h * dpr;
      blurCanvas.width = w * dpr;
      blurCanvas.height = h * dpr;

      if (S.gridNodes.length === 0) {
        const cols = Math.ceil(IPHONE.w / DOT_SPACING) + 2;
        const rows = Math.ceil(IPHONE.h / DOT_SPACING) + 2;
        const initialPal = PALETTES.idle.colors;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const layers = Math.random() > 0.9 ? 2 : 1;
            const nodeRings = Array.from({ length: layers }, () => {
              const cArr =
                initialPal[Math.floor(Math.random() * initialPal.length)];
              return [cArr[0], cArr[1], cArr[2], cArr[3] ?? 1.0];
            });

            const focusDice = Math.random();
            const isFocal = focusDice > 0.65;

            S.gridNodes.push({
              gridX: c * DOT_SPACING,
              gridY: r * DOT_SPACING,
              baseScale: 0.3 + Math.random() * 0.4,
              focusDice: focusDice,
              isFocal: isFocal,
              active: false,
              revealAt: 0,
              act: isFocal ? 1 : 0,
              currentRings: JSON.parse(JSON.stringify(nodeRings)),
              targetRings: JSON.parse(JSON.stringify(nodeRings)),
            });
          }
        }
      }
    };
    size();
    window.addEventListener("resize", size);

    if (document.fonts && document.fonts.load) {
      document.fonts.load('16px "Inter"').then(() => {
        fontReady = true;
      });
      setTimeout(() => {
        fontReady = true;
      }, 1500);
    } else fontReady = true;

    const nexus = () => ({ x: w / 2, y: h - 92 });

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e) => {
      const pt = toLocal(e);
      S.pointer.x = pt.x;
      S.pointer.y = pt.y;
      S.pointer.active = true;
    };
    const onLeave = () => {
      S.pointer.active = false;
    };
    const onTap = (e) => {
      const pt = toLocal(e);
      S.ripples.push({
        x: pt.x,
        y: pt.y,
        start: performance.now(),
        strength: 0.85,
      });
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onTap);

    const step = (t) => {
      const p = phaseRef.current;
      const mood = moodRef.current;
      const nx = nexus();

      const dt = Math.min(50, S.lastT ? t - S.lastT : 16);
      S.lastT = t;

      S.energySmooth += (energyRef.current - S.energySmooth) * 0.018;
      const eS = S.energySmooth;
      const energyMul = 1 + eS * 0.45;
      const calmDeepen = 1 / (1 + eS * 0.4);

      S.waveSpd.exc += (0.0012 * energyMul - S.waveSpd.exc) * 0.02;
      S.waveSpd.calm += (0.0003 * calmDeepen - S.waveSpd.calm) * 0.02;
      S.wavePhase.idle += 0.00055 * dt;
      S.wavePhase.exc += S.waveSpd.exc * dt;
      S.wavePhase.calm += S.waveSpd.calm * dt;

      const W = S.weights;
      const wRate = mood === "calm" ? 0.006 : 0.022;
      W.idle += ((mood === "idle" ? 1 : 0) - W.idle) * wRate;
      W.exc += ((mood === "excited" ? 1 : 0) - W.exc) * wRate;
      W.calm += ((mood === "calm" ? 1 : 0) - W.calm) * wRate;

      S.ripples = S.ripples.filter((rp) => t - rp.start < 2200);

      if (p === "responding" && S.reply && S.reply.emotion === "excited") {
        const shown = Math.min(
          S.reply.text.split(/\s+/).length,
          Math.floor((t - S.reply.start) / 220) + 1,
        );
        if (shown > S.lastWordCount) {
          S.lastWordCount = shown;
          S.ripples.push({
            x: w / 2 + (Math.random() - 0.5) * w * 0.3,
            y: h * 0.16,
            start: t,
            strength: 0.45 + eS * 0.15,
          });
        }
      }

      const currentPalette = PALETTES[mood];
      const targetBg = currentPalette.bg;
      const bgRate = mood === "calm" ? 0.008 : 0.045;
      S.bg = S.bg.map((v, i) => v + (targetBg[i] - v) * bgRate);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgb(${S.bg.map((v) => v | 0).join(",")})`;
      ctx.fillRect(0, 0, w, h);

      const breath = Math.sin((t / 8000) * Math.PI * 2);

      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.clearRect(0, 0, w, h);
      const glide = mood === "calm" ? 0.012 : 0.055;

      for (const node of S.gridNodes) {
        const dx = node.gridX;
        const dy = node.gridY;
        const distToNexus = Math.hypot(dx - nx.x, dy - nx.y);

        const wantsActive =
          mood === "idle" ? node.focusDice > 0.75 : node.active;
        const gate = wantsActive && t >= node.revealAt ? 1 : 0;
        node.act += (gate - node.act) * 0.04;
        const act = node.act;

        const wIdle =
          Math.sin(dx * 0.008 + dy * 0.006 - S.wavePhase.idle) *
          Math.cos(dy * 0.005 + S.wavePhase.idle * 0.4);
        const wExc =
          Math.sin(dx * 0.012 + dy * 0.009 - S.wavePhase.exc) * 0.75 +
          Math.sin(dx * 0.021 - S.wavePhase.exc * 1.6) * 0.35 * eS * act;
        const wCalm = Math.sin(dy * 0.012 - S.wavePhase.calm) * 1.1;
        const currentWave = wIdle * W.idle + wExc * W.exc + wCalm * W.calm;

        const idleDamp = 1 - 0.55 * W.idle;
        const waveAmp = 0.55 * (1 + (energyMul - 1) * W.exc) * idleDamp;
        let expressiveScale =
          (node.baseScale + currentWave * waveAmp) * (1.35 - 0.27 * W.idle);
        expressiveScale *= 1 + 0.1 * (1 + eS * 0.6) * breath * W.calm;
        const mutedScale =
          (node.baseScale + currentWave * 0.06 * idleDamp) * 0.38;
        let localScale = lerp(mutedScale, expressiveScale, act);

        if (S.pointer.active) {
          const pd = Math.hypot(dx - S.pointer.x, dy - S.pointer.y);
          if (pd < 100) {
            localScale += (1 - pd / 100) * lerp(0.12, 0.55, act);
          }
        }

        for (const rp of S.ripples) {
          const age = t - rp.start;
          const front = age * 0.32;
          const d = Math.hypot(dx - rp.x, dy - rp.y);
          const g = Math.exp(-Math.pow(d - front, 2) / 1800);
          const decay = Math.max(0, 1 - age / 1800);
          localScale += g * decay * rp.strength * lerp(0.18, 0.8, act);
        }

        const relativeWeight = (dy / h) * 1.2 + (dx / w) * 0.3;
        localScale *= Math.max(0.4, Math.min(1.5, relativeWeight));
        localScale = Math.min(localScale, 1.85 - 0.95 * W.idle);

        if (distToNexus < 38) continue;

        const maxRadius = DOT_SPACING * 0.44 * localScale;

        if (maxRadius > 0.1) {
          dctx.save();
          dctx.translate(dx, dy);

          const maxLayers = Math.max(
            node.currentRings.length,
            node.targetRings.length,
          );
          while (node.currentRings.length < maxLayers) {
            node.currentRings.push([0, 0, 0, 0]);
          }

          for (let i = 0; i < maxLayers; i++) {
            const curr = node.currentRings[i];
            const tgt = node.targetRings[i] || [0, 0, 0, 0];
            curr[0] += (tgt[0] - curr[0]) * glide;
            curr[1] += (tgt[1] - curr[1]) * glide;
            curr[2] += (tgt[2] - curr[2]) * glide;
            curr[3] += (tgt[3] - curr[3]) * glide;
          }

          const layers = node.currentRings.length;
          for (let i = 0; i < layers; i++) {
            const currentRadius = maxRadius * ((layers - i) / layers);
            const cArr = node.currentRings[i];

            const focalMix = Math.min(0.38, Math.max(0.08, (dy / h) * 0.45));
            const glassMix = lerp(0.05, focalMix, act);

            const r = cArr[0] * (1 - glassMix) + 78 * glassMix;
            const g = cArr[1] * (1 - glassMix) + 160 * glassMix;
            const b = cArr[2] * (1 - glassMix) + 245 * glassMix;

            const alphaExpr = Math.max(cArr[3], 0.22);
            const alphaMut = cArr[3] * 0.35;
            const glassAlpha = lerp(alphaMut, alphaExpr, act);

            dctx.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${glassAlpha})`;
            dctx.beginPath();
            dctx.arc(0, 0, Math.max(0.5, currentRadius), 0, Math.PI * 2);
            dctx.fill();
          }
          dctx.restore();
        }
      }

      ctx.filter = "blur(1.6px)";
      ctx.drawImage(dotCanvas, 0, 0, w, h);
      ctx.filter = "none";
      ctx.globalAlpha = 0.35;
      ctx.drawImage(dotCanvas, 0, 0, w, h);
      ctx.globalAlpha = 1;

      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bctx.filter = "blur(9px)";
      bctx.drawImage(dotCanvas, 0, 0, w, h);
      bctx.filter = "none";
      bctx.globalCompositeOperation = "destination-in";
      const mg = bctx.createLinearGradient(0, 0, 0, h);
      mg.addColorStop(0, "rgba(0,0,0,1)");
      mg.addColorStop(0.09, "rgba(0,0,0,0.95)");
      mg.addColorStop(0.26, "rgba(0,0,0,0)");
      mg.addColorStop(0.76, "rgba(0,0,0,0)");
      mg.addColorStop(0.93, "rgba(0,0,0,0.92)");
      mg.addColorStop(1, "rgba(0,0,0,1)");
      bctx.fillStyle = mg;
      bctx.fillRect(0, 0, w, h);
      bctx.globalCompositeOperation = "source-over";
      ctx.drawImage(blurCanvas, 0, 0, w, h);
      const sheen = ctx.createLinearGradient(0, 0, 0, h);
      sheen.addColorStop(0, "rgba(255,255,255,0.045)");
      sheen.addColorStop(0.2, "rgba(255,255,255,0)");
      sheen.addColorStop(0.82, "rgba(255,255,255,0)");
      sheen.addColorStop(1, "rgba(255,255,255,0.035)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      const gradientHeight = h * 0.42;
      const overlayGrad = ctx.createLinearGradient(0, 0, 0, gradientHeight);
      overlayGrad.addColorStop(0, `rgb(${S.bg.map((v) => v | 0).join(",")})`);
      overlayGrad.addColorStop(
        0.65,
        `rgba(${S.bg.map((v) => v | 0).join(",")}, 0.92)`,
      );
      overlayGrad.addColorStop(
        1,
        `rgba(${S.bg.map((v) => v | 0).join(",")}, 0.0)`,
      );

      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, w, gradientHeight + 10);

      if (fontReady) {
        if (p === "idle") {
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.font = '500 16px "Inter", sans-serif';
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.fillText("Hey there", 32, h * 0.14);
          ctx.font = '400 12px "Inter", sans-serif';
          ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
          ctx.fillText("How's your day going?", 32, h * 0.14 + 22);
        } else if (
          p === "responding" ||
          p === "ambient" ||
          p === "listening" ||
          p === "thinking"
        ) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = '400 13px "Inter", sans-serif';
          ctx.fillStyle = currentPalette.text;

          if (p === "listening" && S.typing) {
            const shown = Math.min(
              S.typing.words.length,
              Math.floor((t - S.typing.start) / 200) + 1,
            );
            const live = S.typing.words.slice(0, shown).join(" ");
            const lines = wrapWords(ctx, live, w * 0.75);
            lines.forEach((ln, i) =>
              ctx.fillText(ln.join(" "), w / 2, h * 0.16 + i * 22),
            );
          }

          if (p === "thinking") {
            ctx.font = '600 16px "Inter", sans-serif';
            const dotsCount = 1 + (Math.floor(t / 280) % 3);
            ctx.fillText(".".repeat(dotsCount), w / 2, h * 0.16);
          }

          if ((p === "responding" || p === "ambient") && S.reply) {
            ctx.save();

            if (p === "responding") {
              const elapsed = t - S.reply.start;
              const animDuration = 750;
              const progress = Math.min(1, elapsed / animDuration);
              const easeProgress =
                progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

              ctx.globalAlpha = easeProgress;
              ctx.translate(0, 6 * (1 - easeProgress));
            } else {
              ctx.globalAlpha = 0.45;
            }

            const lines = wrapWords(ctx, S.reply.text, w * 0.75);
            lines.forEach((ln, i) =>
              ctx.fillText(ln.join(" "), w / 2, h * 0.16 + i * 22),
            );

            ctx.restore();
          }
        }
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onTap);
    };
  }, [soundOn]);

  const done = turnCount >= SCRIPT.length;
  const buttonBorder =
    phase === "listening" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)";

  const hint =
    phase === "idle"
      ? "hold to talk"
      : phase === "listening"
        ? "release to stream"
        : phase === "thinking"
          ? "thinking"
          : done
            ? "sequence complete"
            : "hold to talk";

  // Light mode specific border definitions
  const getLightBorder = (isActive) =>
    isActive ? "1px solid #1c1c1e" : "1px solid #d1d1d6";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: isLightMode ? "#ffffff" : "#050506",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "0px",
        margin: "0px",
        fontFamily: '"Inter", sans-serif',
        position: "relative",
        boxSizing: "border-box",
        overflowX: "hidden",
        transition: "background 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <style>{`
        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          background: ${isLightMode ? "#ffffff" : "#050506"} !important;
          width: 100% !important;
          height: 100% !important;
          overflow-x: hidden;
          transition: background 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700&display=swap');
        .aura-interactive-nexus { cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none; transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1); border: none; outline: none; }
        .aura-interactive-nexus:active { transform: translateX(-50%) scale(0.92) !important; }
        @keyframes recRing {
          0%   { transform: scale(1); opacity: 0; }
          12%  { opacity: 0.5; }
          100% { transform: scale(2.15); opacity: 0; }
        }
        .aura-rec-ring {
          position: absolute;
          left: 50%;
          bottom: 64px;
          width: 54px;
          height: 54px;
          margin-left: -27px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.55);
          pointer-events: none;
          animation: recRing 2.6s cubic-bezier(0.25, 0.6, 0.3, 1) infinite;
        }
        .aura-designer-link { color: inherit; text-decoration: underline; transition: color 0.2s ease; pointer-events: auto; }
        .aura-designer-link:hover { opacity: 0.75; }
      `}</style>

      <div
        style={{
          color: "#767676",
          fontSize: 10,
          fontWeight: 200,
          letterSpacing: "0.5px",
          textAlign: "center",
          marginTop: "32px",
        }}
      >
        Visualizing AI Expression Beyond Voice
      </div>

      <div
        ref={frameRef}
        style={{
          width: `min(${IPHONE.w}px, 92vw, calc((100vh - 210px) * ${IPHONE.w / IPHONE.h}))`,
          aspectRatio: `${IPHONE.w} / ${IPHONE.h}`,
          borderRadius: 44,
          overflow: "hidden",
          border: isLightMode
            ? "1px solid rgba(0,0,0,0.06)"
            : "1px solid #1c1c1e",
          boxShadow: isLightMode
            ? "0 10px 30px rgba(0,0,0,0.04), 0 30px 70px rgba(0,0,0,0.09), 0 50px 100px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.4)"
            : "0 40px 100px rgba(0,0,0,.8)",
          transform: isLightMode
            ? "perspective(1200px) rotateX(1deg) translateY(-2px)"
            : "none",
          position: "relative",
          touchAction: "manipulation",
          transition: "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />

        {phase === "listening" &&
          [0, 1, 2].map((i) => (
            <span
              key={i}
              className="aura-rec-ring"
              style={{ animationDelay: `${-i * 0.85}s` }}
            />
          ))}

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 64,
            transform: `translateX(-50%) scale(${btnHovered ? 1.12 : 1})`,
            width: 54,
            height: 54,
            borderRadius: "50%",
            border: `1px solid ${buttonBorder}`,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#ffffff",
            }}
          />
        </div>

        <button
          className="aura-interactive-nexus"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            holdStart();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            holdEnd();
          }}
          onPointerCancel={holdEnd}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Interact with simulation"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 64,
            transform: `translateX(-50%) scale(${btnHovered ? 1.12 : 1})`,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "transparent",
            transition: "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 26,
            textAlign: "center",
            color: "rgba(255,255,255,0.25)",
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: 1,
            pointerEvents: "none",
            textTransform: "uppercase",
          }}
        >
          {hint}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: "64px",
        }}
      >
        <button
          onClick={handleSoundToggle}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "7px 16px",
            borderRadius: 999,
            border: isLightMode
              ? getLightBorder(soundOn)
              : `1px solid ${soundOn ? "rgba(210, 210, 210, 0.4)" : "#2a2a2e"}`,
            background: soundOn ? "rgba(120, 120, 120, 0.12)" : "transparent",
            color: soundOn ? (isLightMode ? "#1c1c1e" : "#ffffff") : "#6b6b70",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {soundOn ? "🔊 Audio On" : "🔈 Audio Off"}
        </button>

        <button
          onClick={() => setIsLightMode(!isLightMode)}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "7px 16px",
            borderRadius: 999,
            border: isLightMode ? getLightBorder(true) : "1px solid #2a2a2e",
            background: isLightMode ? "rgba(0, 0, 0, 0.05)" : "transparent",
            color: isLightMode ? "#1c1c1e" : "#6b6b70",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          {isLightMode ? "☀️ Light" : "🌙 Dark"}
        </button>

        <button
          onClick={resetDemo}
          onMouseDown={() => setResetPressed(true)}
          onMouseUp={() => setResetPressed(false)}
          onMouseLeave={() => setResetPressed(false)}
          onTouchStart={() => setResetPressed(true)}
          onTouchEnd={() => setResetPressed(false)}
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "7px 16px",
            borderRadius: 999,
            border: isLightMode
              ? getLightBorder(resetPressed)
              : "1px solid #2a2a2e",
            background: "transparent",
            color: resetPressed && !isLightMode ? "#ffffff" : "#6b6b70",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          ↺ Reset
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 24,
          color: isLightMode
            ? "rgba(0, 0, 0, 0.6)"
            : "rgba(255, 255, 255, 0.22)",
          fontSize: 11,
          fontWeight: 400,
          pointerEvents: "none",
          transition: "color 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        Designed by{" "}
        <a
          href="https://ameliaz.framer.website/"
          target="_blank"
          rel="noopener noreferrer"
          className="aura-designer-link"
        >
          Amelia Z.
        </a>{" "}
        (Vibe-coded with Claude)
      </div>
    </div>
  );
}
