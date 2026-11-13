import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTFOLIO_PHOTOS,
  PROMO_NATAL_PHOTO,
  PROMO_NATAL_SLIDES,
  wrapCoordinate,
  shufflePortfolioPhotos,
  computeClampedPhotoRotation,
  computeFeedbackCarouselItems,
  computePromoBillboardState,
  createPortfolioLayout,
  createInitialKinematics,
  computeVisibleTiles,
  computeColumnVerticalShift,
  findTileAtPoint,
  stepKinematics,
  computeCornerOptics,
} from './infinite-grid';
import {
  getSoundSynthesisSpec,
  detectFeedbackSlotStep,
} from './sound-effects';

test('wrapCoordinate wraps positive and negative values seamlessly into [0, period)', () => {
  assert.equal(wrapCoordinate(0, 1000), 0);
  assert.equal(wrapCoordinate(1250, 1000), 250);
  assert.equal(wrapCoordinate(-250, 1000), 750);
  assert.equal(wrapCoordinate(-2000, 1000), 0);
});

test('shufflePortfolioPhotos randomizes photo order while preserving all folder assets', () => {
  let seed = 42;
  const deterministicRng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const shuffled = shufflePortfolioPhotos(PORTFOLIO_PHOTOS, deterministicRng);
  assert.equal(shuffled.length, PORTFOLIO_PHOTOS.length);
  const originalOrder = PORTFOLIO_PHOTOS.map((p) => p.id).join(',');
  const shuffledOrder = shuffled.map((p) => p.id).join(',');
  assert.notEqual(shuffledOrder, originalOrder, 'Shuffled order should differ from static order');
});

test('computeClampedPhotoRotation rotates in 3D and strictly enforces rotation limits', () => {
  const zero = computeClampedPhotoRotation(0, 0, 22);
  assert.equal(zero.rotateX, 0);
  assert.equal(zero.rotateY, 0);

  const mid = computeClampedPhotoRotation(0.5, -0.5, 22);
  assert.equal(mid.rotateY, 11);
  assert.equal(mid.rotateX, 11);

  const extreme = computeClampedPhotoRotation(4.5, -8.2, 22);
  assert.equal(extreme.rotateY, 22);
  assert.equal(extreme.rotateX, 22);
});

test('createPortfolioLayout produces staggered columns with identical vertical period height', () => {
  const layout = createPortfolioLayout(1440, 900);
  assert.ok(layout.totalPeriodWidth > 1440);
  assert.ok(layout.totalPeriodHeight > 900);
  assert.equal(layout.columns.length, 6);

  for (const col of layout.columns) {
    const sumHeights = col.items.reduce((acc, item) => acc + item.height + layout.gap, 0);
    assert.equal(sumHeights, layout.totalPeriodHeight);
  }

  assert.notEqual(layout.columns[0].verticalOffset, layout.columns[1].verticalOffset);
  assert.notEqual(layout.columns[1].verticalOffset, layout.columns[2].verticalOffset);
});

test('computeVisibleTiles covers full viewport across extreme omnidirectional pans and deep menu zoom-out without gaps', () => {
  const layout = createPortfolioLayout(1440, 900);

  for (const [panX, panY] of [
    [0, 0],
    [4500, -3200],
    [-12800, 9400],
    [-850, -1420],
  ]) {
    const tiles = computeVisibleTiles(1440, 900, panX, panY, 0.76, layout);
    assert.ok(tiles.length >= 12, `Expected >= 12 visible tiles at pan (${panX}, ${panY})`);

    const minX = Math.min(...tiles.map((t) => t.x));
    const maxX = Math.max(...tiles.map((t) => t.x + t.width));
    const minY = Math.min(...tiles.map((t) => t.y));
    const maxY = Math.max(...tiles.map((t) => t.y + t.height));

    assert.ok(minX <= 0, 'Left edge must be covered');
    assert.ok(maxX >= 1440, 'Right edge must be covered');
    assert.ok(minY <= 0, 'Top edge must be covered');
    assert.ok(maxY >= 900, 'Bottom edge must be covered');
  }
});

test('stepKinematics applies a very subtle, smooth zoom-out on click/touch and returns smoothly to 1.0 on release', () => {
  const layout = createPortfolioLayout(1440, 900);
  const state = createInitialKinematics(layout);

  state.isPressed = true;
  state.isDragging = true;
  state.pressHoldTimer = 0.30;
  state.targetPanX = -200;
  state.targetPanY = -120;

  for (let i = 0; i < 30; i++) {
    stepKinematics(state, 1 / 60);
  }

  assert.ok(state.panX < -150 && state.panX >= -200, `Expected smooth panX interpolation, got ${state.panX}`);
  assert.ok(state.panY < -90 && state.panY >= -120, `Expected smooth panY interpolation, got ${state.panY}`);
  assert.ok(state.zoomScale < 0.992 && state.zoomScale >= 0.983, `Expected subtle zoom-out (~0.984), got ${state.zoomScale}`);
  assert.ok(state.tileScale < 0.996 && state.tileScale >= 0.990, `Expected subtle tile zoom-out (~0.991), got ${state.tileScale}`);

  state.isPressed = false;
  state.isDragging = false;
  for (let i = 0; i < 160; i++) {
    stepKinematics(state, 1 / 60);
  }

  assert.ok(Math.abs(state.zoomScale - 1.0) < 0.001, `Expected zoomScale back at 1.0, got ${state.zoomScale}`);
  assert.ok(Math.abs(state.tileScale - 1.0) < 0.001, `Expected tileScale back at 1.0, got ${state.tileScale}`);
});

