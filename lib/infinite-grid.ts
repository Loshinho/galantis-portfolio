export interface PortfolioPhoto {
  id: string;
  src: string;
  aspectRatio: number; // width / height
  fallbackColorA: string;
  fallbackColorB: string;
  isPromoFrame?: boolean;
}

export interface PromoSlide {
  id: string;
  badge: string;
  headline: string;
  subheadline: string;
  detail: string;
}

export interface PromoBillboardState {
  activeSlideIndex: number;
  nextSlideIndex: number;
  slideProgress: number; // 0.0 -> 1.0 across full slide duration
  transitionProgress: number; // 0.0 while holding, 0.0 -> 1.0 during slide transition
}

export interface ColumnItemSpec {
  photoIndex: number;
  heightShare: number; // relative share of column period height
  usePromoFrame?: boolean;
}

export interface ColumnTrack {
  colIndex: number;
  xOffset: number; // start X within [0, totalPeriodWidth)
  width: number;
  verticalOffset: number; // stagger offset in px
  items: {
    itemIndex: number;
    photo: PortfolioPhoto;
    yOffset: number; // start Y within [0, totalPeriodHeight) before verticalOffset
    height: number;
  }[];
}

export interface PortfolioLayout {
  gap: number;
  totalPeriodWidth: number;
  totalPeriodHeight: number;
  initialPanX: number;
  initialPanY: number;
  columns: ColumnTrack[];
}

export interface VisibleTile {
  key: string;
  colIndex: number;
  itemIndex: number;
  wrapX: number;
  wrapY: number;
  photo: PortfolioPhoto;
  x: number;
  y: number;
  width: number;
  height: number;
  isActiveTile: boolean;
}

export interface KinematicsState {
  panX: number;
  panY: number;
  targetPanX: number;
  targetPanY: number;
  vx: number;
  vy: number;
  columnShiftOffset: number; // smoothed gesture-driven alternating vertical offset (px)
  columnShiftVelocity: number; // spring velocity for columnShiftOffset
  isDragging: boolean;
  isPressed: boolean;
  pressHoldTimer: number; // seconds remaining for quick tap/click zoom-out pulse
  menuOpen: boolean; // whether the fullscreen menu is open
  menuProgress: number; // 0.0 (closed) -> 1.0 (open) smooth transition progress
  zoomScale: number; // 1.0 idle, ~0.984 when pressed/clicked, ~0.76 when menu open
  tileScale: number; // 1.0 idle, ~0.991 per-tile subtle contraction on click/touch
  pressAmount: number; // 0.0 idle -> 1.0 pressed
  activeTileKey: string | null;
}

export interface CornerOpticsResult {
  r2: number;
  cornerWeight: number;
  zRecession: number;
  distortedNx: number;
  distortedNy: number;
  chromaticShiftPx: number;
}

export const ASPECT_RATIO_VERTICAL_2_3 = 2 / 3;
export const ASPECT_RATIO_HORIZONTAL_3_2 = 3 / 2;

/**
 * Normalizes any image width/height ratio to the photographer's standard 3:2 (horizontal)
 * or 2:3 (vertical) aspect ratio based on the image's orientation.
 */
export function normalizePhotoAspectRatio(rawRatio: number): number {
  if (!Number.isFinite(rawRatio) || rawRatio <= 0) {
    return ASPECT_RATIO_VERTICAL_2_3;
  }
  return rawRatio >= 1.0 ? ASPECT_RATIO_HORIZONTAL_3_2 : ASPECT_RATIO_VERTICAL_2_3;
}

