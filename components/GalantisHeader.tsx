'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Instagram, MessageCircle, Phone } from 'lucide-react';
import {
  FEEDBACK_PRINTS,
  FeedbackPrint,
  computeClampedPhotoRotation,
  computeFeedbackCarouselItems,
} from '@/lib/infinite-grid';
import {
  SoundEffectType,
  detectFeedbackSlotStep,
  playUiSoundEffect,
  preloadCustomSoundsFromFolder,
} from '@/lib/sound-effects';

interface GalantisHeaderProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

type AccordionSection = 'about' | 'feedbacks' | null;

const MAX_PHOTO_ROTATION_DEG = 22;

export default function GalantisHeader({
  menuOpen,
  onToggleMenu,
}: GalantisHeaderProps) {
  const [activeSection, setActiveSection] = useState<AccordionSection>(null);
  const [feedbackPrints, setFeedbackPrints] = useState<FeedbackPrint[]>(FEEDBACK_PRINTS);
  const [soundLog, setSoundLog] = useState<{ last: string; count: number }>({
    last: 'none',
    count: 0,
  });

  const triggerSound = (type: SoundEffectType, velocityPxPerSec = 0) => {
    playUiSoundEffect(type, velocityPxPerSec);
    setSoundLog((prev) => ({ last: type, count: prev.count + 1 }));
  };

  // 3D Rotatable Photo state for "Sobre Mim"
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState<{ rotateX: number; rotateY: number }>({
    rotateX: 4,
    rotateY: -8,
  });
  const [isInteractingPhoto, setIsInteractingPhoto] = useState(false);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    startRx: number;
    startRy: number;
  } | null>(null);

  // Infinite 3D Feedback Carousel state
  const carouselStageRef = useRef<HTMLDivElement | null>(null);
  const [carouselState, setCarouselState] = useState<{
    scrollX: number;
    introProgress: number;
    stageWidth: number;
    hoveredSlot: number | null;
    tiltRx: number;
    tiltRy: number;
  }>({
    scrollX: 0,
    introProgress: 0,
    stageWidth: 440,
    hoveredSlot: null,
    tiltRx: 0,
    tiltRy: 0,
  });

  const carouselPhysicsRef = useRef<{
    scrollX: number;
    targetScrollX: number;
    vx: number;
    introProgress: number;
    isDragging: boolean;
    pointerId: number | null;
    lastX: number;
    lastT: number;
    lastStepSlot: number | null;
    rafId: number;
    running: boolean;
  }>({
    scrollX: 0,
    targetScrollX: 0,
    vx: 0,
    introProgress: 0,
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastT: 0,
    lastStepSlot: null,
    rafId: 0,
    running: false,
  });

  // Load 1:1 prints dynamically from /public/feedbacks and custom audio files from /public/sounds
  useEffect(() => {
    let mounted = true;
    preloadCustomSoundsFromFolder().catch(() => {});
    fetch('/api/feedbacks', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (mounted && Array.isArray(data?.feedbacks) && data.feedbacks.length > 0) {
          setFeedbackPrints(data.feedbacks);
        }
      })
      .catch(() => {
        // Keep default FEEDBACK_PRINTS
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Measure carousel stage width
  useEffect(() => {
    const updateWidth = () => {
      const w =
        carouselStageRef.current?.clientWidth || Math.min(window.innerWidth - 48, 768);
      setCarouselState((prev) => (prev.stageWidth === w ? prev : { ...prev, stageWidth: w }));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [activeSection, menuOpen]);

  // Run smooth 60fps carousel physics & left-to-right entrance animation when Feedbacks is open
  useEffect(() => {
    const phys = carouselPhysicsRef.current;

    if (!menuOpen || activeSection !== 'feedbacks') {
      cancelAnimationFrame(phys.rafId);
      phys.running = false;
      return;
    }

    // Reset entrance so every time Feedbacks is opened, it emerges from left to right
    phys.introProgress = 0;
    phys.scrollX = -48;
    phys.targetScrollX = 0;
    phys.vx = 110; // gentle left-to-right opening glide
    phys.isDragging = false;
    phys.lastStepSlot = null;

    let lastTime = performance.now();

    const checkAndPlayStepSound = (currentScrollX: number, stageW: number, vx: number) => {
      const cSize = stageW < 440 ? 228 : stageW < 680 ? 268 : 312;
      const cGap = stageW < 440 ? 16 : stageW < 680 ? 20 : 26;
      // Trigger tactile step click whenever carousel advances by half a card stride or crosses a card slot
      const stepDetection = detectFeedbackSlotStep(
        phys.lastStepSlot,
        currentScrollX,
        Math.round(cSize * 0.5),
        Math.round(cGap * 0.5)
      );
      phys.lastStepSlot = stepDetection.currentSlot;
      if (stepDetection.stepped) {
        triggerSound('feedback-step', vx);
      }
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.08, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      // Advance left-to-right entrance progress (0.0 -> 1.0)
      if (phys.introProgress < 1) {
        phys.introProgress = Math.min(1, phys.introProgress + dt * 1.45);
      }

      if (!phys.isDragging) {
        phys.targetScrollX += phys.vx * dt;
        const friction = Math.exp(-2.4 * dt);
        phys.vx *= friction;
        if (Math.abs(phys.vx) < 0.5) {
          phys.vx = 0;
        }
      }

      const alpha = 1 - Math.exp(-(phys.isDragging ? 20 : 14) * dt);
      phys.scrollX += (phys.targetScrollX - phys.scrollX) * alpha;
      if (
        !phys.isDragging &&
        phys.vx === 0 &&
        Math.abs(phys.targetScrollX - phys.scrollX) < 0.05
      ) {
        phys.scrollX = phys.targetScrollX;
      }

      const stageW =
        carouselStageRef.current?.clientWidth || Math.min(window.innerWidth - 48, 768);

      checkAndPlayStepSound(phys.scrollX, stageW, phys.vx);

      setCarouselState((prev) => ({
        ...prev,
        scrollX: phys.scrollX,
        introProgress: phys.introProgress,
        stageWidth: stageW,
      }));

      const stillAnimating =
        phys.introProgress < 1 ||
        phys.isDragging ||
        Math.abs(phys.vx) >= 0.5 ||
        Math.abs(phys.targetScrollX - phys.scrollX) >= 0.05;

      if (stillAnimating) {
        phys.rafId = requestAnimationFrame(tick);
      } else {
        phys.running = false;
      }
    };

    phys.running = true;
    phys.rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(phys.rafId);
      phys.running = false;
    };
  }, [menuOpen, activeSection]);

  const wakeCarouselLoop = () => {
    const phys = carouselPhysicsRef.current;
    if (phys.running) return;
    phys.running = true;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.08, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      if (phys.introProgress < 1) {
        phys.introProgress = Math.min(1, phys.introProgress + dt * 1.45);
      }

      if (!phys.isDragging) {
        phys.targetScrollX += phys.vx * dt;
        const friction = Math.exp(-2.4 * dt);
        phys.vx *= friction;
        if (Math.abs(phys.vx) < 0.5) {
          phys.vx = 0;
        }
      }

      const alpha = 1 - Math.exp(-(phys.isDragging ? 20 : 14) * dt);
      phys.scrollX += (phys.targetScrollX - phys.scrollX) * alpha;
      if (
        !phys.isDragging &&
        phys.vx === 0 &&
        Math.abs(phys.targetScrollX - phys.scrollX) < 0.05
      ) {
        phys.scrollX = phys.targetScrollX;
      }

      const stageW =
        carouselStageRef.current?.clientWidth || Math.min(window.innerWidth - 48, 768);
      const cSize = stageW < 440 ? 228 : stageW < 680 ? 268 : 312;
      const cGap = stageW < 440 ? 16 : stageW < 680 ? 20 : 26;
      const stepDetection = detectFeedbackSlotStep(
        phys.lastStepSlot,
        phys.scrollX,
        Math.round(cSize * 0.5),
        Math.round(cGap * 0.5)
      );
      phys.lastStepSlot = stepDetection.currentSlot;
      if (stepDetection.stepped) {
        triggerSound('feedback-step', phys.vx);
      }

      setCarouselState((prev) => ({
        ...prev,
        scrollX: phys.scrollX,
        introProgress: phys.introProgress,
      }));

      const stillAnimating =
        phys.introProgress < 1 ||
        phys.isDragging ||
        Math.abs(phys.vx) >= 0.5 ||
        Math.abs(phys.targetScrollX - phys.scrollX) >= 0.05;

      if (stillAnimating) {
        phys.rafId = requestAnimationFrame(tick);
      } else {
        phys.running = false;
      }
    };

    phys.rafId = requestAnimationFrame(tick);
  };

  // Toggle menu: play open/close sound and reset activeSection to null so menu opens with all items closed
  const handleToggleMenuClick = () => {
    triggerSound(menuOpen ? 'menu-close' : 'menu-open');
    setActiveSection(null);
    onToggleMenu();
  };

  const toggleSection = (section: Exclude<AccordionSection, null>) => {
    const isClosing = activeSection === section;
    triggerSound(isClosing ? 'accordion-close' : 'accordion-open');
    setActiveSection(isClosing ? null : section);
  };

  // Sobre Mim 3D Photo handlers
  const updateRotationFromPoint = (clientX: number, clientY: number) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (dragOriginRef.current) {
      const dx = (clientX - dragOriginRef.current.x) / (rect.width * 0.55);
      const dy = (clientY - dragOriginRef.current.y) / (rect.height * 0.55);
      const normX = dragOriginRef.current.startRy / MAX_PHOTO_ROTATION_DEG + dx;
      const normY = -dragOriginRef.current.startRx / MAX_PHOTO_ROTATION_DEG + dy;
      setRotation(computeClampedPhotoRotation(normX, normY, MAX_PHOTO_ROTATION_DEG));
    } else {
      const normX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((clientY - rect.top) / rect.height) * 2 - 1;
      setRotation(computeClampedPhotoRotation(normX, normY, MAX_PHOTO_ROTATION_DEG));
    }
  };

  const handlePhotoPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsInteractingPhoto(true);
    dragOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      startRx: rotation.rotateX,
      startRy: rotation.rotateY,
    };
  };

  const handlePhotoPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    updateRotationFromPoint(e.clientX, e.clientY);
  };

  const handlePhotoPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    dragOriginRef.current = null;
    setIsInteractingPhoto(false);
  };

  const handlePhotoPointerLeave = () => {
    if (!dragOriginRef.current) {
      setIsInteractingPhoto(false);
      setRotation({ rotateX: 4, rotateY: -8 });
    }
  };

  // Feedbacks 3D Carousel pointer & wheel handlers
  const handleCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const phys = carouselPhysicsRef.current;
    phys.isDragging = true;
    phys.pointerId = e.pointerId;
    phys.lastX = e.clientX;
    phys.lastT = performance.now();
    phys.targetScrollX = phys.scrollX;
    phys.vx = 0;
    wakeCarouselLoop();
  };

  const handleCarouselPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const phys = carouselPhysicsRef.current;

    if (phys.isDragging && phys.pointerId === e.pointerId) {
      const now = performance.now();
      const dx = e.clientX - phys.lastX;
      const dt = Math.max(0.008, (now - phys.lastT) / 1000);
      phys.targetScrollX += dx;
      const instVx = dx / dt;
      phys.vx = Math.max(-1800, Math.min(1800, phys.vx * 0.35 + instVx * 0.65));
      phys.lastX = e.clientX;
      phys.lastT = now;
      wakeCarouselLoop();
    }
  };

  const handleCarouselPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const phys = carouselPhysicsRef.current;
    if (phys.pointerId === e.pointerId) {
      phys.isDragging = false;
      phys.pointerId = null;
      if (performance.now() - phys.lastT > 140) {
        phys.vx = 0;
      } else {
        phys.vx *= 1.1;
      }
      wakeCarouselLoop();
    }
  };

  const handleCarouselWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const phys = carouselPhysicsRef.current;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    phys.targetScrollX -= delta * 0.85;
    phys.vx = -delta * 2.8;
    wakeCarouselLoop();
  };

  const handleCardPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    slotIndex: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const clamped = computeClampedPhotoRotation(nx, ny, MAX_PHOTO_ROTATION_DEG);
    setCarouselState((prev) => ({
      ...prev,
      hoveredSlot: slotIndex,
      tiltRx: clamped.rotateX,
      tiltRy: clamped.rotateY,
    }));
  };

  const handleCardPointerLeave = () => {
    setCarouselState((prev) =>
      prev.hoveredSlot === null
        ? prev
        : { ...prev, hoveredSlot: null, tiltRx: 0, tiltRy: 0 }
    );
  };

  const cardSize =
    carouselState.stageWidth < 440
      ? 228
      : carouselState.stageWidth < 680
      ? 268
      : 312;
  const cardGap =
    carouselState.stageWidth < 440
      ? 16
      : carouselState.stageWidth < 680
      ? 20
      : 26;
  const visibleFeedbackItems = computeFeedbackCarouselItems(
    carouselState.stageWidth,
    cardSize,
    cardGap,
    carouselState.scrollX,
    carouselState.introProgress,
    feedbackPrints
  );

  return (
    <>
      {/* Top Header Bar: Multi-stop smooth black gradient + GALANTIS logo + Rotating 3-dot triangle button */}
      <header
        aria-label="Galantis"
        className="fixed top-0 left-0 right-0 z-30 pointer-events-none h-32 md:h-40 flex items-start justify-between px-5 pt-4 md:px-8 md:pt-6"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.58) 32%, rgba(0,0,0,0.22) 68%, rgba(0,0,0,0) 100%)',
        }}
      >
        <h1 className="select-none flex items-start">
          <img
            src="/logo/logo.png"
            alt="GALANTIS"
            className="h-[84px] md:h-[120px] w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]"
          />
        </h1>

        <button
          type="button"
          onClick={handleToggleMenuClick}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          data-testid="menu-toggle-button"
          className="pointer-events-auto relative w-11 h-11 -mr-2 -mt-1 flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60 rounded-full"
        >
          <span
            data-testid="triangle-dots-icon"
            className="relative w-5 h-5 block transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            {/* Top vertex dot */}
            <span className="absolute top-[2px] left-1/2 -translate-x-1/2 w-[4.5px] h-[4.5px] rounded-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
            {/* Bottom-left vertex dot */}
            <span className="absolute bottom-[2.5px] left-[2px] w-[4.5px] h-[4.5px] rounded-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
            {/* Bottom-right vertex dot */}
            <span className="absolute bottom-[2.5px] right-[2px] w-[4.5px] h-[4.5px] rounded-full bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]" />
          </span>
        </button>
      </header>

      {/* Top-to-bottom feathered gradient veil + Collapsible Accordion Items + Always-Visible Social Icons */}
      <div
        data-testid="fullscreen-menu-overlay"
        data-open={menuOpen ? 'true' : 'false'}
        data-active-section={activeSection || 'none'}
        data-last-sound={soundLog.last}
        data-sound-count={String(soundLog.count)}
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-20 flex flex-col justify-between overflow-y-auto overflow-x-hidden pt-20 pb-6 px-5 sm:px-8 md:px-14 ${
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Tall 240vh feathered gradient curtain */}
        <div
          data-testid="menu-gradient-curtain"
          className="fixed top-0 left-0 right-0 h-[240vh] pointer-events-none transition-transform duration-800 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.93) 26%, rgba(0,0,0,0.82) 44%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.24) 76%, rgba(0,0,0,0.06) 90%, rgba(0,0,0,0) 100%)',
            transform: menuOpen
              ? 'translate3d(0, 0%, 0)'
              : 'translate3d(0, -100%, 0)',
          }}
        />

        {/* Main Menu Content Container: Generous sizing on PC (md/lg) + Two Collapsible Items + Always-Visible Social Icon Buttons */}
        <div
          data-testid="menu-content-container"
          className="relative z-10 w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-[720px] mx-auto my-auto flex flex-col gap-2.5 sm:gap-3.5 md:gap-4 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            opacity: menuOpen ? 1 : 0,
            filter: menuOpen ? 'blur(0px)' : 'blur(12px)',
            transform: menuOpen
              ? 'translate3d(0, 0px, 0) scale(1)'
              : 'translate3d(0, -16px, 0) scale(0.97)',
            transitionDelay: menuOpen ? '80ms' : '0ms',
          }}
        >
          {/* ACCORDION ITEM 1: SOBRE MIM */}
          <div className="w-full border-b border-white/15">
            <button
              type="button"
              onClick={() => toggleSection('about')}
              aria-expanded={activeSection === 'about'}
              data-testid="accordion-toggle-about"
              className="w-full py-3 sm:py-3.5 md:py-4 flex items-center justify-between text-left cursor-pointer group focus:outline-none"
            >
              <span
                className="text-white/90 group-hover:text-white uppercase tracking-[0.22em] text-[16px] sm:text-[19px] md:text-[23px] lg:text-[25px] font-normal transition-colors"
                style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                Sobre Mim
              </span>
              <ChevronDown
                className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white/60 group-hover:text-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  activeSection === 'about' ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            <div
              data-testid="accordion-panel-about"
              data-expanded={activeSection === 'about' ? 'true' : 'false'}
              className={`grid transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                activeSection === 'about'
                  ? 'grid-rows-[1fr] opacity-100 pb-5 md:pb-6 pt-1.5'
                  : 'grid-rows-[0fr] opacity-0 pb-0 pt-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div
                  data-testid="about-wrapping-container"
                  className="w-full text-white/90 text-[15px] sm:text-[17.5px] md:text-[20.5px] lg:text-[22px] leading-[1.68] font-normal text-justify"
                  style={{
                    fontFamily: 'var(--font-cormorant), Georgia, serif',
                    fontVariantNumeric: 'lining-nums tabular-nums',
                  }}
                >
                  {/* 3D Rotatable Photo in exact vertical 2:3 proportion floated on the left so text flows on its right, then wraps edge-to-edge below it */}
                  <div
                    ref={cardRef}
                    data-testid="about-3d-photo"
                    data-aspect="2:3"
                    data-rotate-x={String(rotation.rotateX)}
                    data-rotate-y={String(rotation.rotateY)}
                    data-max-deg={String(MAX_PHOTO_ROTATION_DEG)}
                    onPointerDown={handlePhotoPointerDown}
                    onPointerMove={handlePhotoPointerMove}
                    onPointerUp={handlePhotoPointerUp}
                    onPointerCancel={handlePhotoPointerUp}
                    onPointerLeave={handlePhotoPointerLeave}
                    role="img"
                    aria-label="Retrato 3D interativo de Julio Aparecido de Oliveira"
                    className="float-left mr-3.5 sm:mr-4 md:mr-6 mb-1.5 md:mb-2 w-[96px] h-[144px] sm:w-[116px] sm:h-[174px] md:w-[136px] md:h-[204px] lg:w-[144px] lg:h-[216px] aspect-[2/3] select-none touch-none cursor-grab active:cursor-grabbing"
                    style={{
                      perspective: '900px',
                      shapeOutside: 'margin-box',
                    }}
                  >
                    <div
                      className={`relative w-full h-full rounded-[10px] overflow-hidden border border-white/20 shadow-[0_16px_38px_rgba(0,0,0,0.85)] ${
                        isInteractingPhoto
                          ? 'transition-transform duration-75 ease-out'
                          : 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
                      }`}
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(${rotation.rotateX}deg) rotateY(${rotation.rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
                      }}
                    >
                      <Image
                        src="/logo/eu.jpg"
                        alt="Julio Aparecido de Oliveira"
                        fill
                        sizes="(max-width: 640px) 160px, 240px"
                        className="object-cover pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at ${
                            50 + rotation.rotateY * 1.6
                          }% ${
                            50 - rotation.rotateX * 1.6
                          }%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.0) 65%)`,
                        }}
                      />
                    </div>
                  </div>

                  <p>
                    Sou <strong className="text-white font-semibold">Julio Aparecido de Oliveira</strong>,
                    criado no Córrego das Pedras, zona rural de Santa Maria de Itabira, MG. Comecei
                    fotografando com o celular que tinha na mão, aprendendo na prática a trabalhar 100%
                    no modo manual. Montei meu primeiro estúdio num quartinho alugado em cima de um
                    restaurante e conquistei minha primeira câmera através de um consórcio. Quase
                    completando um ano de profissão, perdi minha mãe e precisei parar por um ano e meio.
                    Hoje estou de volta e sigo firme na fotografia.
                  </p>

                  <div className="clear-both" />
                </div>
              </div>
            </div>
          </div>

          {/* ACCORDION ITEM 2: FEEDBACKS (Larger Infinite 1:1 3D Carousel with Left-to-Right Entrance & Corner Blur) */}
          <div className="w-full border-b border-white/15">
            <button
              type="button"
              onClick={() => toggleSection('feedbacks')}
              aria-expanded={activeSection === 'feedbacks'}
              data-testid="accordion-toggle-feedbacks"
              className="w-full py-3 sm:py-3.5 md:py-4 flex items-center justify-between text-left cursor-pointer group focus:outline-none"
            >
              <span
                className="text-white/90 group-hover:text-white uppercase tracking-[0.22em] text-[16px] sm:text-[19px] md:text-[23px] lg:text-[25px] font-normal transition-colors"
                style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}
              >
                Feedbacks
              </span>
              <ChevronDown
                className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white/60 group-hover:text-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  activeSection === 'feedbacks' ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            <div
              data-testid="accordion-panel-feedbacks"
              data-expanded={activeSection === 'feedbacks' ? 'true' : 'false'}
              className={`grid transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                activeSection === 'feedbacks'
                  ? 'grid-rows-[1fr] opacity-100 pb-5 md:pb-6 pt-2'
                  : 'grid-rows-[0fr] opacity-0 pb-0 pt-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div
                  ref={carouselStageRef}
                  data-testid="feedbacks-3d-carousel"
                  data-card-size={String(cardSize)}
                  data-scroll-x={String(Math.round(carouselState.scrollX))}
                  data-intro-progress={String(Number(carouselState.introProgress.toFixed(2)))}
                  onPointerDown={handleCarouselPointerDown}
                  onPointerMove={handleCarouselPointerMove}
                  onPointerUp={handleCarouselPointerUp}
                  onPointerCancel={handleCarouselPointerUp}
                  onWheel={handleCarouselWheel}
                  className="relative w-full h-[252px] sm:h-[296px] md:h-[336px] lg:h-[348px] overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing rounded-[20px]"
                  style={{
                    perspective: '1100px',
                  }}
                >
                  {/* 3D Cylindrical Track of Larger 1:1 Feedback Prints */}
                  <div
                    className="relative w-full h-full flex items-center"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {visibleFeedbackItems.map((item) => {
                      const isHovered = carouselState.hoveredSlot === item.slotIndex;
                      const tiltX = isHovered ? carouselState.tiltRx : 2.5;
                      const tiltY = isHovered
                        ? item.carouselRotateY * 0.55 + carouselState.tiltRy
                        : item.carouselRotateY;

                      return (
                        <div
                          key={item.key}
                          data-testid="feedback-carousel-card"
                          data-slot={String(item.slotIndex)}
                          data-print-id={item.print.id}
                          onPointerMove={(e) => handleCardPointerMove(e, item.slotIndex)}
                          onPointerLeave={handleCardPointerLeave}
                          className="absolute top-1/2 left-0 aspect-square rounded-[16px] overflow-hidden border border-white/20 shadow-[0_18px_44px_rgba(0,0,0,0.88)] will-change-transform"
                          style={{
                            width: `${cardSize}px`,
                            height: `${cardSize}px`,
                            transformStyle: 'preserve-3d',
                            transform: `translate3d(${
                              item.centerX - cardSize * 0.5
                            }px, -50%, ${item.translateZ}px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) scale(${item.scale})`,
                            filter: item.blurPx > 0 ? `blur(${item.blurPx}px)` : 'none',
                            opacity: item.opacity,
                            zIndex: Math.round((1 - Math.abs(item.normX)) * 100),
                          }}
                        >
                          <Image
                            src={item.print.src}
                            alt={`Feedback ${item.printIndex + 1}`}
                            fill
                            sizes="(max-width: 640px) 280px, 420px"
                            className="object-cover pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                          {/* 3D Specular Sheen responding to rotation angle */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(circle at ${
                                50 + tiltY * 1.1
                              }% ${
                                50 - tiltX * 1.4
                              }%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.0) 68%)`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Rounded Corner Blur & Vignette Masks on Left and Right Carousel Edges */}
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-14 md:w-20 z-30 backdrop-blur-[3px]"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
                      maskImage: 'linear-gradient(90deg, black 0%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(90deg, black 0%, transparent 100%)',
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-14 md:w-20 z-30 backdrop-blur-[3px]"
                    style={{
                      background:
                        'linear-gradient(270deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)',
                      maskImage: 'linear-gradient(270deg, black 0%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(270deg, black 0%, transparent 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Always-Visible Two Icon-Only Social Buttons (WhatsApp & Instagram) */}
          <nav
            aria-label="Redes sociais e contato"
            className="flex items-center justify-center gap-6 md:gap-8 pt-3 md:pt-5"
          >
            <a
              href="https://wa.me/5531995977942"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              data-testid="menu-item-whatsapp"
              tabIndex={menuOpen ? 0 : -1}
              className="group relative w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border border-white/25 bg-white/5 hover:bg-white/15 hover:border-white/60 flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 stroke-[1.6]" />
              <Phone className="w-2.5 h-2.5 md:w-3 md:h-3 stroke-[2.2] absolute" />
            </a>

            <a
              href="https://instagram.com/galantis.photo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              data-testid="menu-item-instagram"
              tabIndex={menuOpen ? 0 : -1}
              className="group relative w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border border-white/25 bg-white/5 hover:bg-white/15 hover:border-white/60 flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <Instagram className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 stroke-[1.7]" />
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}
