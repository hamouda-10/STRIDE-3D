import type * as THREEType from 'three';
import { FLAVOURS, SW, clamp, mixHex, seededRand } from '../data/strideData';

export const BH = (849 + 8) / (403 + 8);

export interface BarState {
  x: number;
  y: number;
  h: number;
  rz: number;
  ry: number;
  rx: number;
  z: number;
  op: number;
  sx: number;
  sy: number;
  shadow: number;
}

interface BarInstance {
  group: THREEType.Group;
  frontMesh: THREEType.Mesh<THREEType.BufferGeometry, THREEType.MeshPhysicalMaterial>;
  backMesh: THREEType.Mesh<THREEType.BufferGeometry, THREEType.MeshPhysicalMaterial>;
  shadowMesh: THREEType.Mesh<THREEType.PlaneGeometry, THREEType.MeshBasicMaterial>;
  flavourIdx: number;
  barIndex: number;
}

export interface Bar3DEngine {
  ready: boolean;
  setViewport: (vw: number, vh: number) => void;
  placePoolBar: (poolIdx: number, state: BarState, flavourIdx: number, barIndex: number) => void;
  hidePoolBar: (poolIdx: number) => void;
  placeTraveller: (state: BarState, flavourIdx: number, barIndex: number) => void;
  hideTraveller: () => void;
  raycastHeroBars: (clientX: number, clientY: number) => number | null;
  render: () => void;
  dispose: () => void;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function createPillowGeometry(THREE: typeof THREEType, isBack: boolean): THREEType.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, BH, 30, 64);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const CR = 0.062;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const ex = Math.abs(2 * u - 1);
    const ev = Math.min(v, 1 - v);

    let z: number;
    if (ev < CR) {
      z = 0.006 + 0.006 * Math.abs(Math.sin(u * Math.PI * 34));
    } else {
      const across = Math.pow(Math.max(0, 1 - Math.pow(ex, 2.6)), 0.62);
      const along = Math.pow(clamp((ev - CR) / 0.11, 0, 1), 0.7);
      z = 0.012 + 0.118 * across * along + 0.004 * Math.sin(23 * u + 31 * v) * across;
    }

    pos.setZ(i, isBack ? -z : z);
    if (isBack) {
      uv.setX(i, 1 - u);
    }
  }

  if (isBack && geo.index) {
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createShadowTexture(THREE: typeof THREEType): THREEType.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(128, 256);
  ctx.scale(1, 2);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 126);
  grad.addColorStop(0, 'rgba(30, 18, 40, 0.55)');
  grad.addColorStop(0.45, 'rgba(30, 18, 40, 0.26)');
  grad.addColorStop(0.75, 'rgba(30, 18, 40, 0.07)');
  grad.addColorStop(1, 'rgba(30, 18, 40, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFlavourTextures(
  THREE: typeof THREEType,
  img: HTMLImageElement,
  flavourIdx: number,
) {
  const flav = FLAVOURS[flavourIdx];
  const [bx, by, bw, bh] = flav.box;
  const W = Math.round((bw + 8) * 1.5 * 0.75);
  const H = Math.round(W * BH);
  const scale = img.naturalWidth / SW;
  const sx = (bx - 4) * scale;
  const sy = (by - 4) * scale;
  const sw = (bw + 8) * scale;
  const sh = (bh + 8) * scale;

  // Front canvas texture
  const fc = document.createElement('canvas');
  fc.width = W;
  fc.height = H;
  const fctx = fc.getContext('2d')!;
  fctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const frontTex = new THREE.CanvasTexture(fc);
  frontTex.colorSpace = THREE.SRGBColorSpace;
  frontTex.anisotropy = 8;

  // Back canvas texture
  const bc = document.createElement('canvas');
  bc.width = W;
  bc.height = H;
  const bctx = bc.getContext('2d')!;

  // 1. Mirrored silhouette & crimp shading
  bctx.save();
  bctx.translate(W, 0);
  bctx.scale(-1, 1);
  bctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  bctx.restore();

  // 2. Colour fill inside silhouette
  bctx.save();
  bctx.globalCompositeOperation = 'source-atop';
  bctx.fillStyle = flav.color;
  bctx.globalAlpha = 0.35;
  bctx.fillRect(0, 0, W, H * 0.075);
  bctx.fillRect(0, H * 0.925, W, H * 0.075);
  bctx.globalAlpha = 0.9;
  bctx.fillRect(0, H * 0.075, W, H * 0.85);

  // 3. Horizontal sheen gradient over body
  bctx.globalAlpha = 1;
  const sheen = bctx.createLinearGradient(0, 0, W, 0);
  sheen.addColorStop(0, 'rgba(0,0,0,.10)');
  sheen.addColorStop(0.28, 'rgba(255,255,255,.14)');
  sheen.addColorStop(0.5, 'rgba(0,0,0,0)');
  sheen.addColorStop(0.8, 'rgba(0,0,0,.04)');
  sheen.addColorStop(1, 'rgba(0,0,0,.14)');
  bctx.fillStyle = sheen;
  bctx.fillRect(0, H * 0.075, W, H * 0.85);
  bctx.restore();

  // 4. Typography & panels
  const ink = mixHex(flav.color, '#1c1a1f', 0.78);
  bctx.fillStyle = ink;
  bctx.textBaseline = 'middle';

  // Brand + flavour subtitle
  bctx.textAlign = 'center';
  bctx.font = `400 ${0.085 * W}px "Archivo Black", sans-serif`;
  bctx.fillText('STRIDE', 0.5 * W, 0.15 * H);

  bctx.font = `500 ${0.042 * W}px "DM Mono", monospace`;
  bctx.fillText(`${flav.name.toUpperCase()} · 50 G`, 0.5 * W, 0.185 * H);

  // Nutrition panel
  const panX = 0.15 * W;
  const panY = 0.215 * H;
  const panW = 0.7 * W;
  const panH = 0.36 * H;
  bctx.save();
  bctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  roundRectPath(bctx, panX, panY, panW, panH, 0.03 * W);
  bctx.fill();
  bctx.restore();

  const innerL = panX + 0.05 * W;
  const innerR = panX + panW - 0.05 * W;
  bctx.fillStyle = ink;
  bctx.textAlign = 'left';
  bctx.font = `400 ${0.058 * W}px "Archivo Black", sans-serif`;
  bctx.fillText('NUTRITION', innerL, panY + 0.034 * H);

  bctx.font = `400 ${0.032 * W}px "DM Mono", monospace`;
  bctx.fillText('Serving size 1 bar (50 g)', innerL, panY + 0.064 * H);

  // Solid rule
  bctx.fillRect(innerL, panY + 0.082 * H, innerR - innerL, Math.max(2, 0.005 * W));

  const rows: readonly [string, string, number][] = [
    ['Calories', '210', 500],
    ['Protein', '12 g', 500],
    ['Total fat', '9 g', 400],
    ['Carbohydrate', '22 g', 400],
    ['Fibre', '6 g', 400],
    ['Sugars', '8 g', 400],
    ['Salt', '0.2 g', 400],
  ];

  const rowStart = panY + 0.114 * H;
  const rowStep = 0.034 * H;
  rows.forEach(([label, val, weight], rIdx) => {
    const ry = rowStart + rIdx * rowStep;
    bctx.fillStyle = ink;
    bctx.font = `${weight} ${0.033 * W}px "DM Mono", monospace`;
    bctx.textAlign = 'left';
    bctx.fillText(label, innerL, ry);
    bctx.textAlign = 'right';
    bctx.fillText(val, innerR, ry);

    // Hairline
    bctx.save();
    bctx.globalAlpha = 0.22;
    bctx.fillRect(innerL, ry + rowStep * 0.5, innerR - innerL, Math.max(1, 0.002 * W));
    bctx.restore();
  });

  // Ingredients
  bctx.fillStyle = ink;
  bctx.textAlign = 'left';
  bctx.font = `500 ${0.035 * W}px "DM Mono", monospace`;
  bctx.fillText('INGREDIENTS', 0.15 * W, 0.62 * H);

  bctx.font = `400 ${0.034 * W}px "DM Mono", monospace`;
  const words = flav.ingredients.split(' ');
  const maxWidth = 0.7 * W;
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (bctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, li) => {
    bctx.fillText(l, 0.15 * W, 0.648 * H + li * 0.022 * H);
  });

  // Barcode white rounded card at 73.5% height
  const bcX = 0.22 * W;
  const bcY = 0.735 * H;
  const bcW = 0.56 * W;
  const bcH = 0.105 * H;
  bctx.save();
  bctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  roundRectPath(bctx, bcX, bcY, bcW, bcH, 0.025 * W);
  bctx.fill();
  bctx.restore();

  const rand = seededRand(1009 + flavourIdx * 7919);
  const barsLeft = bcX + 0.045 * W;
  const barsRight = bcX + bcW - 0.045 * W;
  const barsTop = bcY + 0.015 * H;
  const barsH = 0.058 * H;
  bctx.fillStyle = ink;
  let curX = barsLeft;
  while (curX < barsRight - 0.01 * W) {
    const bwBar = (0.004 + rand() * 0.012) * W;
    const gap = (0.004 + rand() * 0.01) * W;
    if (curX + bwBar > barsRight) break;
    bctx.fillRect(curX, barsTop, bwBar, barsH);
    curX += bwBar + gap;
  }
  bctx.textAlign = 'center';
  bctx.font = `400 ${0.028 * W}px "DM Mono", monospace`;
  bctx.fillText(flav.barcode, 0.5 * W, bcY + 0.088 * H);

  // Footer
  bctx.font = `500 ${0.036 * W}px "DM Mono", monospace`;
  bctx.fillText('PRESSED, NOT BAKED', 0.5 * W, 0.885 * H);

  const backTex = new THREE.CanvasTexture(bc);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = 8;

  return { frontTex, backTex };
}

function loadSheetImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

export async function initBar3DEngine(
  canvas: HTMLCanvasElement,
  sheetUrl: string,
): Promise<Bar3DEngine> {
  const THREE = (await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'
  )) as typeof THREEType;

  const { RoomEnvironment } = (await import(
    /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js'
  )) as { RoomEnvironment: new () => THREEType.Scene };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(-0.6, 0.9, 1.4);
  scene.add(keyLight);

  let vw = window.innerWidth;
  let vh = window.innerHeight;
  const camera = new THREE.PerspectiveCamera(45, vw / vh, 10, 8000);

  const updateCameraAndSize = (w: number, h: number) => {
    vw = Math.max(1, w);
    vh = Math.max(1, h);
    const D = clamp(1500 * Math.min(vw / 1440, vh / 900), 1000, 2200);
    const fov = (2 * Math.atan(vh / 2 / D) * 180) / Math.PI;
    camera.fov = fov;
    camera.aspect = vw / vh;
    camera.near = 10;
    camera.far = 4 * D;
    camera.position.set(0, 0, D);
    camera.updateProjectionMatrix();

    const maxDpr = vw < 820 ? 1.75 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(vw, vh, false);
    canvas.style.width = '100vw';
    canvas.style.height = `${vh}px`;
  };
  updateCameraAndSize(vw, vh);

  const frontGeo = createPillowGeometry(THREE, false);
  const backGeo = createPillowGeometry(THREE, true);
  const shadowGeo = new THREE.PlaneGeometry(1.25, 1.04 * BH);
  const shadowTex = createShadowTexture(THREE);

  // Load fonts and sheet image before drawing back textures
  const [, img] = await Promise.all([
    Promise.all([
      document.fonts.load('400 100px "Archivo Black"'),
      document.fonts.load('400 20px "DM Mono"'),
      document.fonts.load('500 20px "DM Mono"'),
      document.fonts.load('700 20px "Inter"'),
    ]).catch(() => undefined),
    loadSheetImage(sheetUrl),
  ]);

  const textures = FLAVOURS.map((_, idx) => buildFlavourTextures(THREE, img, idx));

  const createBar = (): BarInstance => {
    const group = new THREE.Group();
    group.rotation.order = 'ZYX';

    const frontMat = new THREE.MeshPhysicalMaterial({
      map: textures[1].frontTex,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.45,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.42,
    });
    const backMat = new THREE.MeshPhysicalMaterial({
      map: textures[1].backTex,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.45,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.32,
      envMapIntensity: 0.42,
    });

    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    const backMesh = new THREE.Mesh(backGeo, backMat);
    group.add(frontMesh);
    group.add(backMesh);

    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.renderOrder = -1;

    group.visible = false;
    shadowMesh.visible = false;

    scene.add(shadowMesh);
    scene.add(group);

    return {
      group,
      frontMesh,
      backMesh,
      shadowMesh,
      flavourIdx: 1,
      barIndex: 0,
    };
  };

  // Pool of 11 bars + 1 traveller
  const pool: BarInstance[] = Array.from({ length: 11 }, () => createBar());
  const traveller: BarInstance = createBar();

  const applyBarState = (inst: BarInstance, state: BarState, flavourIdx: number, barIndex: number) => {
    if (state.op <= 0.01 || state.h <= 0.5) {
      inst.group.visible = false;
      inst.shadowMesh.visible = false;
      return;
    }

    if (inst.flavourIdx !== flavourIdx) {
      inst.flavourIdx = flavourIdx;
      const tex = textures[flavourIdx];
      inst.frontMesh.material.map = tex.frontTex;
      inst.frontMesh.material.needsUpdate = true;
      inst.backMesh.material.map = tex.backTex;
      inst.backMesh.material.needsUpdate = true;
    }

    inst.barIndex = barIndex;
    inst.frontMesh.userData.barIndex = barIndex;
    inst.backMesh.userData.barIndex = barIndex;

    const baseScale = state.h / BH;
    inst.group.visible = true;
    inst.group.position.set(state.x - vw / 2, vh / 2 - state.y, state.z);
    inst.group.scale.set(baseScale * state.sx, baseScale * state.sy, baseScale);
    inst.group.rotation.set(
      (state.rx * Math.PI) / 180,
      (state.ry * Math.PI) / 180,
      (-state.rz * Math.PI) / 180,
    );
    inst.frontMesh.material.opacity = state.op;
    inst.backMesh.material.opacity = state.op;

    const shadowOp = 0.5 * state.op * state.shadow;
    if (shadowOp <= 0.005) {
      inst.shadowMesh.visible = false;
    } else {
      inst.shadowMesh.visible = true;
      inst.shadowMesh.position.set(
        state.x - vw / 2,
        vh / 2 - state.y - 0.05 * state.h,
        state.z - 0.32 * state.h,
      );
      inst.shadowMesh.rotation.set(0, 0, (-state.rz * Math.PI) / 180);
      const ryRad = (state.ry * Math.PI) / 180;
      const widthMult = Math.max(0.3, Math.abs(Math.cos(ryRad)));
      inst.shadowMesh.scale.set(baseScale * state.sx * widthMult, baseScale * state.sy, 1);
      inst.shadowMesh.material.opacity = shadowOp;
    }
  };

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  return {
    ready: true,
    setViewport: updateCameraAndSize,
    placePoolBar: (poolIdx, state, flavourIdx, barIndex) => {
      const inst = pool[poolIdx];
      if (inst) applyBarState(inst, state, flavourIdx, barIndex);
    },
    hidePoolBar: (poolIdx) => {
      const inst = pool[poolIdx];
      if (inst) {
        inst.group.visible = false;
        inst.shadowMesh.visible = false;
      }
    },
    placeTraveller: (state, flavourIdx, barIndex) => {
      applyBarState(traveller, state, flavourIdx, barIndex);
    },
    hideTraveller: () => {
      traveller.group.visible = false;
      traveller.shadowMesh.visible = false;
    },
    raycastHeroBars: (clientX, clientY) => {
      pointerNDC.x = (clientX / vw) * 2 - 1;
      pointerNDC.y = -(clientY / vh) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const targets: THREEType.Object3D[] = [];
      for (const inst of pool) {
        if (inst.group.visible) {
          targets.push(inst.frontMesh, inst.backMesh);
        }
      }
      if (traveller.group.visible) {
        targets.push(traveller.frontMesh, traveller.backMesh);
      }
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.barIndex;
        return typeof idx === 'number' ? idx : null;
      }
      return null;
    },
    render: () => {
      renderer.render(scene, camera);
    },
    dispose: () => {
      frontGeo.dispose();
      backGeo.dispose();
      shadowGeo.dispose();
      shadowTex.dispose();
      envRT.dispose();
      textures.forEach((t) => {
        t.frontTex.dispose();
        t.backTex.dispose();
      });
      [...pool, traveller].forEach((inst) => {
        inst.frontMesh.material.dispose();
        inst.backMesh.material.dispose();
        inst.shadowMesh.material.dispose();
      });
      renderer.dispose();
    },
  };
}