export const PORTFOLIO_PHOTOS: PortfolioPhoto[] = [
  {
    id: 'photo-01',
    src: '/portfolio/photo-01.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#8a6236',
    fallbackColorB: '#3a2210',
  },
  {
    id: 'photo-02',
    src: '/portfolio/photo-02.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#5f676e',
    fallbackColorB: '#2b2018',
  },
  {
    id: 'photo-03',
    src: '/portfolio/photo-03.jpg',
    aspectRatio: ASPECT_RATIO_HORIZONTAL_3_2,
    fallbackColorA: '#4d4a3b',
    fallbackColorB: '#1d1c16',
  },
  {
    id: 'photo-04',
    src: '/portfolio/photo-04.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#9e352b',
    fallbackColorB: '#3c2930',
  },
  {
    id: 'photo-05',
    src: '/portfolio/photo-05.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#6b1d20',
    fallbackColorB: '#281210',
  },
  {
    id: 'photo-06',
    src: '/portfolio/photo-06.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#1d2424',
    fallbackColorB: '#090b0c',
  },
  {
    id: 'photo-07',
    src: '/portfolio/photo-07.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#8c4436',
    fallbackColorB: '#2e1e1a',
  },
  {
    id: 'photo-08',
    src: '/portfolio/photo-08.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#4a4a4a',
    fallbackColorB: '#141414',
  },
  {
    id: 'photo-09',
    src: '/portfolio/photo-09.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#704b35',
    fallbackColorB: '#22282e',
  },
  {
    id: 'photo-10',
    src: '/portfolio/photo-10.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#946b2d',
    fallbackColorB: '#1f3626',
  },
  {
    id: 'photo-11',
    src: '/portfolio/photo-11.jpg',
    aspectRatio: ASPECT_RATIO_HORIZONTAL_3_2,
    fallbackColorA: '#798994',
    fallbackColorB: '#4a555c',
  },
  {
    id: 'photo-12',
    src: '/portfolio/photo-12.jpg',
    aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
    fallbackColorA: '#7a5934',
    fallbackColorB: '#24180b',
  },
];

export const PROMO_NATAL_PHOTO: PortfolioPhoto = {
  id: 'promo-natal-2026',
  src: '__promo_natal_2026__',
  aspectRatio: ASPECT_RATIO_VERTICAL_2_3,
  fallbackColorA: '#540c10',
  fallbackColorB: '#180305',
  isPromoFrame: true,
};

export const PROMO_NATAL_SLIDES: PromoSlide[] = [
  {
    id: 'desconto-1-lote',
    badge: 'OFERTA DE NATAL',
    headline: '1º Lote com 35% OFF',
    subheadline: 'Pacotes a partir de R$ 290,00',
    detail: 'Todos os pacotes com brinde exclusivo!',
  },
  {
    id: 'sorteio-600',
    badge: 'SORTEIO ESPECIAL',
    headline: 'Concorra a R$ 600,00',
    subheadline: 'em créditos + 100% de reembolso',
    detail: 'do valor pago no seu ensaio de Natal',
  },
  {
    id: 'entrega-expressa',
    badge: 'ENTREGA EXPRESSA',
    headline: 'Fotos no Dia Seguinte!',
    subheadline: 'Suas fotos prontas em até 24h',
    detail: 'À vista ou em até 12x • Sinal de R$ 100',
  },
  {
    id: 'para-quem-ama',
    badge: 'PARA QUEM VOCÊ MAIS AMA',
    headline: 'Família, Casal & Crianças',
    subheadline: 'Amigos e Pets também participam',
    detail: 'Cenário iluminado exclusivo Galantis',
  },
];

/**
 * Computes the active slide index for the minimalist "Sessão Especial de Natal" frame.
 * Holds each slide for a comfortable reading duration (6.5s default) and switches directly
 * without sliding text animation.
 */
export function computePromoBillboardState(
  elapsedSeconds: number,
  slideDurationSeconds = 6.5
): PromoBillboardState {
  const safeDuration = Math.max(1.0, slideDurationSeconds);
  const safeElapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const count = PROMO_NATAL_SLIDES.length;

  const totalCycles = safeElapsed / safeDuration;
  const rawIndex = Math.floor(totalCycles);
  const activeSlideIndex = ((rawIndex % count) + count) % count;
  const nextSlideIndex = (activeSlideIndex + 1) % count;
  const slideProgress = Number((totalCycles - Math.floor(totalCycles)).toFixed(4));

  return {
    activeSlideIndex,
    nextSlideIndex,
    slideProgress,
    transitionProgress: 0,
  };
}

export interface FeedbackPrint {
  id: string;
  src: string;
}

export interface FeedbackCarouselItem {
  key: string;
  slotIndex: number;
  printIndex: number;
  print: FeedbackPrint;
  centerX: number;
  normX: number; // -1 (left edge) .. 0 (center) .. +1 (right edge)
  carouselRotateY: number; // cylindrical 3D rotation (deg)
  translateZ: number; // 3D backward curvature at carousel corners (px)
  scale: number; // perspective scale at carousel corners
  blurPx: number; // progressive corner blur (px)
  opacity: number;
}