test('computeCornerOptics produces zero distortion at center and deeper 3D spherical recession at corners', () => {
  const center = computeCornerOptics(0, 0, 0);
  assert.equal(center.cornerWeight, 0);
  assert.equal(center.zRecession, 0);
  assert.equal(center.chromaticShiftPx, 0);

  const corner = computeCornerOptics(1, 1, 0);
  assert.ok(corner.cornerWeight > 0.85);
  assert.ok(corner.zRecession < -0.22, 'Corners must recede more deeply in 3D space');
  assert.ok(corner.chromaticShiftPx > 3.5, 'Corners must exhibit cinematic chromatic aberration');
  assert.ok(corner.distortedNx > 1.12, 'More rounded spherical barrel curve bends corner coordinates');
});

test('findTileAtPoint locates the clicked tile in the staggered grid', () => {
  const layout = createPortfolioLayout(1440, 900);
  const state = createInitialKinematics(layout);
  const hit = findTileAtPoint(400, 400, 1440, 900, state, layout);
  assert.ok(hit !== null, 'Should find a tile at (400, 400)');
});

test('adjacent columns subtly counter-move vertically (one rises while neighbor descends) and globe coasts gradually', () => {
  const layout = createPortfolioLayout(1440, 900);
  const state = createInitialKinematics(layout);

  state.isDragging = false;
  state.vx = -650;
  state.vy = -220;

  for (let i = 0; i < 15; i++) {
    stepKinematics(state, 1 / 60);
  }

  assert.ok(Math.abs(state.vx) > 400, `Expected long globe coasting momentum, got vx=${state.vx}`);
  assert.ok(state.columnShiftOffset !== 0, 'Expected active columnShiftOffset during gesture');

  const shiftCol0 = computeColumnVerticalShift(
    0,
    state.panX,
    state.panY,
    state.columnShiftOffset,
    layout.initialPanX,
    layout.initialPanY
  );
  const shiftCol1 = computeColumnVerticalShift(
    1,
    state.panX,
    state.panY,
    state.columnShiftOffset,
    layout.initialPanX,
    layout.initialPanY
  );

  assert.ok(
    shiftCol0 * shiftCol1 < 0,
    `Expected adjacent columns to move in opposite vertical directions, got col0=${shiftCol0}, col1=${shiftCol1}`
  );
});

test('opening menu produces larger spherical zoom-out (< 0.80) and amplifies 3D spherical border curvature, and closing reverses it', () => {
  const layout = createPortfolioLayout(1440, 900);
  const state = createInitialKinematics(layout);

  state.menuOpen = true;
  for (let i = 0; i < 90; i++) {
    stepKinematics(state, 1 / 60);
  }

  assert.ok(state.menuProgress > 0.98, `Expected menuProgress near 1.0, got ${state.menuProgress}`);
  assert.ok(state.zoomScale < 0.80, `Expected larger spherical zoom-out (< 0.80), got ${state.zoomScale}`);

  const closedCorner = computeCornerOptics(0.85, 0.85, 0, 0);
  const openCorner = computeCornerOptics(0.85, 0.85, 0, state.menuProgress);
  assert.ok(
    Math.abs(openCorner.zRecession) > Math.abs(closedCorner.zRecession),
    'Menu zoom-out must increase 3D spherical border curvature'
  );

  state.menuOpen = false;
  for (let i = 0; i < 120; i++) {
    stepKinematics(state, 1 / 60);
  }

  assert.ok(state.menuProgress < 0.01, `Expected menuProgress back near 0, got ${state.menuProgress}`);
  assert.ok(Math.abs(state.zoomScale - 1.0) < 0.002, `Expected zoomScale back at 1.0, got ${state.zoomScale}`);
});

