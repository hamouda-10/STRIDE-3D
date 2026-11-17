import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BITS,
  FLAVOURS,
  HERO_BITS,
  INSIDE_STEPS,
  INTRO_VIDEO_URL,
  SHEET_URL,
  SLOTS,
  clamp,
  cubicBezier,
  hexToRgba,
  lerp,
  seededRand,
  spriteStyle,
} from './data/strideData';
import { Bar3DEngine, BarState, initBar3DEngine } from './engine/bar3d';

const GLIDE_EASE = cubicBezier(0.25, 0.75, 0.2, 1);
const HERO_ENTRANCE_EASE = cubicBezier(0.16, 1, 0.3, 1);

interface StormPieceMeta {
  angle: number;
  phase: number;
  spin: number;
  sizeFactor: number;
  isFlavourBit: boolean;
  fallbackBit: number;
}

function createStormMeta(): StormPieceMeta[] {
  const rand = seededRand(4242);
  return Array.from({ length: 20 }, (_, i) => ({
    angle: rand() * Math.PI * 2,
    phase: i / 20 + rand() * 0.03,
    spin: (rand() > 0.5 ? 1 : -1) * (200 + rand() * 160),
    sizeFactor: 0.7 + rand() * 0.7,
    isFlavourBit: rand() < 0.7,
    fallbackBit: Math.floor(rand() * 5),
  }));
}

function measureTextWidth(text: string, font: string): number {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) return text.length * 60;
  ctx.font = font;
  return Math.max(1, ctx.measureText(text).width);
}

function lerpBarState(a: BarState, b: BarState, t: number): BarState {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    h: lerp(a.h, b.h, t),
    rz: lerp(a.rz, b.rz, t),
    ry: lerp(a.ry, b.ry, t),
    rx: lerp(a.rx, b.rx, t),
    z: lerp(a.z, b.z, t),
    op: lerp(a.op, b.op, t),
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
    shadow: lerp(a.shadow, b.shadow, t),
  };
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function BrandMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill={inverted ? '#f0e8e0' : '#1c1a1f'} />
      <path
        d="M8.5 26.5L15.2 15.8L20.3 22.4L25.4 13.5L31.5 26.5H8.5Z"
        fill={inverted ? '#1c1a1f' : '#f0e8e0'}
      />
    </svg>
  );
}

function StepIcon({ idx }: { idx: number }) {
  switch (idx) {
    case 0:
      // Leaf
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      );
    case 1:
      // Four grains
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="8" cy="8" rx="3" ry="4.5" transform="rotate(-25 8 8)" />
          <ellipse cx="16" cy="8" rx="3" ry="4.5" transform="rotate(25 16 8)" />
          <ellipse cx="8" cy="16" rx="3" ry="4.5" transform="rotate(25 8 16)" />
          <ellipse cx="16" cy="16" rx="3" ry="4.5" transform="rotate(-25 16 16)" />
        </svg>
      );
    case 2:
      // Heart
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    default:
      // Bolt
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
  }
}