export const FEEDBACK_PRINTS: FeedbackPrint[] = [
  { id: 'feedback-01', src: '/feedbacks/feedback-01.jpg' },
  { id: 'feedback-02', src: '/feedbacks/feedback-02.jpg' },
  { id: 'feedback-03', src: '/feedbacks/feedback-03.jpg' },
  { id: 'feedback-04', src: '/feedbacks/feedback-04.jpg' },
  { id: 'feedback-05', src: '/feedbacks/feedback-05.jpg' },
  { id: 'feedback-06', src: '/feedbacks/feedback-06.jpg' },
];

/**
 * Randomly shuffles portfolio photos from the /portfolio/ folder using Fisher-Yates
 * so every session arranges images organically across the infinite grid without fixed order.
 */
export function shufflePortfolioPhotos(
  photos: PortfolioPhoto[] = PORTFOLIO_PHOTOS,
  randomFn: () => number = Math.random
): PortfolioPhoto[] {
  const copy = [...photos];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Computes clamped 3D rotation angles (in degrees) for interactive 3D photo cards.
 * Strictly limits rotation to [-maxDeg, +maxDeg] so the 3D card never flips beyond its limit.
 */
export function computeClampedPhotoRotation(
  normX: number,
  normY: number,
  maxDeg = 22
): { rotateX: number; rotateY: number } {
  const limit = Math.max(1, Math.abs(maxDeg));
  const clampedNx = Math.max(-1, Math.min(1, Number.isFinite(normX) ? normX : 0));
  const clampedNy = Math.max(-1, Math.min(1, Number.isFinite(normY) ? normY : 0));
  const rotateY = Number((clampedNx * limit).toFixed(3));
  const rotateX = Number((-clampedNy * limit).toFixed(3));
  return {
    rotateX: rotateX === 0 ? 0 : rotateX,
    rotateY: rotateY === 0 ? 0 : rotateY,
  };
}

/**
 * Computes visible 1:1 feedback cards for the infinite 3D cylindrical carousel:
 * - Starts entering from left to right when opened (introProgress: 0 -> 1)
 * - Repeats 1:1 prints infinitely in both directions via periodic modulo wrapping
 * - Applies 3D cylindrical corner rounding (carouselRotateY + negative translateZ) and progressive corner blur
 */
export function computeFeedbackCarouselItems(
  containerWidth: number,
  cardSize: number,
  gap: number,
  scrollX: number,
  introProgress = 1,
  prints: FeedbackPrint[] = FEEDBACK_PRINTS
): FeedbackCarouselItem[] {
  const activePrints = prints.length > 0 ? prints : FEEDBACK_PRINTS;
  const safeW = Math.max(240, containerWidth || 440);
  const safeCard = Math.max(80, cardSize || 240);
  const stride = safeCard + Math.max(4, gap);

  const clampedIntro = Math.max(0, Math.min(1, introProgress));
  // Cubic ease-out for the left-to-right entrance sweep (-safeW * 1.15 -> 0)
  const easeIntro = 1 - Math.pow(1 - clampedIntro, 3);
  const entranceShiftX = -(1 - easeIntro) * (safeW * 1.15);

  const effectiveScrollX = (Number.isFinite(scrollX) ? scrollX : 0) + entranceShiftX;
  const halfW = safeW * 0.5;
  const minCenterX = -safeCard * 1.1;
  const maxCenterX = safeW + safeCard * 1.1;

  const startSlot = Math.floor((minCenterX - halfW - effectiveScrollX) / stride);
  const endSlot = Math.ceil((maxCenterX - halfW - effectiveScrollX) / stride);

  const items: FeedbackCarouselItem[] = [];

  for (let slotIndex = startSlot; slotIndex <= endSlot; slotIndex++) {
    const centerX = halfW + slotIndex * stride + effectiveScrollX;
    if (centerX < minCenterX || centerX > maxCenterX) continue;

    const normX = (centerX - halfW) / halfW; // -1 at left edge, 0 at center, +1 at right edge
    const absNorm = Math.abs(normX);

    // 3D cylindrical carousel curvature at corners
    const carouselRotateY = Math.max(-52, Math.min(52, Number((-normX * 34).toFixed(2))));
    const translateZ = Number((-Math.pow(absNorm, 1.6) * 88).toFixed(2));
    const scale = Number(Math.max(0.76, 1 - Math.pow(absNorm, 1.7) * 0.18).toFixed(3));

    // Progressive optical blur at left and right carousel corners while keeping center print crystal clear
    const cornerRamp = Math.max(0, (absNorm - 0.34) / 0.66);
    const blurPx = Number((Math.pow(cornerRamp, 1.35) * 6.0).toFixed(2));
    const opacity = Number(
      Math.max(0.14, 1 - Math.pow(Math.max(0, absNorm - 0.38), 1.55) * 0.86).toFixed(3)
    );

    const n = activePrints.length;
    const printIndex = ((slotIndex % n) + n) % n;

    items.push({
      key: `slot-${slotIndex}`,
      slotIndex,
      printIndex,
      print: activePrints[printIndex],
      centerX,
      normX,
      carouselRotateY: carouselRotateY === 0 ? 0 : carouselRotateY,
      translateZ: translateZ === 0 ? 0 : translateZ,
      scale,
      blurPx: blurPx === 0 ? 0 : blurPx,
      opacity,
    });
  }

  return items;
}

/**
 * Positive mathematical modulo: wraps any coordinate cleanly into [0, period).
 */
export function wrapCoordinate(value: number, period: number): number {
  if (period <= 0 || !Number.isFinite(period)) return 0;
  if (!Number.isFinite(value)) return 0;
  return ((value % period) + period) % period;
}

/**
 * Builds a seamless 2D periodic staggered column layout where EVERY photo tile has an exact
 * 3:2 (horizontal) or 2:3 (vertical) aspect ratio adapting to the images in the folder,
 * and the "Sessão Especial de Natal" Promo Frame has a 2:3 vertical aspect ratio.
 */
export function createPortfolioLayout(
  viewportWidth: number,
  viewportHeight: number,
  photoPool: PortfolioPhoto[] = PORTFOLIO_PHOTOS
): PortfolioLayout {
  const activePool = (photoPool.length > 0 ? photoPool : PORTFOLIO_PHOTOS).map((p) => ({
    ...p,
    aspectRatio: p.isPromoFrame
      ? ASPECT_RATIO_VERTICAL_2_3
      : normalizePhotoAspectRatio(p.aspectRatio),
  }));

  const safeW = Math.max(320, viewportWidth || 1440);
  const safeH = Math.max(480, viewportHeight || 900);

  const isCompact = safeW < 640;
  const gap = isCompact ? 7 : 10;

  const targetColWidth = isCompact
    ? Math.round(safeW * 0.56)
    : Math.round(Math.min(420, Math.max(310, safeW * 0.25)));

  // Dynamically scale columns count so ALL photos in activePool fit with ~5 items per column
  const numColumns = Math.max(6, Math.ceil(activePool.length / 5));

  const itemsPerColumn: PortfolioPhoto[][] = Array.from({ length: numColumns }, () => []);
  let poolCursor = 0;
  let colIdx = 0;

  const offsetRatios = [0.0, -0.035, -0.075, 0.085, -0.12, 0.05, -0.06, 0.07, -0.09, 0.04];

  while (poolCursor < activePool.length || itemsPerColumn.some((c) => c.length < 3)) {
    const cIdx = colIdx % numColumns;
    const currentColItems = itemsPerColumn[cIdx];
    const isPromoSlot = cIdx % 3 === 1 && currentColItems.length === Math.floor(cIdx / 2);

    let chosen: PortfolioPhoto;
    if (isPromoSlot) {
      chosen = PROMO_NATAL_PHOTO;
    } else {
      chosen = activePool[poolCursor % activePool.length];
      poolCursor += 1;
    }
    const ratio = chosen.isPromoFrame
      ? ASPECT_RATIO_VERTICAL_2_3
      : normalizePhotoAspectRatio(chosen.aspectRatio);
    currentColItems.push({ ...chosen, aspectRatio: ratio });
    colIdx += 1;
  }

  const rawColHeights = itemsPerColumn.map((col) => {
    return col.reduce((acc, photo) => acc + Math.round(targetColWidth / photo.aspectRatio) + gap, 0);
  });

  const maxTotalPeriodHeight = Math.max(...rawColHeights);

  let currentX = 0;
  const columns: ColumnTrack[] = itemsPerColumn.map((selectedPhotos, colIndex) => {
    const numItems = selectedPhotos.length;
    let currentY = 0;

    const rawSumNoGap = selectedPhotos.reduce(
      (acc, p) => acc + Math.round(targetColWidth / p.aspectRatio),
      0
    );
    const availableHeightForItems = maxTotalPeriodHeight - numItems * gap;

    const items = selectedPhotos.map((photo, itemIndex) => {
      const isLast = itemIndex === numItems - 1;
      const exactHeight = Math.round(targetColWidth / photo.aspectRatio);
      const itemHeight = isLast
        ? maxTotalPeriodHeight - currentY - gap
        : Math.round((exactHeight / rawSumNoGap) * availableHeightForItems);

      const yOffset = currentY;
      currentY += itemHeight + gap;

      return {
        itemIndex,
        photo,
        yOffset,
        height: itemHeight,
      };
    });

    const offsetRatio = offsetRatios[colIndex % offsetRatios.length];
    const track: ColumnTrack = {
      colIndex,
      xOffset: currentX,
      width: targetColWidth,
      verticalOffset: Math.round(maxTotalPeriodHeight * offsetRatio),
      items,
    };

    currentX += targetColWidth + gap;
    return track;
  });

  return {
    gap,
    totalPeriodWidth: currentX,
    totalPeriodHeight: maxTotalPeriodHeight,
    initialPanX: isCompact ? -Math.round(columns[0].width * 0.28) : 0,
    initialPanY: 0,
    columns,
  };
}

/**
 * Creates the initial kinematics state for the infinite canvas.
 */
export function createInitialKinematics(layout?: PortfolioLayout): KinematicsState {
  const initX = layout ? layout.initialPanX : 0;
  const initY = layout ? layout.initialPanY : 0;
  return {
    panX: initX,
    panY: initY,
    targetPanX: initX,
    targetPanY: initY,
    vx: 0,
    vy: 0,
    columnShiftOffset: 0,
    columnShiftVelocity: 0,
    isDragging: false,
    isPressed: false,
    pressHoldTimer: 0,
    menuOpen: false,
    menuProgress: 0,
    zoomScale: 1.0,
    tileScale: 1.0,
    pressAmount: 0.0,
    activeTileKey: null,
  };
}

const COLUMN_POLARITIES = [1.0, -1.0, 0.85, -0.85, 0.95, -0.95];

/**
 * Computes the subtle alternating vertical counter-shift for a given column index.
 */
export function computeColumnVerticalShift(
  colIndex: number,
  panX: number,
  panY: number,
  columnShiftOffset = 0,
  initialPanX = 0,
  initialPanY = 0
): number {
  const polarity = COLUMN_POLARITIES[colIndex % COLUMN_POLARITIES.length];
  const deltaX = panX - initialPanX;
  const deltaY = panY - initialPanY;

  const continuousCounterDrift = polarity * (deltaX * 0.065 + deltaY * 0.042);
  const gestureWave = polarity * columnShiftOffset;

  return continuousCounterDrift + gestureWave;
}

/**
 * Computes all visible tile instances across the viewport plus an overscan margin
 * so that deeper menu zoom-out and 3D spherical corner distortion never expose empty borders.
 */
export function computeVisibleTiles(
  viewportWidth: number,
  viewportHeight: number,
  panX: number,
  panY: number,
  zoomScale: number,
  layout: PortfolioLayout,
  activeTileKey: string | null = null,
  overscanRatio = 0.28,
  columnShiftOffset = 0
): VisibleTile[] {
  const { totalPeriodWidth, totalPeriodHeight, columns, initialPanX, initialPanY } = layout;
  if (totalPeriodWidth <= 0 || totalPeriodHeight <= 0) return [];

  const safeZoom = Math.max(0.60, Math.min(1.25, zoomScale || 1.0));
  const marginX = viewportWidth * overscanRatio + viewportWidth * (1 / safeZoom - 1) * 0.72;
  const marginY = viewportHeight * overscanRatio + viewportHeight * (1 / safeZoom - 1) * 0.72;

  const minScreenX = -marginX;
  const maxScreenX = viewportWidth + marginX;
  const minScreenY = -marginY;
  const maxScreenY = viewportHeight + marginY;

  const worldLeft = minScreenX - panX;
  const worldRight = maxScreenX - panX;
  const startWrapX = Math.floor(worldLeft / totalPeriodWidth);
  const endWrapX = Math.floor(worldRight / totalPeriodWidth);

  const visible: VisibleTile[] = [];

  for (let wrapX = startWrapX; wrapX <= endWrapX; wrapX++) {
    const periodBaseX = wrapX * totalPeriodWidth;

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const screenX = periodBaseX + col.xOffset + panX;

      if (screenX + col.width < minScreenX || screenX > maxScreenX) {
        continue;
      }

      const alternatingShiftY = computeColumnVerticalShift(
        col.colIndex,
        panX,
        panY,
        columnShiftOffset,
        initialPanX,
        initialPanY
      );
      const colPanY = panY + col.verticalOffset + alternatingShiftY;
      const worldTop = minScreenY - colPanY;
      const worldBottom = maxScreenY - colPanY;
      const startWrapY = Math.floor(worldTop / totalPeriodHeight);
      const endWrapY = Math.floor(worldBottom / totalPeriodHeight);

      for (let wrapY = startWrapY; wrapY <= endWrapY; wrapY++) {
        const periodBaseY = wrapY * totalPeriodHeight;

        for (let i = 0; i < col.items.length; i++) {
          const item = col.items[i];
          const screenY = periodBaseY + item.yOffset + colPanY;

          if (screenY + item.height < minScreenY || screenY > maxScreenY) {
            continue;
          }

          const key = `${col.colIndex}:${item.itemIndex}:${wrapX}:${wrapY}`;
          visible.push({
            key,
            colIndex: col.colIndex,
            itemIndex: item.itemIndex,
            wrapX,
            wrapY,
            photo: item.photo,
            x: screenX,
            y: screenY,
            width: col.width,
            height: item.height,
            isActiveTile: activeTileKey === key,
          });
        }
      }
    }
  }

  return visible;
}