test('computeFeedbackCarouselItems enters from left to right and wraps 1:1 prints infinitely with 3D corner rounding and blur', () => {
  // At introProgress = 0, slot 0 is shifted off-stage to the left (centerX < 0)
  const startItems = computeFeedbackCarouselItems(440, 150, 16, 0, 0);
  const settledItems = computeFeedbackCarouselItems(440, 150, 16, 0, 1);

  const slot0Settled = settledItems.find((item) => item.slotIndex === 0);
  assert.ok(slot0Settled, 'Expected slot 0 to be visible when settled');
  assert.equal(slot0Settled.centerX, 220);
  assert.equal(slot0Settled.blurPx, 0, 'Center card must be sharp (0 blur)');
  assert.equal(slot0Settled.translateZ, 0, 'Center card has 0 Z recession');

  // Verify slot 0 travels from left to right during entrance (0 -> 0.5 -> 1.0)
  const midItems = computeFeedbackCarouselItems(440, 150, 16, 0, 0.5);
  const slot0Mid = midItems.find((item) => item.slotIndex === 0);
  assert.ok(slot0Mid && slot0Mid.centerX < slot0Settled.centerX, 'Card enters from left to right');
  assert.ok(startItems.length > 0);

  // Verify corner cards have 3D cylindrical rotation, negative translateZ, and blur > 0
  const edgeItem = settledItems.find((item) => Math.abs(item.normX) > 0.65);
  assert.ok(edgeItem, 'Expected an edge card in carousel');
  assert.ok(edgeItem.translateZ < -20, 'Corner cards recede in 3D space');
  assert.ok(Math.abs(edgeItem.carouselRotateY) > 20, 'Corner cards rotate along 3D cylinder');
  assert.ok(edgeItem.blurPx > 1.5, 'Corner cards have optical corner blur');

  // Verify infinite wrapping at extreme negative and positive scrollX
  const farLeft = computeFeedbackCarouselItems(440, 150, 16, -48000, 1);
  const farRight = computeFeedbackCarouselItems(440, 150, 16, 48000, 1);
  assert.ok(farLeft.length >= 3, 'Carousel remains populated when scrolled far right');
  assert.ok(farRight.length >= 3, 'Carousel remains populated when scrolled far left');
});

test('computePromoBillboardState cycles through all Christmas slides with longer reading duration and Promo Frame repeats in the infinite grid', () => {
  const s0 = computePromoBillboardState(1.0, 6.5);
  assert.equal(s0.activeSlideIndex, 0);
  assert.equal(s0.nextSlideIndex, 1);
  assert.equal(s0.transitionProgress, 0);

  const sStill0 = computePromoBillboardState(5.8, 6.5);
  assert.equal(sStill0.activeSlideIndex, 0);
  assert.equal(sStill0.transitionProgress, 0);

  const s1 = computePromoBillboardState(6.6, 6.5);
  assert.equal(s1.activeSlideIndex, 1);
  assert.equal(PROMO_NATAL_SLIDES.length, 4);

  const layout = createPortfolioLayout(1440, 900);
  const visible = computeVisibleTiles(1440, 900, 0, 0, 1.0, layout);
  const promoTiles = visible.filter((t) => t.photo.id === PROMO_NATAL_PHOTO.id);
  assert.ok(promoTiles.length >= 1, 'Expected at least 1 Promo Frame visible in the initial viewport');
});

test('all grid tiles respect 3:2 or 2:3 photo aspect ratios and Christmas Promo Frame is 2:3', () => {
  assert.ok(Math.abs(PROMO_NATAL_PHOTO.aspectRatio - 2 / 3) < 0.001, 'Promo Natal frame must be 2:3');

  const layout = createPortfolioLayout(1440, 900);
  for (const col of layout.columns) {
    for (const item of col.items) {
      const ratio = col.width / item.height;
      const is2to3 = Math.abs(ratio - 2 / 3) < 0.015;
      const is3to2 = Math.abs(ratio - 3 / 2) < 0.015;
      assert.ok(
        is2to3 || is3to2,
        `Expected tile ratio to be 2:3 (0.667) or 3:2 (1.500), got ${ratio.toFixed(4)}`
      );
      if (item.photo.isPromoFrame) {
        assert.ok(is2to3, `Promo frame tile must be vertical 2:3, got ${ratio.toFixed(4)}`);
      }
    }
  }
});

test('sound effects specs and feedback step detection cover menu open/close, accordion open/close, and feedback steps', () => {
  const menuOpen = getSoundSynthesisSpec('menu-open');
  const menuClose = getSoundSynthesisSpec('menu-close');
  assert.ok(menuOpen.endFreqHz > menuOpen.startFreqHz, 'Menu open sound rises in pitch');
  assert.ok(menuClose.endFreqHz < menuClose.startFreqHz, 'Menu close sound descends in pitch');

  const accOpen = getSoundSynthesisSpec('accordion-open');
  const accClose = getSoundSynthesisSpec('accordion-close');
  assert.ok(accOpen.endFreqHz > accOpen.startFreqHz, 'Accordion open rises in pitch');
  assert.ok(accClose.endFreqHz < accClose.startFreqHz, 'Accordion close descends in pitch');

  const stepSlow = getSoundSynthesisSpec('feedback-step', 100);
  const stepFast = getSoundSynthesisSpec('feedback-step', 1200);
  assert.ok(stepFast.startFreqHz > stepSlow.startFreqHz, 'Faster feedback spin increases step tick brightness');

  const init = detectFeedbackSlotStep(null, 0, 150, 10);
  assert.equal(init.stepped, false);
  const sameSlot = detectFeedbackSlotStep(init.currentSlot, -20, 150, 10);
  assert.equal(sameSlot.stepped, false);
  const nextSlot = detectFeedbackSlotStep(init.currentSlot, -165, 150, 10);
  assert.equal(nextSlot.stepped, true);
  assert.equal(nextSlot.currentSlot, 1);
});




