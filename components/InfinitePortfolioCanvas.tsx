'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  PORTFOLIO_PHOTOS,
  FEEDBACK_PRINTS,
  FeedbackPrint,
  PROMO_NATAL_PHOTO,
  PROMO_NATAL_SLIDES,
  PromoSlide,
  PortfolioPhoto,
  PortfolioLayout,
  KinematicsState,
  shufflePortfolioPhotos,
  normalizePhotoAspectRatio,
  computePromoBillboardState,
  createPortfolioLayout,
  createInitialKinematics,
  computeColumnVerticalShift,
  findTileAtPoint,
  stepKinematics,
} from '@/lib/infinite-grid';
import { preloadCustomSoundsFromFolder, DEFAULT_SOUND_FILES } from '@/lib/sound-effects';

/**
 * Pass 1 Shaders: Ultra-lightweight Pure-GPU Tile Quad Renderer
 */
const TILE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aUnitQuad; // [0, 1]^2
uniform vec4 uRect; // x, y, width, height in overscanned buffer logical pixels
uniform vec2 uBufferSize; // total logical width & height of overscanned buffer
uniform vec4 uUvRect; // u0, v0, uWidth, vHeight for object-cover crop

out vec2 vTileUv;
out vec2 vLocalUv;

void main() {
  vLocalUv = aUnitQuad;
  vTileUv = uUvRect.xy + aUnitQuad * uUvRect.zw;

  vec2 pixelPos = uRect.xy + aUnitQuad * uRect.zw;
  vec2 ndc = vec2(
    (pixelPos.x / uBufferSize.x) * 2.0 - 1.0,
    1.0 - (pixelPos.y / uBufferSize.y) * 2.0
  );
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

const TILE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vTileUv;
in vec2 vLocalUv;
out vec4 fragColor;

uniform sampler2D uPhotoTex;
uniform int uHasTexture;
uniform vec3 uFallbackA;
uniform vec3 uFallbackB;

void main() {
  if (uHasTexture == 1) {
    fragColor = vec4(texture(uPhotoTex, vTileUv).rgb, 1.0);
  } else {
    float t = clamp((vLocalUv.x + vLocalUv.y) * 0.5, 0.0, 1.0);
    fragColor = vec4(mix(uFallbackA, uFallbackB, t), 1.0);
  }
}
`;

/**
 * Pass 2 Shaders: Custom GLSL Spherical Lens, More Rounded 3D Corners & Deeper Menu Zoom-Out
 */
const POST_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const POST_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform float uPadRatio;
uniform float uPressAmount;
uniform float uMenuProgress;

vec2 viewportToTextureUV(vec2 p, float padRatio) {
  float scale = 1.0 / (1.0 + 2.0 * padRatio);
  vec2 centered = p * scale;
  return vec2(0.5 + centered.x * 0.5, 0.5 + centered.y * 0.5);
}

vec3 sampleBlurred(sampler2D tex, vec2 uv, float blurAmount) {
  if (blurAmount < 0.002) {
    return texture(tex, uv).rgb;
  }
  float r = blurAmount * 0.025;
  vec3 c = texture(tex, uv).rgb * 0.20;
  // Inner optical ring (6 taps)
  c += texture(tex, uv + vec2( 1.00,  0.00) * r * 0.48).rgb * 0.09;
  c += texture(tex, uv + vec2(-1.00,  0.00) * r * 0.48).rgb * 0.09;
  c += texture(tex, uv + vec2( 0.50,  0.87) * r * 0.48).rgb * 0.09;
  c += texture(tex, uv + vec2(-0.50,  0.87) * r * 0.48).rgb * 0.09;
  c += texture(tex, uv + vec2( 0.50, -0.87) * r * 0.48).rgb * 0.09;
  c += texture(tex, uv + vec2(-0.50, -0.87) * r * 0.48).rgb * 0.09;
  // Outer optical ring (6 taps)
  c += texture(tex, uv + vec2( 0.87,  0.50) * r).rgb * 0.0433333;
  c += texture(tex, uv + vec2(-0.87,  0.50) * r).rgb * 0.0433333;
  c += texture(tex, uv + vec2( 0.87, -0.50) * r).rgb * 0.0433333;
  c += texture(tex, uv + vec2(-0.87, -0.50) * r).rgb * 0.0433333;
  c += texture(tex, uv + vec2( 0.00,  1.00) * r).rgb * 0.0433333;
  c += texture(tex, uv + vec2( 0.00, -1.00) * r).rgb * 0.0433333;
  return c;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;

  float r2 = dot(p, p);
  float r4 = r2 * r2;

  // More rounded 3D corners at rest, and deep spherical curvature when menu zooms out
  float cornerIso = abs(p.x * p.y);
  float rampStart = mix(0.22, 0.04, uMenuProgress);
  float edgeRamp = smoothstep(rampStart, 1.82, r2);
  float cornerMix = mix(
    0.55 + 0.45 * smoothstep(0.03, 0.72, cornerIso),
    0.88 + 0.12 * cornerIso,
    uMenuProgress
  );
  float cornerWeight = edgeRamp * cornerMix;

  // Stronger 3D spherical curvature so corners visibly round backward in 3D space
  float sphereK1 = 0.145 + 0.006 * uPressAmount + 0.340 * uMenuProgress;
  float sphereK2 = 0.052 + 0.003 * uPressAmount + 0.135 * uMenuProgress;
  float barrel = 1.0 + sphereK1 * cornerWeight + sphereK2 * r4 * edgeRamp;

  vec2 pSpherical = p * barrel;

  // Corner chromatic aberration only during normal portfolio viewing (zero when menu opens)
  float caRamp = smoothstep(0.42, 1.88, r2) * (0.45 + 0.55 * smoothstep(0.05, 0.80, cornerIso));
  float caStrength = (0.0054 + 0.0006 * uPressAmount) * caRamp * (1.0 - uMenuProgress);

  vec2 uvG = viewportToTextureUV(pSpherical, uPadRatio);

  vec3 col;
  if (uMenuProgress > 0.002) {
    col = sampleBlurred(uTexture, uvG, uMenuProgress);
  } else {
    vec2 uvR = viewportToTextureUV(pSpherical * (1.0 + caStrength), uPadRatio);
    vec2 uvB = viewportToTextureUV(pSpherical * (1.0 - caStrength), uPadRatio);
    col.r = texture(uTexture, uvR).r;
    col.g = texture(uTexture, uvG).g;
    col.b = texture(uTexture, uvB).b;
  }

  // Enhanced 3D spherical corner rounding & peripheral depth falloff
  float superellipse = pow(abs(p.x), 3.2) + pow(abs(p.y), 3.2);
  float cornerMask = 1.0 - smoothstep(mix(1.22, 0.96, uMenuProgress), mix(1.92, 1.52, uMenuProgress), superellipse);
  float sphereShade = (1.0 - cornerWeight * (0.24 + 0.014 * uPressAmount + 0.38 * uMenuProgress)) * (0.52 + 0.48 * cornerMask);
  col *= sphereShade;

  fragColor = vec4(col, 1.0);
}
`;

const OVERSCAN_PAD_RATIO = 0.34;
const PROMO_CANVAS_W = 540;
const PROMO_CANVAS_H = 810; // Exact 2:3 vertical proportion (540 / 810 = 2 / 3)

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

function computeCoverUvRect(
  imgW: number,
  imgH: number,
  tileW: number,
  tileH: number,
  innerZoom: number
): [number, number, number, number] {
  const safeImgW = imgW || 800;
  const safeImgH = imgH || 1000;
  const tileRatio = tileW / tileH;
  const imgRatio = safeImgW / safeImgH;

  let u0 = 0;
  let v0 = 0;
  let uw = 1;
  let vh = 1;

  if (imgRatio > tileRatio) {
    uw = tileRatio / imgRatio;
    u0 = (1 - uw) * 0.5;
  } else {
    vh = imgRatio / tileRatio;
    v0 = (1 - vh) * 0.5;
  }

  if (innerZoom > 1.0002) {
    const zw = uw / innerZoom;
    const zh = vh / innerZoom;
    u0 += (uw - zw) * 0.5;
    v0 += (vh - zh) * 0.5;
    uw = zw;
    vh = zh;
  }

  return [u0, v0, uw, vh];
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Renders the minimalist "Sessão Especial de Natal" Promo Frame onto the offscreen 2D canvas
 * which is uploaded to its WebGL2 texture so all repeated instances across the 3D globe stay in sync.
 */
function renderPromoFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: PromoSlide
) {
  const W = PROMO_CANVAS_W;
  const H = PROMO_CANVAS_H;

  ctx.clearRect(0, 0, W, H);

  // 1. Minimalist rich red background with a subtle peripheral vignette (no background photo)
  ctx.fillStyle = '#7d1218';
  ctx.fillRect(0, 0, W, H);

  const vignette = ctx.createRadialGradient(
    W * 0.5,
    H * 0.5,
    W * 0.18,
    W * 0.5,
    H * 0.5,
    H * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.65, 'rgba(24, 2, 4, 0.24)');
  vignette.addColorStop(1, 'rgba(14, 1, 2, 0.56)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // 2. TOP: "Sessão Especial de Natal" (minimalist typography)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '400 28px Georgia, serif';
  ctx.fillStyle = 'rgba(255, 245, 235, 0.92)';
  ctx.fillText('Sessão Especial', W * 0.5, 110);

  ctx.font = 'italic 400 34px Georgia, serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('de Natal', W * 0.5, 152);

  // 3. CENTER: Direct notice text (changes cleanly every 6.5s with no sliding animation)
  const centerX = W * 0.5;
  const centerY = H * 0.5;

  ctx.font = '600 32px Georgia, serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(slide.headline, centerX, centerY - 36);

  ctx.font = '400 21px Georgia, serif';
  ctx.fillStyle = 'rgba(255, 244, 236, 0.92)';
  ctx.fillText(slide.subheadline, centerX, centerY + 12);

  ctx.font = '400 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 235, 225, 0.76)';
  ctx.fillText(slide.detail, centerX, centerY + 54);

  // 4. BOTTOM: Minimalist "Reservar" button
  const btnW = 240;
  const btnH = 60;
  const btnX = (W - btnW) * 0.5;
  const btnY = 668;

  drawRoundedRectPath(ctx, btnX, btnY, btnW, btnH, 30);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.font = '500 17px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#680d12';
  ctx.fillText('Reservar', W * 0.5, btnY + btnH * 0.5 + 1);

  ctx.restore();
}

interface InfinitePortfolioCanvasProps {
  menuOpen?: boolean;
}

export default function InfinitePortfolioCanvas({
  menuOpen = false,
}: InfinitePortfolioCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reservarLinkRef = useRef<HTMLAnchorElement | null>(null);
  const setMenuOpenRef = useRef<((open: boolean) => void) | null>(null);

  const [loadProgress, setLoadProgress] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [activePromoSlideIndex, setActivePromoSlideIndex] = useState(0);
  const [promoButtonRect, setPromoButtonRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, visible: false });

  useEffect(() => {
    if (setMenuOpenRef.current) {
      setMenuOpenRef.current(menuOpen);
    }
  }, [menuOpen]);

  useEffect(() => {
    const container = containerRef.current;
    const displayCanvas = glCanvasRef.current;
    if (!container || !displayCanvas) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const gl = displayCanvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isSoftwareGl,
    });

    const compileProgram = (
      ctx: WebGL2RenderingContext,
      vsSrc: string,
      fsSrc: string
    ): WebGLProgram | null => {
      const compile = (type: number, src: string) => {
        const s = ctx.createShader(type);
        if (!s) return null;
        ctx.shaderSource(s, src);
        ctx.compileShader(s);
        if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
          ctx.deleteShader(s);
          return null;
        }
        return s;
      };
      const vs = compile(ctx.VERTEX_SHADER, vsSrc);
      const fs = compile(ctx.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      const prog = ctx.createProgram();
      if (!prog) return null;
      ctx.attachShader(prog, vs);
      ctx.attachShader(prog, fs);
      ctx.linkProgram(prog);
      if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
        ctx.deleteProgram(prog);
        return null;
      }
      return prog;
    };

    let tileProgram: WebGLProgram | null = null;
    let tileVao: WebGLVertexArrayObject | null = null;
    let uRectLoc: WebGLUniformLocation | null = null;
    let uBufferSizeLoc: WebGLUniformLocation | null = null;
    let uUvRectLoc: WebGLUniformLocation | null = null;
    let uHasTextureLoc: WebGLUniformLocation | null = null;
    let uFallbackALoc: WebGLUniformLocation | null = null;
    let uFallbackBLoc: WebGLUniformLocation | null = null;

    let postProgram: WebGLProgram | null = null;
    let postVao: WebGLVertexArrayObject | null = null;
    let uPadRatioLoc: WebGLUniformLocation | null = null;
    let uPressAmountLoc: WebGLUniformLocation | null = null;
    let uMenuProgressLoc: WebGLUniformLocation | null = null;

    let fbo: WebGLFramebuffer | null = null;
    let fboTexture: WebGLTexture | null = null;
    let dummyTex: WebGLTexture | null = null;
    let promoTex: WebGLTexture | null = null;

    const promoCanvas = document.createElement('canvas');
    promoCanvas.width = PROMO_CANVAS_W;
    promoCanvas.height = PROMO_CANVAS_H;
    const promoCtx = promoCanvas.getContext('2d');

    if (gl) {
      tileProgram = compileProgram(gl, TILE_VERTEX_SHADER, TILE_FRAGMENT_SHADER);
      if (tileProgram) {
        uRectLoc = gl.getUniformLocation(tileProgram, 'uRect');
        uBufferSizeLoc = gl.getUniformLocation(tileProgram, 'uBufferSize');
        uUvRectLoc = gl.getUniformLocation(tileProgram, 'uUvRect');
        uHasTextureLoc = gl.getUniformLocation(tileProgram, 'uHasTexture');
        uFallbackALoc = gl.getUniformLocation(tileProgram, 'uFallbackA');
        uFallbackBLoc = gl.getUniformLocation(tileProgram, 'uFallbackB');

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
          gl.STATIC_DRAW
        );
        const loc = gl.getAttribLocation(tileProgram, 'aUnitQuad');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        tileVao = vao;
      }

      postProgram = compileProgram(gl, POST_VERTEX_SHADER, POST_FRAGMENT_SHADER);
      if (postProgram) {
        uPadRatioLoc = gl.getUniformLocation(postProgram, 'uPadRatio');
        uPressAmountLoc = gl.getUniformLocation(postProgram, 'uPressAmount');
        uMenuProgressLoc = gl.getUniformLocation(postProgram, 'uMenuProgress');

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW
        );
        const loc = gl.getAttribLocation(postProgram, 'aPosition');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        postVao = vao;
      }

      dummyTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dummyTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([12, 12, 12, 255])
      );

      promoTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, promoTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      fbo = gl.createFramebuffer();
      fboTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fboTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    let viewportW = window.innerWidth || 1440;
    let viewportH = window.innerHeight || 900;
    let dpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);
    let fboWidth = 0;
    let fboHeight = 0;

    let activePhotos: PortfolioPhoto[] = shufflePortfolioPhotos(PORTFOLIO_PHOTOS);
    let layout: PortfolioLayout = createPortfolioLayout(viewportW, viewportH, activePhotos);
    const state: KinematicsState = createInitialKinematics(layout);
    state.zoomScale = 0.84;
    state.tileScale = 0.96;

    const photoGpuMap = new Map<
      string,
      { tex: WebGLTexture | null; width: number; height: number }
    >();
    const fallbackRgbMap = new Map<
      string,
      { a: [number, number, number]; b: [number, number, number] }
    >();
    const registerFallbacks = (photos: PortfolioPhoto[]) => {
      [...photos, PROMO_NATAL_PHOTO].forEach((p) => {
        fallbackRgbMap.set(p.src, {
          a: hexToRgbNormalized(p.fallbackColorA),
          b: hexToRgbNormalized(p.fallbackColorB),
        });
      });
    };
    registerFallbacks(activePhotos);

    // Register dynamic Promo Frame texture in photoGpuMap so all repeated instances render in WebGL
    const startTimeMs = performance.now();
    let lastRenderedSlideIndex = -1;

    const updatePromoTexture = (force = false): boolean => {
      if (!promoCtx || !gl || !promoTex) return false;
      const elapsedSec = (performance.now() - startTimeMs) / 1000;
      const bState = computePromoBillboardState(elapsedSec, 6.5);
      if (!force && bState.activeSlideIndex === lastRenderedSlideIndex) {
        return false;
      }
      lastRenderedSlideIndex = bState.activeSlideIndex;
      setActivePromoSlideIndex(bState.activeSlideIndex);

      const currentSlide = PROMO_NATAL_SLIDES[bState.activeSlideIndex] || PROMO_NATAL_SLIDES[0];
      renderPromoFrameToCanvas(promoCtx, currentSlide);
      gl.bindTexture(gl.TEXTURE_2D, promoTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, promoCanvas);
      gl.bindTexture(gl.TEXTURE_2D, null);
      photoGpuMap.set(PROMO_NATAL_PHOTO.src, {
        tex: promoTex,
        width: PROMO_CANVAS_W,
        height: PROMO_CANVAS_H,
      });
      return true;
    };

    updatePromoTexture(true);

    let loadedImagesCount = 0;

    const computePrimaryPromoButtonScreenRect = () => {
      const cx = viewportW * 0.5;
      const cy = viewportH * 0.5;
      const zoom = state.zoomScale;
      const { totalPeriodWidth, totalPeriodHeight, columns, initialPanX, initialPanY } = layout;

      let bestDist = Infinity;
      let bestRect: { x: number; y: number; w: number; h: number } | null = null;

      for (let wrapX = -1; wrapX <= 1; wrapX++) {
        const periodBaseX = wrapX * totalPeriodWidth;
        for (let c = 0; c < columns.length; c++) {
          const col = columns[c];
          const screenX = periodBaseX + col.xOffset + state.panX;
          const alternatingShiftY = computeColumnVerticalShift(
            col.colIndex,
            state.panX,
            state.panY,
            state.columnShiftOffset,
            initialPanX,
            initialPanY
          );
          const colPanY = state.panY + col.verticalOffset + alternatingShiftY;

          for (let wrapY = -1; wrapY <= 1; wrapY++) {
            const periodBaseY = wrapY * totalPeriodHeight;
            for (let i = 0; i < col.items.length; i++) {
              const item = col.items[i];
              if (!item.photo.isPromoFrame) continue;

              const screenY = periodBaseY + item.yOffset + colPanY;
              const perTileScale = state.tileScale;
              const rawW = col.width * perTileScale;
              const rawH = item.height * perTileScale;
              const rawX = screenX + (col.width - rawW) * 0.5;
              const rawY = screenY + (item.height - rawH) * 0.5;

              const viewX = cx + (rawX - cx) * zoom;
              const viewY = cy + (rawY - cy) * zoom;
              const viewW = rawW * zoom;
              const viewH = rawH * zoom;

              if (
                viewX + viewW > 20 &&
                viewX < viewportW - 20 &&
                viewY + viewH > 20 &&
                viewY < viewportH - 20
              ) {
                const dist = Math.hypot(viewX + viewW * 0.5 - cx, viewY + viewH * 0.5 - cy);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestRect = { x: viewX, y: viewY, w: viewW, h: viewH };
                }
              }
            }
          }
        }
      }

      if (!bestRect || state.menuOpen) {
        setPromoButtonRect((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      // Map minimalist bottom button region [btnX = 150..390 out of 540, btnY = 668..728 out of 810] into tile rect
      const btnLeft = Math.round(bestRect.x + bestRect.w * (150 / PROMO_CANVAS_W));
      const btnWidth = Math.round(bestRect.w * (240 / PROMO_CANVAS_W));
      const btnTop = Math.round(bestRect.y + bestRect.h * (660 / PROMO_CANVAS_H));
      const btnHeight = Math.round(bestRect.h * (76 / PROMO_CANVAS_H));

      setPromoButtonRect({
        left: btnLeft,
        top: btnTop,
        width: btnWidth,
        height: btnHeight,
        visible: true,
      });
    };

    const syncDomAttributes = () => {
      container.dataset.state = loadedImagesCount > 0 ? 'ready' : 'loading';
      container.dataset.panX = String(Math.round(state.panX));
      container.dataset.panY = String(Math.round(state.panY));
      container.dataset.zoomScale = String(Number(state.zoomScale.toFixed(4)));
      container.dataset.tileScale = String(Number(state.tileScale.toFixed(4)));
      container.dataset.columnShift = String(Number(state.columnShiftOffset.toFixed(2)));
      container.dataset.menuOpen = state.menuOpen ? 'true' : 'false';
      container.dataset.menuProgress = String(Number(state.menuProgress.toFixed(3)));
      container.dataset.pressed = state.isPressed || state.pressHoldTimer > 0 ? 'true' : 'false';
      container.dataset.activeTile = state.activeTileKey || '';
      container.dataset.loadedImages = String(loadedImagesCount);
      container.dataset.photoOrder = activePhotos.slice(0, 4).map((p) => p.id).join(',');
      computePrimaryPromoButtonScreenRect();
    };

    const syncDimensions = () => {
      viewportW = window.innerWidth || 1440;
      viewportH = window.innerHeight || 900;
      dpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.35);

      displayCanvas.width = Math.round(viewportW * dpr);
      displayCanvas.height = Math.round(viewportH * dpr);
      displayCanvas.style.width = `${viewportW}px`;
      displayCanvas.style.height = `${viewportH}px`;

      fboWidth = Math.round(viewportW * (1 + 2 * OVERSCAN_PAD_RATIO) * dpr);
      fboHeight = Math.round(viewportH * (1 + 2 * OVERSCAN_PAD_RATIO) * dpr);

      if (gl && fbo && fboTexture) {
        gl.bindTexture(gl.TEXTURE_2D, fboTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          fboWidth,
          fboHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          fboTexture,
          0
        );
        gl.viewport(0, 0, fboWidth, fboHeight);
        gl.clearColor(0.0196, 0.0196, 0.0196, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      const prevPeriodW = layout.totalPeriodWidth;
      const prevPeriodH = layout.totalPeriodHeight;
      layout = createPortfolioLayout(viewportW, viewportH, activePhotos);
      if (prevPeriodW > 0 && prevPeriodH > 0) {
        state.panX = (state.panX / prevPeriodW) * layout.totalPeriodWidth;
        state.panY = (state.panY / prevPeriodH) * layout.totalPeriodHeight;
        state.targetPanX = (state.targetPanX / prevPeriodW) * layout.totalPeriodWidth;
        state.targetPanY = (state.targetPanY / prevPeriodH) * layout.totalPeriodHeight;
      }
    };

    syncDimensions();

    const renderFrame = () => {
      if (!gl || !tileProgram || !tileVao || !postProgram || !postVao || !fbo || !fboTexture) {
        return;
      }

      const padPxX = viewportW * OVERSCAN_PAD_RATIO;
      const padPxY = viewportH * OVERSCAN_PAD_RATIO;
      const bufferLogicalW = viewportW * (1 + 2 * OVERSCAN_PAD_RATIO);
      const bufferLogicalH = viewportH * (1 + 2 * OVERSCAN_PAD_RATIO);

      const cx = viewportW * 0.5;
      const cy = viewportH * 0.5;
      const zoom = state.zoomScale;

      const overscanRatio = OVERSCAN_PAD_RATIO + 0.16;
      const safeZoom = Math.max(0.60, Math.min(1.25, zoom || 1.0));
      const marginX = viewportW * overscanRatio + viewportW * (1 / safeZoom - 1) * 0.72;
      const marginY = viewportH * overscanRatio + viewportH * (1 / safeZoom - 1) * 0.72;

      const minScreenX = -marginX;
      const maxScreenX = viewportW + marginX;
      const minScreenY = -marginY;
      const maxScreenY = viewportH + marginY;

      const { totalPeriodWidth, totalPeriodHeight, columns, initialPanX, initialPanY } = layout;
      const startWrapX = Math.floor((minScreenX - state.panX) / totalPeriodWidth);
      const endWrapX = Math.floor((maxScreenX - state.panX) / totalPeriodWidth);

      // PASS 1: Render visible tiles directly on GPU into Framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fboWidth, fboHeight);
      gl.clearColor(0.0196, 0.0196, 0.0196, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(tileProgram);
      gl.bindVertexArray(tileVao);
      gl.uniform2f(uBufferSizeLoc, bufferLogicalW, bufferLogicalH);

      const innerZoom = 1.0 + (1.0 - state.pressAmount) * 0.008;
      let lastBoundTex: WebGLTexture | null = null;

      for (let wrapX = startWrapX; wrapX <= endWrapX; wrapX++) {
        const periodBaseX = wrapX * totalPeriodWidth;

        for (let c = 0; c < columns.length; c++) {
          const col = columns[c];
          const screenX = periodBaseX + col.xOffset + state.panX;
          if (screenX + col.width < minScreenX || screenX > maxScreenX) {
            continue;
          }

          const alternatingShiftY = computeColumnVerticalShift(
            col.colIndex,
            state.panX,
            state.panY,
            state.columnShiftOffset,
            initialPanX,
            initialPanY
          );
          const colPanY = state.panY + col.verticalOffset + alternatingShiftY;
          const startWrapY = Math.floor((minScreenY - colPanY) / totalPeriodHeight);
          const endWrapY = Math.floor((maxScreenY - colPanY) / totalPeriodHeight);

          for (let wrapY = startWrapY; wrapY <= endWrapY; wrapY++) {
            const periodBaseY = wrapY * totalPeriodHeight;

            for (let i = 0; i < col.items.length; i++) {
              const item = col.items[i];
              const screenY = periodBaseY + item.yOffset + colPanY;
              if (screenY + item.height < minScreenY || screenY > maxScreenY) {
                continue;
              }

              const perTileScale = state.tileScale;
              const rawW = col.width * perTileScale;
              const rawH = item.height * perTileScale;
              const rawX = screenX + (col.width - rawW) * 0.5;
              const rawY = screenY + (item.height - rawH) * 0.5;

              const drawX = padPxX + cx + (rawX - cx) * zoom;
              const drawY = padPxY + cy + (rawY - cy) * zoom;
              const drawW = rawW * zoom;
              const drawH = rawH * zoom;

              gl.uniform4f(uRectLoc, drawX, drawY, drawW, drawH);

              const gpuEntry = photoGpuMap.get(item.photo.src);
              if (gpuEntry && gpuEntry.tex) {
                const [u0, v0, uw, vh] = item.photo.isPromoFrame
                  ? [0, 0, 1, 1]
                  : computeCoverUvRect(
                      gpuEntry.width,
                      gpuEntry.height,
                      drawW,
                      drawH,
                      innerZoom
                    );
                gl.uniform4f(uUvRectLoc, u0, v0, uw, vh);
                gl.uniform1i(uHasTextureLoc, 1);
                if (lastBoundTex !== gpuEntry.tex) {
                  gl.activeTexture(gl.TEXTURE0);
                  gl.bindTexture(gl.TEXTURE_2D, gpuEntry.tex);
                  lastBoundTex = gpuEntry.tex;
                }
              } else {
                gl.uniform4f(uUvRectLoc, 0, 0, 1, 1);
                gl.uniform1i(uHasTextureLoc, 0);
                if (lastBoundTex !== dummyTex) {
                  gl.activeTexture(gl.TEXTURE0);
                  gl.bindTexture(gl.TEXTURE_2D, dummyTex);
                  lastBoundTex = dummyTex;
                }
                const fb = fallbackRgbMap.get(item.photo.src) || {
                  a: [0.2, 0.2, 0.2],
                  b: [0.08, 0.08, 0.08],
                };
                gl.uniform3f(uFallbackALoc, fb.a[0], fb.a[1], fb.a[2]);
                gl.uniform3f(uFallbackBLoc, fb.b[0], fb.b[1], fb.b[2]);
              }

              gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
          }
        }
      }

      // PASS 2: Render GPU Framebuffer to Screen with More Rounded 3D Spherical Corners & Menu Blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, displayCanvas.width, displayCanvas.height);
      gl.clearColor(0.0196, 0.0196, 0.0196, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(postProgram);
      gl.bindVertexArray(postVao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboTexture);

      gl.uniform1f(uPadRatioLoc, OVERSCAN_PAD_RATIO);
      gl.uniform1f(uPressAmountLoc, state.pressAmount);
      gl.uniform1f(uMenuProgressLoc, state.menuProgress);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindTexture(gl.TEXTURE_2D, null);
    };

    let frameId = 0;
    let loopRunning = false;
    let renderDirty = false;
    let lastTickTime = performance.now();

    const afterDraw = (cb: () => void) => {
      if (!gl) {
        frameId = window.setTimeout(cb, 16);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!sync) {
          cb();
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 4);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 16);
        }
      };
      frameId = window.setTimeout(poll, 4);
    };

    const step = () => {
      renderDirty = false;
      const now = performance.now();
      const dt = Math.min(0.12, Math.max(0.004, (now - lastTickTime) / 1000));
      lastTickTime = now;

      const stillMoving = stepKinematics(state, dt);
      renderFrame();

      if (!stillMoving || isSoftwareGl) {
        syncDomAttributes();
      }

      if (stillMoving || renderDirty) {
        if (isSoftwareGl) {
          afterDraw(() => {
            frameId = requestAnimationFrame(step);
          });
        } else {
          frameId = requestAnimationFrame(step);
        }
      } else {
        loopRunning = false;
        syncDomAttributes();
      }
    };

    const requestRender = () => {
      renderDirty = true;
      if (loopRunning) {
        return;
      }
      loopRunning = true;
      lastTickTime = performance.now();
      frameId = requestAnimationFrame(step);
    };

    // Lightweight billboard ticker: switches notice text every 6.5s without per-frame animation
    const billboardInterval = window.setInterval(() => {
      if (state.isDragging || state.menuOpen) return;
      const changed = updatePromoTexture();
      if (changed && !loopRunning) {
        renderFrame();
      }
    }, 250);

    setMenuOpenRef.current = (open: boolean) => {
      state.menuOpen = open;
      syncDomAttributes();
      requestRender();
    };

    let isMounted = true;
    let completedAssets = 0;
    let totalAssetsCount = 1;

    let introTimer: number | null = null;
    let maxIntroTimeout: number | null = null;

    const markIntroReady = () => {
      if (!isMounted || introTimer !== null) return;
      if (maxIntroTimeout !== null) {
        clearTimeout(maxIntroTimeout);
        maxIntroTimeout = null;
      }
      setLoadProgress(100);
      introTimer = window.setTimeout(() => {
        if (!isMounted) return;
        setIntroDone(true);
        state.vy = -65;
        requestRender();
      }, 420);
    };

    // Safety fallback timeout (15s) in case a network asset permanently stalls
    maxIntroTimeout = window.setTimeout(() => {
      markIntroReady();
    }, 15000);

    const onSingleAssetCompleted = () => {
      if (!isMounted) return;
      completedAssets += 1;
      const pct = Math.min(100, Math.round((completedAssets / Math.max(1, totalAssetsCount)) * 100));
      setLoadProgress(pct);
      syncDomAttributes();
      requestRender();
      if (completedAssets >= totalAssetsCount) {
        markIntroReady();
      }
    };

    const loadAllAssets = async () => {
      // 1. Fetch metadata for portfolio, feedbacks, and sound effects concurrently
      const [portfolioRes, feedbacksRes] = await Promise.all([
        fetch('/api/portfolio', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch('/api/feedbacks', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      ]);

      if (!isMounted) return;

      const photosToLoad: PortfolioPhoto[] =
        Array.isArray(portfolioRes?.photos) && portfolioRes.photos.length > 0
          ? portfolioRes.photos
          : PORTFOLIO_PHOTOS;

      const feedbacksToLoad: FeedbackPrint[] =
        Array.isArray(feedbacksRes?.feedbacks) && feedbacksRes.feedbacks.length > 0
          ? feedbacksRes.feedbacks
          : FEEDBACK_PRINTS;

      const staticImageUrls: string[] = [
        '/logo/logo.png',
        '/logo/eu.jpg',
        '/promos/natal-bg.jpg',
      ];

      const soundTypesCount = Object.keys(DEFAULT_SOUND_FILES).length;

      totalAssetsCount =
        photosToLoad.length + feedbacksToLoad.length + staticImageUrls.length + soundTypesCount;

      activePhotos = shufflePortfolioPhotos(photosToLoad);
      registerFallbacks(activePhotos);
      layout = createPortfolioLayout(viewportW, viewportH, activePhotos);
      renderFrame();
      syncDomAttributes();

      // 2. Preload portfolio photos & upload directly to WebGL textures
      photosToLoad.forEach((photo) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => {
          if (!isMounted) return;
          const naturalW = img.naturalWidth || 800;
          const naturalH = img.naturalHeight || 1200;
          const detectedAspect = normalizePhotoAspectRatio(naturalW / naturalH);
          if (Math.abs(photo.aspectRatio - detectedAspect) > 0.01) {
            photo.aspectRatio = detectedAspect;
            layout = createPortfolioLayout(viewportW, viewportH, activePhotos);
          }

          let tex: WebGLTexture | null = null;
          if (gl) {
            tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.bindTexture(gl.TEXTURE_2D, null);
          }
          photoGpuMap.set(photo.src, {
            tex,
            width: naturalW,
            height: naturalH,
          });
          onSingleAssetCompleted();
        };
        img.onerror = () => {
          onSingleAssetCompleted();
        };
        img.src = photo.src;
      });

      // 3. Preload 1:1 Feedback prints into browser cache
      feedbacksToLoad.forEach((fb) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          img.decode().catch(() => {}).finally(() => {
            onSingleAssetCompleted();
          });
        };
        img.onerror = () => {
          onSingleAssetCompleted();
        };
        img.src = fb.src;
      });

      // 4. Preload static assets (logo and promo background)
      staticImageUrls.forEach((url) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          img.decode().catch(() => {}).finally(() => {
            onSingleAssetCompleted();
          });
        };
        img.onerror = () => {
          onSingleAssetCompleted();
        };
        img.src = url;
      });

      // 5. Preload custom sounds & AudioBuffers
      preloadCustomSoundsFromFolder(onSingleAssetCompleted).catch(() => {
        for (let i = 0; i < soundTypesCount; i++) {
          onSingleAssetCompleted();
        }
      });
    };

    loadAllAssets();

    let pointerId: number | null = null;
    let downX = 0;
    let downY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const pointerHistory: { x: number; y: number; t: number }[] = [];

    const handlePointerDown = (clientX: number, clientY: number, id: number) => {
      if (state.menuOpen) return;
      pointerId = id;
      downX = clientX;
      downY = clientY;
      lastPointerX = clientX;
      lastPointerY = clientY;
      const now = performance.now();
      pointerHistory.length = 0;
      pointerHistory.push({ x: clientX, y: clientY, t: now });

      state.isDragging = true;
      state.isPressed = true;
      state.pressHoldTimer = 0.30;
      state.targetPanX = state.panX;
      state.targetPanY = state.panY;
      state.vx = 0;
      state.vy = 0;

      const hit = findTileAtPoint(clientX, clientY, viewportW, viewportH, state, layout);
      state.activeTileKey = hit ? hit.key : null;

      syncDomAttributes();
      requestRender();
    };

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!state.isDragging || state.menuOpen) return;
      const now = performance.now();

      const dx = clientX - lastPointerX;
      const dy = clientY - lastPointerY;

      state.targetPanX += dx / state.zoomScale;
      state.targetPanY += dy / state.zoomScale;

      pointerHistory.push({ x: clientX, y: clientY, t: now });
      while (pointerHistory.length > 10 && now - pointerHistory[0].t > 110) {
        pointerHistory.shift();
      }

      const anchor = pointerHistory[0];
      const windowDt = Math.max(0.012, (now - anchor.t) / 1000);
      const windowVx = (clientX - anchor.x) / windowDt;
      const windowVy = (clientY - anchor.y) / windowDt;

      state.vx = Math.max(-2400, Math.min(2400, state.vx * 0.35 + windowVx * 0.65));
      state.vy = Math.max(-2400, Math.min(2400, state.vy * 0.35 + windowVy * 0.65));

      lastPointerX = clientX;
      lastPointerY = clientY;

      requestRender();
    };

    const handlePointerUp = (clientX?: number, clientY?: number) => {
      if (!state.isDragging && !state.isPressed) return;
      const now = performance.now();
      const upX = clientX ?? lastPointerX;
      const upY = clientY ?? lastPointerY;
      const totalDragDist = Math.hypot(upX - downX, upY - downY);

      pointerId = null;
      state.isDragging = false;
      state.isPressed = false;

      // Check if user tapped/clicked the "Reservar" button inside any repeated Promo Frame instance
      if (totalDragDist < 12 && !state.menuOpen) {
        const hit = findTileAtPoint(upX, upY, viewportW, viewportH, state, layout);
        if (hit && hit.photo.isPromoFrame) {
          const cx = viewportW * 0.5;
          const cy = viewportH * 0.5;
          const worldX = cx + (upX - cx) / state.zoomScale;
          const worldY = cy + (upY - cy) / state.zoomScale;
          const localU = (worldX - hit.x) / hit.width;
          const localV = (worldY - hit.y) / hit.height;

          if (localV >= 0.78 && localV <= 0.93 && localU >= 0.22 && localU <= 0.78) {
            // Tapped "Reservar" button at the bottom of the Promo Frame
            reservarLinkRef.current?.click();
          }
        }
      }

      const lastSample = pointerHistory[pointerHistory.length - 1];
      if (!lastSample || now - lastSample.t > 140 || totalDragDist < 6) {
        state.vx = 0;
        state.vy = 0;
      } else {
        state.vx *= 1.12;
        state.vy *= 1.12;
      }

      syncDomAttributes();
      requestRender();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      handlePointerDown(e.clientX, e.clientY, 1);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (pointerId !== 1) return;
      handlePointerMove(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (pointerId === 1) handlePointerUp(e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      handlePointerDown(t.clientX, t.clientY, t.identifier);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      e.preventDefault();
      const t = e.touches[0];
      handlePointerMove(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches?.[0];
      handlePointerUp(t?.clientX, t?.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      if (state.menuOpen) return;
      e.preventDefault();
      state.targetPanX -= e.deltaX * 0.9;
      state.targetPanY -= e.deltaY * 0.9;
      state.vx = -e.deltaX * 3.2;
      state.vy = -e.deltaY * 3.2;
      requestRender();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (state.menuOpen) return;
      const impulse = 560;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        state.vx = impulse;
        requestRender();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        state.vx = -impulse;
        requestRender();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        state.vy = impulse;
        requestRender();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        state.vy = -impulse;
        requestRender();
      } else if (e.key === ' ' || e.key === 'Enter') {
        state.isPressed = true;
        state.pressHoldTimer = 0.30;
        syncDomAttributes();
        requestRender();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        state.isPressed = false;
        syncDomAttributes();
        requestRender();
      }
    };

    const onResize = () => {
      syncDimensions();
      renderFrame();
      syncDomAttributes();
    };

    displayCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseleave', () => handlePointerUp());

    displayCanvas.addEventListener('touchstart', onTouchStart, { passive: true });
    displayCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    displayCanvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearInterval(billboardInterval);
      if (maxIntroTimeout !== null) clearTimeout(maxIntroTimeout);
      if (introTimer !== null) clearTimeout(introTimer);
      setMenuOpenRef.current = null;
      displayCanvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      displayCanvas.removeEventListener('touchstart', onTouchStart);
      displayCanvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      displayCanvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      if (gl) {
        photoGpuMap.forEach((entry) => {
          if (entry.tex) gl.deleteTexture(entry.tex);
        });
        if (dummyTex) gl.deleteTexture(dummyTex);
        if (fboTexture) gl.deleteTexture(fboTexture);
        if (fbo) gl.deleteFramebuffer(fbo);
        if (tileVao) gl.deleteVertexArray(tileVao);
        if (postVao) gl.deleteVertexArray(postVao);
        if (tileProgram) gl.deleteProgram(tileProgram);
        if (postProgram) gl.deleteProgram(postProgram);
      }
    };
  }, []);

  const currentPromoSlide = PROMO_NATAL_SLIDES[activePromoSlideIndex] || PROMO_NATAL_SLIDES[0];

  return (
    <>
      <div
        ref={containerRef}
        data-testid="infinite-portfolio"
        data-state="loading"
        data-pan-x="0"
        data-pan-y="0"
        data-zoom-scale="1"
        data-tile-scale="1"
        data-column-shift="0"
        data-menu-open="false"
        data-menu-progress="0"
        data-pressed="false"
        data-active-tile=""
        data-loaded-images="0"
        data-photo-order=""
        data-promo-slide-index={String(activePromoSlideIndex)}
        data-promo-slide-headline={currentPromoSlide.headline}
        role="application"
        aria-label="Galantis Infinite Portfolio Canvas"
        tabIndex={0}
        className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#050505] cursor-grab active:cursor-grabbing touch-none outline-none"
      >
        <canvas
          ref={glCanvasRef}
          data-testid="portfolio-webgl-canvas"
          className="block w-full h-full"
        />

        {/* Synchronized native anchor for the Promo Frame "RESERVAR" button */}
        <a
          ref={reservarLinkRef}
          href="https://wa.me/55319995977942?text=Ol%C3%A1!%20Quero%20reservar%20minha%20Sess%C3%A3o%20Especial%20de%20Natal%20na%20Galantis."
          target="_blank"
          rel="noopener noreferrer"
          data-testid="promo-reservar-button"
          aria-label="Reservar Sessão Especial de Natal"
          className={`fixed z-10 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
            promoButtonRect.visible && !menuOpen
              ? 'pointer-events-auto cursor-pointer'
              : 'pointer-events-none opacity-0'
          }`}
          style={{
            left: `${promoButtonRect.left}px`,
            top: `${promoButtonRect.top}px`,
            width: `${promoButtonRect.width}px`,
            height: `${promoButtonRect.height}px`,
          }}
        >
          <span className="sr-only">
            Reservar Sessão Especial de Natal - {currentPromoSlide.headline}
          </span>
        </a>
      </div>

      {/* Opening Preloader Animation */}
      <div
        data-testid="intro-loader"
        data-done={introDone ? 'true' : 'false'}
        aria-hidden={introDone}
        className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#050505] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          introDone
            ? 'opacity-0 pointer-events-none scale-105 blur-md'
            : 'opacity-100 pointer-events-auto scale-100 blur-0'
        }`}
      >
        <div className="flex flex-col items-center gap-6 px-6">
          <img
            src="/logo/logo.png"
            alt="GALANTIS"
            className="h-[120px] md:h-[168px] w-auto object-contain select-none transition-transform duration-1000 drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]"
            style={{
              transform: introDone ? 'translate3d(0, -10px, 0)' : 'translate3d(0, 0, 0)',
            }}
          />

          <div className="w-48 md:w-64 h-[1.5px] bg-white/15 overflow-hidden relative">
            <div
              data-testid="intro-progress-bar"
              className="h-full bg-white/85 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(12, loadProgress)}%` }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