/**
 * Finds the tile directly underneath a viewport point (clientX, clientY).
 */
export function findTileAtPoint(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  state: KinematicsState,
  layout: PortfolioLayout
): VisibleTile | null {
  const tiles = computeVisibleTiles(
    viewportWidth,
    viewportHeight,
    state.panX,
    state.panY,
    state.zoomScale,
    layout,
    state.activeTileKey,
    0.05,
    state.columnShiftOffset
  );

  const cx = viewportWidth * 0.5;
  const cy = viewportHeight * 0.5;
  const worldScreenX = cx + (clientX - cx) / state.zoomScale;
  const worldScreenY = cy + (clientY - cy) / state.zoomScale;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (
      worldScreenX >= t.x &&
      worldScreenX <= t.x + t.width &&
      worldScreenY >= t.y &&
      worldScreenY <= t.y + t.height
    ) {
      return t;
    }
  }
  return null;
}

/**
 * Advances globe rotational coasting, smooth pan interpolation, alternating vertical column
 * counter-drift, subtle click/touch zoom-out, and the deeper spherical menu zoom-out.
 */
export function stepKinematics(state: KinematicsState, dtSeconds: number): boolean {
  const dt = Math.min(0.12, Math.max(0.001, dtSeconds));

  if (state.pressHoldTimer > 0) {
    state.pressHoldTimer = Math.max(0, state.pressHoldTimer - dt);
  }

  const prevPanX = state.panX;
  const prevPanY = state.panY;

  if (!state.isDragging) {
    state.targetPanX += state.vx * dt;
    state.targetPanY += state.vy * dt;

    const globeFriction = Math.exp(-1.42 * dt);
    state.vx *= globeFriction;
    state.vy *= globeFriction;

    if (Math.hypot(state.vx, state.vy) < 0.4) {
      state.vx = 0;
      state.vy = 0;
    }
  }

  const panSmoothingRate = state.isDragging ? 18.0 : 14.0;
  const panAlpha = 1 - Math.exp(-panSmoothingRate * dt);
  state.panX += (state.targetPanX - state.panX) * panAlpha;
  state.panY += (state.targetPanY - state.panY) * panAlpha;

  if (Math.abs(state.targetPanX - state.panX) < 0.05 && !state.isDragging && state.vx === 0) {
    state.panX = state.targetPanX;
  }
  if (Math.abs(state.targetPanY - state.panY) < 0.05 && !state.isDragging && state.vy === 0) {
    state.panY = state.targetPanY;
  }

  const frameVx = (state.panX - prevPanX) / dt;
  const frameVy = (state.panY - prevPanY) / dt;
  const signedGestureFlow = frameVx * 0.016 + frameVy * 0.012;
  const targetColumnShift = Math.max(-18, Math.min(18, signedGestureFlow));

  const shiftAlpha = 1 - Math.exp(-6.5 * dt);
  state.columnShiftOffset += (targetColumnShift - state.columnShiftOffset) * shiftAlpha;
  if (Math.abs(state.columnShiftOffset) < 0.03 && Math.abs(targetColumnShift) < 0.03) {
    state.columnShiftOffset = 0;
  }

  const targetMenu = state.menuOpen ? 1.0 : 0.0;
  const menuAlpha = 1 - Math.exp(-5.0 * dt);
  state.menuProgress += (targetMenu - state.menuProgress) * menuAlpha;
  if (Math.abs(targetMenu - state.menuProgress) < 0.0008) {
    state.menuProgress = targetMenu;
  }

  // Subtle zoom-out on click/touch (~0.984) + larger spherical zoom-out when menu opens (down to 0.72)
  const activePress = state.isPressed || state.pressHoldTimer > 0;
  const basePressZoom = activePress ? 0.984 : 1.0;
  const menuZoomFactor = 1.0 - 0.28 * state.menuProgress;
  const targetZoom = basePressZoom * menuZoomFactor;
  const targetTileScale = (activePress ? 0.991 : 1.0) * (1.0 - 0.028 * state.menuProgress);
  const targetPressAmount = activePress ? 1.0 : 0.0;

  const zoomRate = activePress ? 5.6 : 4.8;
  const alpha = 1 - Math.exp(-zoomRate * dt);

  state.zoomScale += (targetZoom - state.zoomScale) * alpha;
  state.tileScale += (targetTileScale - state.tileScale) * alpha;
  state.pressAmount += (targetPressAmount - state.pressAmount) * alpha;

  if (Math.abs(targetZoom - state.zoomScale) < 0.0002) {
    state.zoomScale = targetZoom;
  }
  if (Math.abs(targetTileScale - state.tileScale) < 0.0002) {
    state.tileScale = targetTileScale;
  }
  if (Math.abs(targetPressAmount - state.pressAmount) < 0.001) {
    state.pressAmount = targetPressAmount;
    if (!activePress) {
      state.activeTileKey = null;
    }
  }

  const remainingPanDelta = Math.hypot(
    state.targetPanX - state.panX,
    state.targetPanY - state.panY
  );

  const isMoving =
    state.isDragging ||
    state.isPressed ||
    state.pressHoldTimer > 0 ||
    Math.hypot(state.vx, state.vy) >= 0.4 ||
    remainingPanDelta >= 0.05 ||
    Math.abs(state.columnShiftOffset) >= 0.03 ||
    Math.abs(targetMenu - state.menuProgress) > 0.0008 ||
    Math.abs(targetZoom - state.zoomScale) > 0.0002 ||
    Math.abs(targetTileScale - state.tileScale) > 0.0002 ||
    state.pressAmount > 0.001;

  return isMoving;
}