export default function App() {
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Intro & entrance states
  const [introPhase, setIntroPhase] = useState<'video' | 'stamp' | 'leaving' | 'done'>(
    reducedMotion ? 'done' : 'video',
  );
  const [entered, setEntered] = useState(reducedMotion);

  // Flavour & hero UI states
  const [activeFlavour, setActiveFlavour] = useState(1); // Berry Oat
  const [autoplay, setAutoplay] = useState(!reducedMotion);
  const [heroCounterText, setHeroCounterText] = useState('02');
  const [titleFontSize, setTitleFontSize] = useState<number>(80);

  // Nav states
  const [activeNavIdx, setActiveNavIdx] = useState(0);
  const [navTheme, setNavTheme] = useState<'default' | 'light' | 'dark'>('default');
  const [pillHi, setPillHi] = useState({ left: 5, width: 80 });

  // Section 2 states
  const [activeStep, setActiveStep] = useState(0);
  const [stepDisplay, setStepDisplay] = useState({
    num: '01',
    head: INSIDE_STEPS[0].head as readonly string[],
    cap: INSIDE_STEPS[0].cap as readonly [string, string],
    isFlavourStep: false,
  });

  // Section 3 & 4 states
  const [shopRevealed, setShopRevealed] = useState(reducedMotion);
  const [rangeRevealed, setRangeRevealed] = useState(reducedMotion);
  const [pack, setPack] = useState<(number | null)[]>([null, null, null]);
  const [glowColor, setGlowColor] = useState('rgba(148,189,180,0.72)');
  const [buyStatus, setBuyStatus] = useState<'idle' | 'added'>('idle');
  const [cartCount, setCartCount] = useState(0);

  // Refs for DOM elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);
  const arcRef = useRef<HTMLDivElement | null>(null);
  const titleStageRef = useRef<HTMLSpanElement | null>(null);
  const countRef = useRef<HTMLDivElement | null>(null);
  const bitsRef = useRef<(HTMLDivElement | null)[]>([]);
  const insideRef = useRef<HTMLElement | null>(null);
  const inBarRef = useRef<HTMLDivElement | null>(null);
  const inDarkRef = useRef<HTMLDivElement | null>(null);
  const inFrontRef = useRef<HTMLDivElement | null>(null);
  const inFrontFrameRef = useRef<HTMLDivElement | null>(null);
  const inNumRef = useRef<HTMLDivElement | null>(null);
  const inHeadRef = useRef<HTMLHeadingElement | null>(null);
  const inCapRef = useRef<HTMLParagraphElement | null>(null);
  const stormPieceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shopRef = useRef<HTMLElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rangeRef = useRef<HTMLElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const slotBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const basketRef = useRef<HTMLButtonElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const navPillRef = useRef<HTMLDivElement | null>(null);
  const navLinkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // Mutable animation engine state
  const engineRef = useRef<Bar3DEngine | null>(null);
  const posRef = useRef<number>(reducedMotion ? 1 : -2.6);
  const targetRef = useRef<number>(1);
  const activeFlavourRef = useRef<number>(1);
  const autoplayRef = useRef<boolean>(!reducedMotion);
  const enteredRef = useRef<boolean>(reducedMotion);
  const lastInteractionRef = useRef<number>(performance.now());
  const introEnteredRef = useRef<boolean>(reducedMotion);

  // Slide tween state
  const slideRef = useRef<{
    active: boolean;
    from: number;
    to: number;
    start: number;
    dur: number;
    easeFn: (t: number) => number;
    flavourFired: boolean;
    dir: number;
  }>({
    active: false,
    from: 1,
    to: 1,
    start: 0,
    dur: 650,
    easeFn: GLIDE_EASE,
    flavourFired: true,
    dir: 1,
  });

  // Colour reveal state
  const revealAnimRef = useRef<{
    active: boolean;
    start: number;
    color: string;
  }>({
    active: false,
    start: 0,
    color: FLAVOURS[1].color,
  });

  // Drag state
  const dragRef = useRef<{
    down: boolean;
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    pos0: number;
    lastX: number;
    lastT: number;
    vel: number;
  }>({
    down: false,
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    pos0: 1,
    lastX: 0,
    lastT: 0,
    vel: 0,
  });

  // Section 2 flip state
  const stepRef = useRef<number>(0);
  const flipRef = useRef<{
    active: boolean;
    from: number;
    to: number;
    cur: number;
    start: number;
    dur: number;
  }>({
    active: false,
    from: 0,
    to: 0,
    cur: 0,
    start: 0,
    dur: 720,
  });
  const textSwapTimerRef = useRef<number | null>(null);
  const textFinishTimerRef = useRef<number | null>(null);

  // Card tilt & poke state
  const cardTiltRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pokeRef = useRef<{ active: boolean; start: number; flavourIdx: number }>({
    active: false,
    start: 0,
    flavourIdx: -1,
  });
  const mobileCenteredRef = useRef<boolean>(false);

  // Smooth scroll state
  const smoothScrollRef = useRef<{
    active: boolean;
    cur: number;
    target: number;
  }>({
    active: false,
    cur: 0,
    target: 0,
  });

  // Builder state refs
  const packTouchedRef = useRef<boolean>(false);
  const autoFilledRef = useRef<boolean>(false);

  const stormMeta = useMemo(() => createStormMeta(), []);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  useEffect(() => {
    enteredRef.current = entered;
  }, [entered]);

  // Compute responsive hero title font size
  const updateTitleSize = useCallback((flavourIdx: number) => {
    const vw = window.innerWidth;
    const heroH = heroRef.current?.clientHeight || window.innerHeight;
    const flavName = FLAVOURS[flavourIdx].name.toUpperCase();
    if (vw >= 820) {
      const u = Math.min(vw / 1440, heroH / 900);
      const w100 = measureTextWidth(flavName, '400 100px "Archivo Black", sans-serif');
      const size = Math.min(96 * u, (760 * u * 100) / w100);
      setTitleFontSize(size);
    } else {
      const words = flavName.split(' ');
      let maxWordW = 1;
      for (const w of words) {
        maxWordW = Math.max(maxWordW, measureTextWidth(w, '400 100px "Archivo Black", sans-serif'));
      }
      const isLandscape = window.innerHeight <= 500;
      const base = isLandscape ? 36 : clamp(0.125 * vw, 40, 64);
      const size = Math.min(base, ((vw - 36) * 100) / maxWordW);
      setTitleFontSize(size);
    }
  }, []);

  // Build title DOM with animated letter rise
  const renderTitleWordSpans = useCallback((name: string, layerClass: string) => {
    const layer = document.createElement('span');
    layer.className = `title-layer ${layerClass}`;
    const words = name.toUpperCase().split(' ');
    const chars: HTMLSpanElement[] = [];

    words.forEach((word, wi) => {
      if (wi > 0) {
        layer.appendChild(document.createTextNode(' '));
      }
      const wordSpan = document.createElement('span');
      wordSpan.className = 'title-word';
      for (const ch of word) {
        const clip = document.createElement('span');
        clip.className = 'title-char-clip';
        const chSpan = document.createElement('span');
        chSpan.className = 'title-char';
        chSpan.textContent = ch;
        clip.appendChild(chSpan);
        wordSpan.appendChild(clip);
        chars.push(chSpan);
      }
      layer.appendChild(wordSpan);
    });

    return { layer, chars };
  }, []);

  const animateTitleSwap = useCallback(
    (newFlavourIdx: number, dir: number, instant = false) => {
      const stage = titleStageRef.current;
      if (!stage) return;
      updateTitleSize(newFlavourIdx);
      const newName = FLAVOURS[newFlavourIdx].name;

      if (instant || reducedMotion) {
        stage.innerHTML = '';
        const { layer } = renderTitleWordSpans(newName, 'in');
        stage.appendChild(layer);
        return;
      }

      // Remove any already-outgoing layers
      stage.querySelectorAll('.title-layer.out').forEach((el) => el.remove());

      const prevLayer = stage.querySelector('.title-layer.in') as HTMLElement | null;
      if (prevLayer) {
        prevLayer.classList.remove('in');
        prevLayer.classList.add('out');
        const oldChars = Array.from(prevLayer.querySelectorAll('.title-char')) as HTMLElement[];
        const outY = dir >= 0 ? '-110%' : '110%';
        oldChars.forEach((ch, idx) => {
          ch.getAnimations().forEach((a) => a.cancel());
          ch.animate(
            [
              { transform: 'translateY(0%)', opacity: 1 },
              { transform: `translateY(${outY})`, opacity: 0 },
            ],
            {
              duration: 300,
              delay: idx * 11,
              easing: 'cubic-bezier(.45,0,.75,.3)',
              fill: 'forwards',
            },
          );
        });
        window.setTimeout(() => {
          prevLayer.remove();
        }, 320 + oldChars.length * 11);
      }

      const { layer: newLayer, chars: newChars } = renderTitleWordSpans(newName, 'in');
      stage.appendChild(newLayer);
      const inY = dir >= 0 ? '110%' : '-110%';
      newChars.forEach((ch, idx) => {
        ch.animate(
          [
            { transform: `translateY(${inY})`, opacity: 0 },
            { transform: 'translateY(0%)', opacity: 1 },
          ],
          {
            duration: 620,
            delay: 120 + idx * 22,
            easing: 'cubic-bezier(.22,1,.36,1)',
            fill: 'both',
          },
        );
      });
    },
    [reducedMotion, renderTitleWordSpans, updateTitleSize],
  );

  // Counter soft crossfade
  const animateCounterSwap = useCallback(
    (newFlavourIdx: number, instant = false) => {
      const nextStr = `0${newFlavourIdx + 1}`;
      const el = countRef.current;
      if (!el || instant || reducedMotion) {
        setHeroCounterText(nextStr);
        return;
      }

      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { translate: '0 0', opacity: 1 },
          { translate: '0 -10px', opacity: 0 },
        ],
        {
          duration: 220,
          easing: 'cubic-bezier(.5,0,.75,0)',
          fill: 'forwards',
        },
      );

      window.setTimeout(() => {
        setHeroCounterText(nextStr);
        el.animate(
          [
            { translate: '0 14px', opacity: 0 },
            { translate: '0 0', opacity: 1 },
          ],
          {
            duration: 380,
            easing: 'cubic-bezier(.22,1,.36,1)',
          },
        );
      }, 60);
    },
    [reducedMotion],
  );

  // Soft crossfade for Section 2 headline, outline number, and caption
  const triggerInsideTextSwap = useCallback(
    (nextStep: number, flavIdx: number, delayMs: number) => {
      if (textSwapTimerRef.current) clearTimeout(textSwapTimerRef.current);
      if (textFinishTimerRef.current) clearTimeout(textFinishTimerRef.current);

      const stepData = INSIDE_STEPS[nextStep];
      const flavWords = FLAVOURS[flavIdx].name.toUpperCase().split(' ');
      const payload = {
        num: stepData.num,
        head: nextStep === 3 ? flavWords : stepData.head,
        cap: stepData.cap,
        isFlavourStep: nextStep === 3,
      };

      if (reducedMotion) {
        setStepDisplay(payload);
        return;
      }

      const targets = [inHeadRef.current, inNumRef.current, inCapRef.current].filter(
        Boolean,
      ) as HTMLElement[];

      const runSwap = () => {
        targets.forEach((el) => {
          el.getAnimations().forEach((a) => a.cancel());
          el.animate(
            [
              { translate: '0 0', opacity: 1 },
              { translate: '0 -10px', opacity: 0 },
            ],
            {
              duration: 240,
              easing: 'cubic-bezier(.5,0,.75,0)',
              fill: 'forwards',
            },
          );
        });

        textFinishTimerRef.current = window.setTimeout(() => {
          setStepDisplay(payload);
          targets.forEach((el) => {
            el.getAnimations().forEach((a) => a.cancel());
            el.animate(
              [
                { translate: '0 14px', opacity: 0 },
                { translate: '0 0', opacity: 1 },
              ],
              {
                duration: 460,
                easing: 'cubic-bezier(.22,1,.36,1)',
              },
            );
          });
        }, 40);
      };

      if (delayMs <= 0) {
        runSwap();
      } else {
        textSwapTimerRef.current = window.setTimeout(runSwap, delayMs);
      }
    },
    [reducedMotion],
  );

  // Finish any running feathered circle reveal immediately
  const finishRevealNow = useCallback(() => {
    const rev = revealAnimRef.current;
    if (!rev.active) return;
    rev.active = false;
    document.documentElement.style.setProperty('--flav', rev.color);
    const rvEl = revealRef.current;
    if (rvEl) {
      rvEl.style.setProperty('--rv', 'transparent');
      rvEl.style.maskImage = '';
      rvEl.style.webkitMaskImage = '';
    }
  }, []);

  // Trigger flavour change UI + colour reveal
  const applyFlavourChange = useCallback(
    (newFlavourIdx: number, dir: number, instant = false) => {
      if (newFlavourIdx === activeFlavourRef.current) return;
      activeFlavourRef.current = newFlavourIdx;
      setActiveFlavour(newFlavourIdx);

      const newColor = FLAVOURS[newFlavourIdx].color;
      if (instant || reducedMotion) {
        finishRevealNow();
        document.documentElement.style.setProperty('--flav', newColor);
      } else {
        finishRevealNow();
        revealAnimRef.current = {
          active: true,
          start: performance.now(),
          color: newColor,
        };
        if (revealRef.current) {
          revealRef.current.style.setProperty('--rv', newColor);
        }
      }

      animateTitleSwap(newFlavourIdx, dir, instant);
      animateCounterSwap(newFlavourIdx, instant);

      if (stepRef.current === 3) {
        triggerInsideTextSwap(3, newFlavourIdx, 0);
      }
    },
    [
      animateCounterSwap,
      animateTitleSwap,
      finishRevealNow,
      reducedMotion,
      triggerInsideTextSwap,
    ],
  );

  // Slide arc to target index
  const goTo = useCallback(
    (newTarget: number, customDuration?: number, instant = false) => {
      lastInteractionRef.current = performance.now();
      const oldTarget = targetRef.current;
      targetRef.current = newTarget;
      const dir = newTarget >= oldTarget ? 1 : -1;
      const nf = ((newTarget % 5) + 5) % 5;

      if (instant || reducedMotion) {
        slideRef.current.active = false;
        posRef.current = newTarget;
        applyFlavourChange(nf, dir, true);
        return;
      }

      const slots = Math.abs(newTarget - posRef.current);
      const dur = customDuration ?? 650 + Math.max(0, slots - 1) * 160;

      slideRef.current = {
        active: true,
        from: posRef.current,
        to: newTarget,
        start: performance.now(),
        dur,
        easeFn: GLIDE_EASE,
        flavourFired: false,
        dir,
      };
    },
    [applyFlavourChange, reducedMotion],
  );

  // Hero entrance animation
  const enterHero = useCallback(() => {
    if (introEnteredRef.current) return;
    introEnteredRef.current = true;
    document.body.classList.remove('locked');
    setIntroPhase('leaving');
    window.setTimeout(() => setIntroPhase('done'), 360);
    setEntered(true);
    lastInteractionRef.current = performance.now();

    if (!reducedMotion) {
      posRef.current = -2.6;
      targetRef.current = 1;
      slideRef.current = {
        active: true,
        from: -2.6,
        to: 1,
        start: performance.now(),
        dur: 1700,
        easeFn: HERO_ENTRANCE_EASE,
        flavourFired: true,
        dir: 1,
      };

      // Fade in & drift hero bits
      bitsRef.current.forEach((el, i) => {
        if (!el) return;
        el.animate(
          [
            { opacity: 0 },
            { opacity: 0.6 },
          ],
          {
            duration: 900,
            delay: 300 + 90 * i,
            easing: 'ease-out',
            fill: 'forwards',
          },
        );

        const dx = (i % 2 === 0 ? 1 : -1) * (12 + (i % 3));
        const dy = -(22 + 3 * i);
        const rot = (i % 2 === 0 ? 1 : -1) * (10 + (i % 3));
        el.animate(
          [
            { transform: 'translate(0px, 0px) rotate(0deg)' },
            { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)` },
            { transform: 'translate(0px, 0px) rotate(0deg)' },
          ],
          {
            duration: 7000 + 900 * i,
            iterations: Infinity,
            easing: 'ease-in-out',
            composite: 'add',
          },
        );
      });
    }
  }, [reducedMotion]);

  // Initial title setup + font load re-measure
  useEffect(() => {
    animateTitleSwap(1, 1, true);
    document.fonts.ready.then(() => {
      updateTitleSize(activeFlavourRef.current);
      updatePillHighlight(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intro playback sequence
  useEffect(() => {
    if (reducedMotion) {
      document.body.classList.remove('locked');
      return;
    }

    let stampShown = false;
    let tPlaybackFallback: number | undefined;
    let tStampHold: number | undefined;
    let tFailsafe: number | undefined;

    const showStamp = () => {
      if (stampShown || introEnteredRef.current) return;
      stampShown = true;
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {
          // ignore
        }
      }
      setIntroPhase('stamp');
      tStampHold = window.setTimeout(() => {
        enterHero();
      }, 380 + 650);
    };

    tFailsafe = window.setTimeout(() => {
      enterHero();
    }, 9000);

    const v = videoRef.current;
    let started = false;

    const startPlayback = () => {
      if (!v || started || stampShown || introEnteredRef.current) return;
      started = true;
      try {
        v.currentTime = 0.55;
      } catch {
        // ignore
      }
      v.play().catch(() => {
        showStamp();
      });
    };

    tPlaybackFallback = window.setTimeout(() => {
      if (!started || (v && v.paused && v.currentTime < 0.6)) {
        showStamp();
      }
    }, 3500);

    const onCanPlay = () => startPlayback();
    const onTimeUpdate = () => {
      if (v && v.currentTime >= 4.6) {
        showStamp();
      }
    };
    const onEnded = () => showStamp();
    const onError = () => showStamp();

    if (v) {
      if (v.readyState >= 3) {
        startPlayback();
      } else {
        v.addEventListener('canplay', onCanPlay);
      }
      v.addEventListener('timeupdate', onTimeUpdate);
      v.addEventListener('ended', onEnded);
      v.addEventListener('error', onError);
    }

    return () => {
      if (tPlaybackFallback) clearTimeout(tPlaybackFallback);
      if (tStampHold) clearTimeout(tStampHold);
      if (tFailsafe) clearTimeout(tFailsafe);
      if (v) {
        v.removeEventListener('canplay', onCanPlay);
        v.removeEventListener('timeupdate', onTimeUpdate);
        v.removeEventListener('ended', onEnded);
        v.removeEventListener('error', onError);
      }
    };
  }, [enterHero, reducedMotion]);

  // Smooth scroll helper for nav & section 2 icons
  const smoothScrollTo = useCallback(
    (yTarget: number) => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const clamped = clamp(yTarget, 0, maxScroll);
      if (reducedMotion || window.matchMedia('(pointer: coarse)').matches) {
        window.scrollTo({ top: clamped, behavior: reducedMotion ? 'auto' : 'smooth' });
        return;
      }
      smoothScrollRef.current = {
        active: true,
        cur: window.scrollY,
        target: clamped,
      };
    },
    [reducedMotion],
  );

  // Desktop smooth wheel scrolling + keyboard arrow controls
  useEffect(() => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;

    const onWheel = (e: WheelEvent) => {
      if (reducedMotion || isTouch || document.body.classList.contains('locked')) return;
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      // Allow horizontal strip scroll if wheeling horizontally
      e.preventDefault();
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (!smoothScrollRef.current.active) {
        smoothScrollRef.current.cur = window.scrollY;
        smoothScrollRef.current.target = window.scrollY;
        smoothScrollRef.current.active = true;
      }
      smoothScrollRef.current.target = clamp(
        smoothScrollRef.current.target + e.deltaY,
        0,
        maxScroll,
      );
    };

    const cancelSmoothScroll = () => {
      if (smoothScrollRef.current.active) {
        smoothScrollRef.current.active = false;
        smoothScrollRef.current.cur = window.scrollY;
        smoothScrollRef.current.target = window.scrollY;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const hero = heroRef.current;
        if (hero) {
          const r = hero.getBoundingClientRect();
          if (r.bottom >= r.height * 0.5) {
            e.preventDefault();
            goTo(targetRef.current + (e.key === 'ArrowRight' ? 1 : -1));
            return;
          }
        }
      }
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) {
        cancelSmoothScroll();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', cancelSmoothScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', cancelSmoothScroll);
    };
  }, [goTo, reducedMotion]);

  // Nav pill highlight measurement
  const updatePillHighlight = useCallback((idx: number) => {
    const link = navLinkRefs.current[idx];
    const pill = navPillRef.current;
    if (!link || !pill) return;
    setPillHi({
      left: link.offsetLeft,
      width: link.offsetWidth,
    });
  }, []);

  const activeNavIdxRef = useRef(0);
  useEffect(() => {
    activeNavIdxRef.current = activeNavIdx;
    updatePillHighlight(activeNavIdx);
  }, [activeNavIdx, updatePillHighlight]);

  // Intersection observers for Shop & Builder reveals + Builder auto-fill
  useEffect(() => {
    const shopEl = shopRef.current;
    const rangeEl = rangeRef.current;
    if (!shopEl || !rangeEl) return;

    const shopObs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShopRevealed(true);
          shopObs.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    shopObs.observe(shopEl);

    const rangeObs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRangeRevealed(true);
          if (!packTouchedRef.current && !autoFilledRef.current) {
            autoFilledRef.current = true;
            const base = activeFlavourRef.current;
            const seq = [base, (base + 1) % 5, (base + 2) % 5];
            [250, 410, 570].forEach((delay, slotIdx) => {
              window.setTimeout(() => {
                if (packTouchedRef.current) return;
                const flav = seq[slotIdx];
                setPack((prev) => {
                  const next = [...prev];
                  next[slotIdx] = flav;
                  return next;
                });
                setGlowColor(hexToRgba(FLAVOURS[flav].color, 0.72));
                if (glowRef.current && !reducedMotion) {
                  glowRef.current.animate([{ opacity: 0.55 }, { opacity: 1 }], {
                    duration: 600,
                    easing: 'ease-out',
                  });
                }
              }, delay);
            });
          }
          rangeObs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    rangeObs.observe(rangeEl);

    return () => {
      shopObs.disconnect();
      rangeObs.disconnect();
    };
  }, [reducedMotion]);

  // Main 3D + Scroll + Storm + Traveller rAF loop
  useEffect(() => {
    const canvas = document.getElementById('gl') as HTMLCanvasElement | null;
    if (!canvas) return;

    let disposed = false;
    let rafId = 0;
    let lastNow = performance.now();

    const syncScaleVar = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const k = w < 820 ? Math.min(w / 390, h / 780) : Math.min(w / 1440, h / 900);
      document.documentElement.style.setProperty('--k', String(k));
    };
    syncScaleVar();

    const onResize = () => {
      syncScaleVar();
      engineRef.current?.setViewport(window.innerWidth, window.innerHeight);
      updateTitleSize(activeFlavourRef.current);
      updatePillHighlight(activeNavIdxRef.current);
    };
    window.addEventListener('resize', onResize);

    initBar3DEngine(canvas, SHEET_URL).then((engine) => {
      if (disposed) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;
      document.body.classList.add('gl');
      engine.setViewport(window.innerWidth, window.innerHeight);
    });

    const arcState = (j: number, curPos: number, now: number, vw: number, heroH: number): BarState => {
      const k = j - curPos;
      const ak = Math.min(Math.abs(k), 4);
      const i0 = Math.floor(ak);
      const i1 = Math.min(4, i0 + 1);
      const f = ak - i0;

      const s0 = SLOTS[i0];
      const s1 = SLOTS[i1];
      const dx = lerp(s0[0], s1[0], f);
      const dy = lerp(s0[1], s1[1], f);
      const bh = lerp(s0[2], s1[2], f);
      const rzBase = lerp(s0[3], s1[3], f);
      const ryBase = lerp(s0[4], s1[4], f);

      const isPhone = vw < 820;
      const u = isPhone ? Math.min(vw / 560, heroH / 980) : Math.min(vw / 1440, heroH / 900);
      const cx = vw / 2;
      const cy = isPhone ? 0.4 * heroH : heroH / 2 - 78 * u;
      const xSpread = isPhone ? 1.02 : 1;
      const sgn = k < 0 ? -1 : 1;

      let x = cx + sgn * dx * u * xSpread;
      let y = cy + dy * u;
      let rz = sgn * rzBase;
      const ry = sgn * ryBase;
      const z = -ak * 34 * u;
      const op = ak <= 3.3 ? 1 : clamp(1 - (ak - 3.3) / 0.6, 0, 1);

      if (!reducedMotion) {
        const b = Math.sin((now / 4600) * Math.PI * 2 + 1.37 * j);
        y -= (0.5 * b + 0.5) * 9 * u;
        rz += 0.4 * b;
      }

      return {
        x,
        y,
        h: bh * u,
        rz,
        ry,
        rx: 0,
        z,
        op,
        sx: 1,
        sy: 1,
        shadow: 1,
      };
    };

    const tick = (now: number) => {
      const dt = Math.min(64, Math.max(1, now - lastNow));
      lastNow = now;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // 1. Desktop smooth scrolling
      if (smoothScrollRef.current.active) {
        const ss = smoothScrollRef.current;
        ss.cur += (ss.target - ss.cur) * (1 - Math.exp(-dt / 120));
        window.scrollTo(0, ss.cur);
        if (Math.abs(ss.target - ss.cur) < 0.5) {
          window.scrollTo(0, ss.target);
          ss.active = false;
        }
      }

      // 2. Slide tween
      const slide = slideRef.current;
      if (slide.active) {
        const t = clamp((now - slide.start) / slide.dur, 0, 1);
        const e = slide.easeFn(t);
        posRef.current = lerp(slide.from, slide.to, e);
        if (!slide.flavourFired && t >= 0.12) {
          slide.flavourFired = true;
          const nf = ((slide.to % 5) + 5) % 5;
          applyFlavourChange(nf, slide.dir, false);
        }
        if (t >= 1) {
          posRef.current = slide.to;
          slide.active = false;
        }
      }

      // 3. Colour reveal feathered circle
      const rev = revealAnimRef.current;
      const heroEl = heroRef.current;
      const heroH = heroEl ? heroEl.clientHeight : vh;
      if (rev.active && revealRef.current) {
        const t = clamp((now - rev.start) / 420, 0, 1);
        const e = GLIDE_EASE(t);
        const isPhone = vw < 820;
        const u = isPhone ? Math.min(vw / 560, heroH / 980) : Math.min(vw / 1440, heroH / 900);
        const cx = vw / 2;
        const cy = isPhone ? 0.4 * heroH : heroH / 2 - 78 * u;
        const maxDist = Math.max(
          Math.hypot(cx, cy),
          Math.hypot(vw - cx, cy),
          Math.hypot(cx, heroH - cy),
          Math.hypot(vw - cx, heroH - cy),
        );
        const R = 1.45 * maxDist;
        const r = R * e;
        const f = Math.max(60, 0.35 * r);
        const mask = `radial-gradient(circle at ${cx}px ${cy}px, #000 ${r - f}px, transparent ${r}px)`;
        revealRef.current.style.maskImage = mask;
        revealRef.current.style.webkitMaskImage = mask;
        if (t >= 1) {
          finishRevealNow();
        }
      }

      // 4. Autoplay timer
      if (
        autoplayRef.current &&
        enteredRef.current &&
        !dragRef.current.down &&
        !slideRef.current.active &&
        document.visibilityState === 'visible' &&
        heroEl
      ) {
        const hr = heroEl.getBoundingClientRect();
        const visibleRatio = clamp((Math.min(hr.bottom, vh) - Math.max(hr.top, 0)) / Math.max(1, hr.height), 0, 1);
        if (visibleRatio >= 0.6 && now - lastInteractionRef.current >= 3200) {
          goTo(targetRef.current + 1);
        }
      }

      // 5. Nav active link & theme tracking
      const sections = [
        heroRef.current,
        insideRef.current,
        shopRef.current,
        rangeRef.current,
      ];
      let navIdx = 0;
      const thresholdY = vh * 0.35;
      sections.forEach((sec, idx) => {
        if (sec && sec.getBoundingClientRect().top <= thresholdY) {
          navIdx = idx;
        }
      });
      setActiveNavIdx((prev) => (prev === navIdx ? prev : navIdx));

      const rangeRect = rangeRef.current?.getBoundingClientRect();
      const shopRect = shopRef.current?.getBoundingClientRect();
      let nextTheme: 'default' | 'light' | 'dark' = 'default';
      if (rangeRect && rangeRect.top <= 60) {
        nextTheme = 'dark';
      } else if (shopRect && shopRect.top <= 60 && (!rangeRect || rangeRect.top > 60)) {
        nextTheme = 'light';
      }
      setNavTheme((prev) => (prev === nextTheme ? prev : nextTheme));

      // 6. Section 2 pin, flip, and storm
      const insideEl = insideRef.current;
      const inFrontEl = inFrontRef.current;
      let p1 = 0;
      let p3 = 0;
      let stormRy = 0;

      if (insideEl && inFrontEl) {
        const ir = insideEl.getBoundingClientRect();
        const pinH = inFrontEl.clientHeight || vh;
        const inView = ir.bottom > 0 && ir.top < vh;
        inFrontEl.style.visibility = inView ? 'visible' : 'hidden';

        if (inView) {
          const pinY = ir.top > 0 ? ir.top : ir.bottom < pinH ? ir.bottom - pinH : 0;
          inFrontEl.style.transform = `translate3d(0, ${pinY}px, 0)`;
        }

        const p = clamp(-ir.top / Math.max(1, ir.height - pinH), 0, 1);
        const step = Math.floor(Math.min(p, 0.759) / 0.19);
        const q = clamp((p - 0.76) / 0.24, 0, 1);

        if (step !== stepRef.current) {
          stepRef.current = step;
          setActiveStep(step);

          const targetRy = INSIDE_STEPS[step].ry;
          const startRy = flipRef.current.cur;
          if (reducedMotion) {
            flipRef.current = { active: false, from: targetRy, to: targetRy, cur: targetRy, start: now, dur: 0 };
            triggerInsideTextSwap(step, activeFlavourRef.current, 0);
          } else {
            const halfTurns = clamp(Math.abs(targetRy - startRy) / 180, 0.4, 2);
            const dur = 720 * halfTurns;
            flipRef.current = {
              active: true,
              from: startRy,
              to: targetRy,
              cur: startRy,
              start: now,
              dur,
            };
            triggerInsideTextSwap(step, activeFlavourRef.current, 0.38 * Math.min(dur, 720));
          }
        }

        if (flipRef.current.active) {
          const fl = flipRef.current;
          const ft = clamp((now - fl.start) / Math.max(1, fl.dur), 0, 1);
          fl.cur = lerp(fl.from, fl.to, easeInOutSine(ft));
          if (ft >= 1) {
            fl.cur = fl.to;
            fl.active = false;
          }
        }

        // Storm effects
        const uiFade = 1 - clamp(4 * q, 0, 1);
        if (inFrontFrameRef.current) {
          inFrontFrameRef.current.style.opacity = String(uiFade);
        }
        if (inNumRef.current) {
          inNumRef.current.style.opacity = String(uiFade);
        }
        if (inDarkRef.current) {
          inDarkRef.current.style.opacity = String(clamp(3.5 * q, 0, 1) * 0.42);
        }

        stormRy = reducedMotion ? 0 : 720 * q;

        // 20 storm pieces
        const R = 0.55 * Math.hypot(vw, vh);
        const baseSize = 0.085 * Math.min(vw, vh);
        const flavBit = FLAVOURS[activeFlavourRef.current].bit;

        for (let i = 0; i < 20; i++) {
          const el = stormPieceRefs.current[i];
          if (!el) continue;
          const meta = stormMeta[i];
          const s = clamp((q - 0.45 * meta.phase) / 0.55, 0, 1);
          if (q <= 0 || q >= 1 || s <= 0 || s >= 1 || reducedMotion) {
            el.style.opacity = '0';
            continue;
          }

          const bitIdx = meta.isFlavourBit ? flavBit : meta.fallbackBit;
          const spr = spriteStyle(BITS[bitIdx], 0);
          el.style.backgroundSize = spr.backgroundSize;
          el.style.backgroundPosition = spr.backgroundPosition;

          const radius = (0.06 + Math.pow(s, 1.5) * 0.95) * R;
          const px = vw / 2 + Math.cos(meta.angle) * radius;
          const py = vh / 2 + Math.sin(meta.angle) * radius * 0.8;
          const size = (0.2 + 1.7 * s) * baseSize * meta.sizeFactor;
          const rot = meta.spin * s;
          const op = Math.sin(Math.PI * s) * clamp(5 * q, 0, 1) * clamp(6 * (1 - q), 0, 1);

          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.transform = `translate3d(${px - size / 2}px, ${py - size / 2}px, 0) rotate(${rot}deg)`;
          el.style.opacity = String(op);
        }

        p1 = clamp(1 - ir.top / vh, 0, 1);
      }

      if (shopRect) {
        p3 = clamp((vh - shopRect.top) / (0.7 * vh), 0, 1);
      }

      // Mobile strip auto-center first time p3 rises above 0
      if (vw < 820 && p3 > 0 && !mobileCenteredRef.current) {
        mobileCenteredRef.current = true;
        const cardsEl = cardsRef.current;
        const liveCard = cardRefs.current[activeFlavourRef.current];
        if (cardsEl && liveCard) {
          const left = liveCard.offsetLeft - (cardsEl.clientWidth - liveCard.clientWidth) / 2;
          cardsEl.scrollTo({ left: Math.max(0, left), behavior: reducedMotion ? 'auto' : 'smooth' });
        }
      }

      // 7. Place 3D bars (pool + traveller)
      const engine = engineRef.current;
      if (engine && engine.ready) {
        const curPos = posRef.current;
        const jT = Math.round(targetRef.current);
        const heroBase = Math.floor(curPos) - 5;
        const otherFade = 1 - clamp(1.6 * p1, 0, 1);

        // Pool of 11 bars
        for (let slotIdx = 0; slotIdx < 11; slotIdx++) {
          const j = heroBase + slotIdx;
          if (j === jT) {
            engine.hidePoolBar(slotIdx);
            continue;
          }
          const st = arcState(j, curPos, now, vw, heroH);
          st.op *= otherFade;
          const flavIdx = ((j % 5) + 5) % 5;
          engine.placePoolBar(slotIdx, st, flavIdx, j);
        }

        // Traveller bar: Anchor A -> Anchor B -> Anchor C
        const flavT = ((jT % 5) + 5) % 5;
        const A = arcState(jT, curPos, now, vw, heroH);

        let state = A;
        if (p1 > 0 && inBarRef.current) {
          const br = inBarRef.current.getBoundingClientRect();
          const bob = reducedMotion ? 0 : Math.sin((now / 2600) * Math.PI * 2) * 6;
          const B: BarState = {
            x: br.left + br.width / 2,
            y: br.top + br.height / 2 + bob,
            h: br.height,
            rz: 14,
            ry: flipRef.current.cur + stormRy,
            rx: 0,
            z: 0,
            op: 1,
            sx: 1,
            sy: 1,
            shadow: 1,
          };
          state = lerpBarState(A, B, easeInOutSine(p1));

          if (p3 > 0) {
            const pkEl = pkRefs.current[flavT];
            if (pkEl) {
              const pr = pkEl.getBoundingClientRect();
              let pokeSx = 1;
              let pokeSy = 1;
              if (pokeRef.current.active && pokeRef.current.flavourIdx === flavT) {
                const pt = clamp((now - pokeRef.current.start) / 500, 0, 1);
                if (pt < 0.3) {
                  const u = pt / 0.3;
                  pokeSx = lerp(1, 1.06, u);
                  pokeSy = lerp(1, 0.93, u);
                } else if (pt < 0.6) {
                  const u = (pt - 0.3) / 0.3;
                  pokeSx = lerp(1.06, 0.97, u);
                  pokeSy = lerp(0.93, 1.04, u);
                } else {
                  const u = (pt - 0.6) / 0.4;
                  pokeSx = lerp(0.97, 1, u);
                  pokeSy = lerp(1.04, 1, u);
                }
                if (pt >= 1) pokeRef.current.active = false;
              }

              const C: BarState = {
                x: pr.left + pr.width / 2,
                y: pr.top + pr.height / 2,
                h: pr.height,
                rz: 0,
                ry: Math.round((flipRef.current.to + stormRy) / 360) * 360 + cardTiltRef.current.x * 14,
                rx: -cardTiltRef.current.y * 14,
                z: 30,
                op: 1,
                sx: pokeSx,
                sy: pokeSy,
                shadow: 0.7,
              };
              state = lerpBarState(state, C, easeInOutSine(p3));
            }
          }
        }

        engine.placeTraveller(state, flavT, jT);
        engine.render();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      if (textSwapTimerRef.current) clearTimeout(textSwapTimerRef.current);
      if (textFinishTimerRef.current) clearTimeout(textFinishTimerRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [
    applyFlavourChange,
    finishRevealNow,
    goTo,
    reducedMotion,
    stormMeta,
    triggerInsideTextSwap,
    updatePillHighlight,
    updateTitleSize,
  ]);

  // Hero arc pointer drag & click handlers
  const onArcPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    lastInteractionRef.current = performance.now();
    dragRef.current = {
      down: true,
      active: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      pos0: posRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
    };
  };

  const onArcPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const now = performance.now();

    if (!d.down) {
      if (e.pointerType === 'mouse' && engineRef.current && arcRef.current) {
        const hit = engineRef.current.raycastHeroBars(e.clientX, e.clientY);
        arcRef.current.style.cursor = hit !== null ? 'pointer' : 'grab';
      }
      return;
    }

    lastInteractionRef.current = now;
    const dx = e.clientX - d.startX;

    if (!d.active && Math.abs(dx) > 6) {
      d.active = true;
      slideRef.current.active = false;
      try {
        arcRef.current?.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      document.body.classList.add('dragging');
    }

    if (d.active) {
      const vw = window.innerWidth;
      const heroH = heroRef.current?.clientHeight || window.innerHeight;
      const isPhone = vw < 820;
      const u = isPhone ? Math.min(vw / 560, heroH / 980) : Math.min(vw / 1440, heroH / 900);
      const slotPx = 245 * u * (isPhone ? 1.02 : 1);

      const newPos = d.pos0 - dx / slotPx;
      const dt = Math.max(4, now - d.lastT);
      const sampleVel = (newPos - posRef.current) / dt;
      d.vel = lerp(d.vel, sampleVel, 0.4);
      d.lastX = e.clientX;
      d.lastT = now;
      posRef.current = newPos;
    }
  };

  const endArcDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current;
    if (!d.down) return;
    d.down = false;

    if (d.active) {
      d.active = false;
      document.body.classList.remove('dragging');
      try {
        arcRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const curPos = posRef.current;
      if (cancelled && Math.abs(curPos - Math.round(curPos)) <= 0.02) {
        return;
      }
      const to = Math.round(curPos + clamp(d.vel * 220, -2, 2));
      const snapDur = Math.max(380, 650 * Math.min(1, Math.abs(to - curPos) + 0.35));
      goTo(to, snapDur);
    } else if (!cancelled) {
      const hitIdx = engineRef.current?.raycastHeroBars(e.clientX, e.clientY) ?? null;
      if (hitIdx !== null) {
        const k = hitIdx - targetRef.current;
        if (k !== 0) {
          goTo(targetRef.current + k);
        }
      }
    }
  };

  // Fly to cart helper
  const flyToCart = useCallback(
    (sources: { rect: DOMRect; flavourIdx: number }[], onCompleteCount: () => void) => {
      if (reducedMotion) {
        onCompleteCount();
        return;
      }
      const basket = basketRef.current;
      if (!basket) {
        onCompleteCount();
        return;
      }
      const br = basket.getBoundingClientRect();
      const bx = br.left + br.width / 2;
      const by = br.top + br.height / 2;

      let remaining = sources.length;
      sources.forEach(({ rect: r, flavourIdx }, idx) => {
        const clone = document.createElement('div');
        const spr = spriteStyle(FLAVOURS[flavourIdx].box, 4);
        clone.className = 'spr';
        clone.style.position = 'fixed';
        clone.style.left = `${r.left}px`;
        clone.style.top = `${r.top}px`;
        clone.style.width = `${r.width}px`;
        clone.style.height = `${r.height}px`;
        clone.style.backgroundSize = spr.backgroundSize;
        clone.style.backgroundPosition = spr.backgroundPosition;
        clone.style.zIndex = '70';
        clone.style.pointerEvents = 'none';
        clone.style.filter = 'drop-shadow(0 10px 14px rgba(0,0,0,.25))';
        document.body.appendChild(clone);

        const dx = bx - (r.left + r.width / 2);
        const dy = by - (r.top + r.height / 2);
        const lift = Math.min(160, 0.35 * Math.abs(dy) + 60);
        const k = Math.min(0.2, 30 / Math.max(1, r.height));

        const anim = clone.animate(
          [
            {
              transform: 'translate3d(0,0,0) scale(1) rotate(0deg)',
              opacity: 1,
              offset: 0,
            },
            {
              transform: `translate3d(${0.4 * dx}px, ${0.4 * dy - lift}px, 0) scale(${0.45 + k}) rotate(-10deg)`,
              opacity: 1,
              offset: 0.45,
            },
            {
              transform: `translate3d(${dx}px, ${dy}px, 0) scale(${k}) rotate(-18deg)`,
              opacity: 0.15,
              offset: 1,
            },
          ],
          {
            duration: 900,
            delay: idx * 120,
            easing: 'cubic-bezier(.5,0,.2,1)',
            fill: 'forwards',
          },
        );

        anim.onfinish = () => {
          clone.remove();
          basket.animate(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.18)' },
              { transform: 'scale(1)' },
            ],
            { duration: 320, easing: 'ease-out' },
          );
          remaining -= 1;
          if (remaining === 0) {
            onCompleteCount();
          }
        };
      });
    },
    [reducedMotion],
  );

  const incrementCartBadge = useCallback(() => {
    setCartCount((c) => c + 1);
    window.setTimeout(() => {
      if (badgeRef.current && !reducedMotion) {
        badgeRef.current.animate(
          [
            { transform: 'scale(0)' },
            { transform: 'scale(1.5)', offset: 0.55 },
            { transform: 'scale(1)' },
          ],
          { duration: 350, easing: 'ease-out' },
        );
      }
    }, 0);
  }, [reducedMotion]);

  // Shop card handlers
  const onCardPointerMove = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const card = cardRefs.current[idx];
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transitionDelay = '0ms';
    card.style.transition = 'transform .15s, box-shadow .15s';
    card.style.transform = `translateY(-8px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg)`;
    card.style.boxShadow = '0 24px 40px -18px rgba(40,30,20,.35)';
    if (idx === activeFlavourRef.current) {
      cardTiltRef.current = { x, y };
    }
  };

  const onCardPointerLeave = (idx: number) => {
    const card = cardRefs.current[idx];
    if (!card) return;
    card.style.transitionDelay = '0ms';
    card.style.transition = 'transform .4s var(--ease), box-shadow .4s var(--ease)';
    card.style.transform = '';
    card.style.boxShadow = '';
    if (idx === activeFlavourRef.current) {
      cardTiltRef.current = { x: 0, y: 0 };
    }
  };

  const onCardPointerDown = (idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.card-add')) return;
    const card = cardRefs.current[idx];
    if (card) {
      card.style.transform = 'scale(0.97)';
    }
  };

  const onCardClick = (idx: number, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.card-add')) return;
    const card = cardRefs.current[idx];
    if (card) {
      card.style.transform = '';
    }
    if (reducedMotion) return;

    if (idx === activeFlavour) {
      pokeRef.current = { active: true, start: performance.now(), flavourIdx: idx };
    } else {
      const pk = pkRefs.current[idx];
      pk?.animate(
        [
          { transform: 'translateX(-50%) translateZ(30px) scale(1, 1)', offset: 0 },
          { transform: 'translateX(-50%) translateZ(30px) scale(1.06, 0.93)', offset: 0.3 },
          { transform: 'translateX(-50%) translateZ(30px) scale(0.97, 1.04)', offset: 0.6 },
          { transform: 'translateX(-50%) translateZ(30px) scale(1, 1)', offset: 1 },
        ],
        { duration: 500, easing: 'ease-out' },
      );
    }
  };

  const onCardAddClick = (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const pk = pkRefs.current[idx];
    if (!pk) {
      incrementCartBadge();
      return;
    }
    flyToCart([{ rect: pk.getBoundingClientRect(), flavourIdx: idx }], incrementCartBadge);
  };

  // Builder handlers
  const triggerGlowPulse = (flavIdx: number) => {
    setGlowColor(hexToRgba(FLAVOURS[flavIdx].color, 0.72));
    if (glowRef.current && !reducedMotion) {
      glowRef.current.animate([{ opacity: 0.55 }, { opacity: 1 }], {
        duration: 600,
        easing: 'ease-out',
      });
    }
  };

  const onThumbClick = (flavIdx: number) => {
    packTouchedRef.current = true;
    const emptyIdx = pack.findIndex((p) => p === null);
    if (emptyIdx === -1) return;
    const next = [...pack];
    next[emptyIdx] = flavIdx;
    setPack(next);
    triggerGlowPulse(flavIdx);
  };

  const onSlotRemove = (slotIdx: number) => {
    packTouchedRef.current = true;
    if (pack[slotIdx] === null) return;
    const next = [...pack];
    next[slotIdx] = null;
    setPack(next);
  };

  const filledCount = pack.filter((x) => x !== null).length;
  const remainingPick = 3 - filledCount;

  const onBuyClick = () => {
    if (remainingPick > 0 || buyStatus === 'added') return;
    packTouchedRef.current = true;
    const sources: { rect: DOMRect; flavourIdx: number }[] = [];
    pack.forEach((flavIdx, slotIdx) => {
      const el = slotBarRefs.current[slotIdx];
      if (el && flavIdx !== null) {
        sources.push({ rect: el.getBoundingClientRect(), flavourIdx: flavIdx });
      }
    });

    flyToCart(sources, incrementCartBadge);

    window.setTimeout(() => {
      setPack([null, null, null]);
      setBuyStatus('added');
      window.setTimeout(() => {
        setBuyStatus('idle');
      }, 1600);
    }, 60);
  };

  const scrollToSection = (e: React.MouseEvent, el: HTMLElement | null) => {
    e.preventDefault();
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top;
    smoothScrollTo(top);
  };

  const scrollToStep = (stepIdx: number) => {
    const inside = insideRef.current;
    if (!inside) return;
    const vh = window.innerHeight;
    const total = inside.offsetHeight - vh;
    const pMid = (stepIdx + 0.5) * 0.19;
    const y = window.scrollY + inside.getBoundingClientRect().top + pMid * total;
    smoothScrollTo(y);
  };

  return (
    <>
      {/* INTRO */}
      {introPhase !== 'done' && (
        <div
          id="intro"
          className={`${introPhase === 'stamp' || introPhase === 'leaving' ? 'cream' : ''} ${
            introPhase === 'leaving' ? 'leaving' : ''
          }`}
        >
          {introPhase === 'video' && (
            <video
              ref={videoRef}
              src={INTRO_VIDEO_URL}
              muted
              playsInline
              preload="auto"
            />
          )}
          {(introPhase === 'stamp' || introPhase === 'leaving') && (
            <div className="stamp">
              <BrandMark className="stamp-mark" />
              <span className="stamp-word">STRIDE</span>
            </div>
          )}
          <button
            type="button"
            className="skip"
            onClick={() => enterHero()}
          >
            Skip intro
          </button>
        </div>
      )}

      {/* NAV */}
      <nav
        className={`nav ${entered ? 'entered' : ''} ${
          navTheme === 'light' ? 'light' : navTheme === 'dark' ? 'dark' : ''
        }`}
      >
        <a
          href="#flavors"
          className="nav-brand"
          onClick={(e) => scrollToSection(e, heroRef.current)}
        >
          <BrandMark className="brand-mark" inverted={navTheme === 'dark'} />
          <span className="brand-word">STRIDE</span>
        </a>

        <div className="nav-pill" ref={navPillRef}>
          <div
            className="pill-hi"
            style={{ left: `${pillHi.left}px`, width: `${pillHi.width}px` }}
          />
          {[
            { label: 'Flavors', href: '#flavors', ref: heroRef },
            { label: 'Inside', href: '#inside', ref: insideRef },
            { label: 'Shop', href: '#shop', ref: shopRef },
            { label: 'Range', href: '#range', ref: rangeRef },
          ].map((item, idx) => (
            <a
              key={item.href}
              href={item.href}
              ref={(el) => {
                navLinkRefs.current[idx] = el;
              }}
              className={activeNavIdx === idx ? 'active' : ''}
              onClick={(e) => scrollToSection(e, item.ref.current)}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="nav-right">
          <button
            type="button"
            className="chip-off"
            onClick={(e) => scrollToSection(e, rangeRef.current)}
          >
            % OFF
          </button>
          <button
            ref={basketRef}
            type="button"
            className="chip-bag"
            aria-label="Shopping bag"
            onClick={(e) => scrollToSection(e, shopRef.current)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8h12l1 12H5L6 8Z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            {cartCount > 0 && (
              <span ref={badgeRef} className="bag-badge">
                {cartCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="chip-dibs"
            onClick={(e) => scrollToSection(e, rangeRef.current)}
          >
            First dibs
          </button>
        </div>
      </nav>

      {/* SECTION 1: HERO CAROUSEL */}
      <section id="flavors" ref={heroRef}>
        <div className="reveal" ref={revealRef} />
        <div className={`rings ${entered ? 'entered' : ''}`} />

        <div className="bits" aria-hidden="true">
          {HERO_BITS.map((b, i) => {
            const spr = spriteStyle(BITS[b.bit], 0);
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 820;
            if (isMobile && b.hideMobile) return null;
            return (
              <div
                key={i}
                ref={(el) => {
                  bitsRef.current[i] = el;
                }}
                className="bit spr"
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `calc(${b.size * (isMobile ? 1.3 : 1)} * var(--u))`,
                  height: `calc(${b.size * (isMobile ? 1.3 : 1)} * var(--u))`,
                  transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
                  backgroundSize: spr.backgroundSize,
                  backgroundPosition: spr.backgroundPosition,
                }}
              />
            );
          })}
        </div>

        <div
          className="arc"
          ref={arcRef}
          onPointerDown={onArcPointerDown}
          onPointerMove={onArcPointerMove}
          onPointerUp={(e) => endArcDrag(e, false)}
          onPointerCancel={(e) => endArcDrag(e, true)}
        />

        <button
          id="play"
          type="button"
          className={entered ? 'entered' : ''}
          aria-label="Next flavour"
          onClick={() => goTo(targetRef.current + 1)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>

        <h1
          id="title"
          className="disp"
          aria-live="polite"
          style={{ fontSize: `${titleFontSize}px` }}
        >
          <span className="title-stage" ref={titleStageRef} />
        </h1>

        <div id="count" ref={countRef} className={`disp ${entered ? 'entered' : ''}`}>
          {heroCounterText}
        </div>

        <button
          id="auto"
          type="button"
          className={entered ? 'entered' : ''}
          aria-pressed={autoplay}
          onClick={() => {
            lastInteractionRef.current = performance.now();
            setAutoplay((a) => !a);
          }}
        >
          <span className="auto-ring">
            {autoplay ? (
              <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
                <rect x="2.5" y="2" width="2.2" height="8" rx="1" />
                <rect x="7.3" y="2" width="2.2" height="8" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
                <path d="M3.2 2.2a.6.6 0 0 1 .9-.52l5.8 3.8a.6.6 0 0 1 0 1.04l-5.8 3.8a.6.6 0 0 1-.9-.52V2.2Z" />
              </svg>
            )}
          </span>
          <span className="auto-label">AUTOPLAY</span>
        </button>
      </section>

      {/* SECTION 2: INSIDE */}
      <section id="inside" ref={insideRef}>
        <div className="pin">
          <div className="in-dark" ref={inDarkRef} />
          <div className="in-frame in-back">
            <div className="in-num disp" ref={inNumRef}>
              {stepDisplay.num}
            </div>
            <div id="inBar" ref={inBarRef} />
          </div>
        </div>
      </section>

      {/* SECTION 2 FRONT LAYER (ABOVE CANVAS) */}
      <div id="inFront" ref={inFrontRef}>
        <div className="in-frame in-front" ref={inFrontFrameRef}>
          <h2 className="in-head disp" ref={inHeadRef}>
            {stepDisplay.head.map((word, wi) => (
              <span
                key={`${word}-${wi}`}
                style={
                  stepDisplay.isFlavourStep && word.length > 9
                    ? { fontSize: '0.72em' }
                    : undefined
                }
              >
                {word}
              </span>
            ))}
          </h2>

          <div className="in-icons">
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                type="button"
                className={`in-ico ${activeStep === idx ? 'active' : ''}`}
                aria-label={`Step 0${idx + 1}`}
                onClick={() => scrollToStep(idx)}
              >
                <StepIcon idx={idx} />
              </button>
            ))}
          </div>

          <p className="in-cap" ref={inCapRef}>
            {stepDisplay.cap.map((line, li) => (
              <span key={li}>{line}</span>
            ))}
          </p>
        </div>

        <div className="storm" aria-hidden="true">
          {stormMeta.map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                stormPieceRefs.current[i] = el;
              }}
              className="storm-piece spr"
            />
          ))}
        </div>
      </div>

      {/* SECTION 3: SHOP */}
      <section id="shop" ref={shopRef} className={shopRevealed ? 'revealed' : ''}>
        <h2 className="shop-head disp">
          <span className="reveal-line">
            <span>GRAB</span>
          </span>
          <span className="reveal-line d2">
            <span>A BAG</span>
          </span>
        </h2>

        <p className="shop-cap">
          Five bold flavours. Same real ingredients. Pick your favourite (or try them all).
        </p>

        <div className="cards" ref={cardsRef}>
          {FLAVOURS.map((flav, idx) => {
            const spr = spriteStyle(flav.box, 4);
            const isLive = idx === activeFlavour;
            return (
              <div
                key={flav.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className={`card ${isLive ? 'live' : ''}`}
                style={{
                  background: flav.color,
                  transitionDelay: shopRevealed ? `${idx * 80}ms` : '0ms',
                }}
                onPointerMove={(e) => onCardPointerMove(idx, e)}
                onPointerLeave={() => onCardPointerLeave(idx)}
                onPointerDown={(e) => onCardPointerDown(idx, e)}
                onClick={(e) => onCardClick(idx, e)}
              >
                <h3 className="card-name disp">
                  <span>{flav.shopLines[0]}</span>
                  <span>{flav.shopLines[1]}</span>
                </h3>
                <div
                  ref={(el) => {
                    pkRefs.current[idx] = el;
                  }}
                  className="pk spr"
                  style={{
                    backgroundSize: spr.backgroundSize,
                    backgroundPosition: spr.backgroundPosition,
                  }}
                />
                <button
                  type="button"
                  className="card-add"
                  aria-label={`Add a bag of ${flav.name} to the cart`}
                  onClick={(e) => onCardAddClick(idx, e)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 4: RANGE / BUILD YOUR 3 PACK */}
      <section id="range" ref={rangeRef} className={rangeRevealed ? 'revealed' : ''}>
        <div className="glow" ref={glowRef} style={{ '--g': glowColor } as React.CSSProperties}>
          {pack.map((flavIdx, slotIdx) => {
            const filled = flavIdx !== null;
            const spr = filled ? spriteStyle(FLAVOURS[flavIdx].box, 4) : null;
            return (
              <div
                key={slotIdx}
                className={`slot slot-${slotIdx} ${filled ? 'filled' : ''}`}
              >
                {filled && spr && (
                  <div
                    ref={(el) => {
                      slotBarRefs.current[slotIdx] = el;
                    }}
                    className="slot-bar spr"
                    style={{
                      backgroundSize: spr.backgroundSize,
                      backgroundPosition: spr.backgroundPosition,
                    }}
                  />
                )}
                <button
                  type="button"
                  className="slot-x"
                  aria-label={filled ? `Remove ${FLAVOURS[flavIdx].name} from slot ${slotIdx + 1}` : `Empty slot ${slotIdx + 1}`}
                  onClick={() => onSlotRemove(slotIdx)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        <div className="range-inner">
          <h2 className="range-head disp">
            <span className="reveal-line">
              <span>BUILD YOUR</span>
            </span>
            <span className="reveal-line d2">
              <span>
                <span className="range-3">3</span> PACK &amp;
              </span>
            </span>
            <span className="reveal-line d3">
              <span>SAVE $1.49</span>
            </span>
          </h2>

          <div className="thumbs">
            {FLAVOURS.map((flav, idx) => {
              const spr = spriteStyle(flav.box, 4);
              const countInPack = pack.filter((x) => x === idx).length;
              return (
                <button
                  key={flav.id}
                  type="button"
                  className="thumb"
                  onClick={() => onThumbClick(idx)}
                >
                  <span className="thumb-sq" style={{ background: flav.color }}>
                    <span
                      className="thumb-pk spr"
                      style={{
                        backgroundSize: spr.backgroundSize,
                        backgroundPosition: spr.backgroundPosition,
                      }}
                    />
                  </span>
                  <span className="thumb-name">{flav.name}</span>
                  <span className={`thumb-ring ${countInPack > 0 ? 'on' : ''}`}>
                    {countInPack === 1 ? '✓' : countInPack > 1 ? countInPack : ''}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            id="buy"
            type="button"
            disabled={remainingPick > 0 && buyStatus !== 'added'}
            className={buyStatus === 'added' ? 'added' : ''}
            onClick={onBuyClick}
          >
            {buyStatus === 'added' ? (
              <span>Added to cart</span>
            ) : remainingPick > 0 ? (
              <>
                <span>Pick {remainingPick} more</span>
                <span className="buy-price">$7.48</span>
              </>
            ) : (
              <>
                <span>Add to cart</span>
                <span className="buy-price">$7.48</span>
              </>
            )}
          </button>
        </div>
      </section>
    </>
  );
}