/**
 * Computes the enhanced 3D spherical backward corner distortion and chromatic aberration
 * at normalized viewport coordinates (nx, ny) in [-1, 1]^2.
 */
export function computeCornerOptics(
  nx: number,
  ny: number,
  pressAmount = 0,
  menuProgress = 0
): CornerOpticsResult {
  const clampedX = Math.max(-1, Math.min(1, nx));
  const clampedY = Math.max(-1, Math.min(1, ny));

  const r2 = clampedX * clampedX + clampedY * clampedY;
  const diagCorner = Math.abs(clampedX * clampedY);
  // Earlier onset and rounder 3D corners, expanding further when menu zooms out
  const startR2 = 0.24 - 0.16 * menuProgress;
  const smoothCorner = Math.min(1, Math.max(0, (r2 - startR2) / (2.0 - startR2)));
  const cornerWeight = smoothCorner * smoothCorner * (0.52 + 0.48 * diagCorner);

  const sphereStrength = 0.145 + 0.025 * pressAmount + 0.24 * menuProgress;
  const barrelFactor = 1.0 + sphereStrength * cornerWeight;
  const zRecession =
    cornerWeight === 0 ? 0 : -cornerWeight * (0.26 + 0.05 * pressAmount + 0.34 * menuProgress);

  const chromaticShiftPx = cornerWeight * (4.2 + 1.1 * pressAmount) * (1.0 - menuProgress);

  return {
    r2,
    cornerWeight,
    zRecession,
    distortedNx: clampedX * barrelFactor,
    distortedNy: clampedY * barrelFactor,
    chromaticShiftPx,
  };
}
