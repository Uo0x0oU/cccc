import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

// ── 定数 ─────────────────────────────────────────
const DIRECTIONS = ['上', '下', '左', '右'];
const ZONE_THRESHOLD = 0.18;  // 画面端からの割合
const COOLDOWN_MS = 1800;     // 指検出後の再検出抑制時間

// 一般的な視力検査表の刻み（小数視力）
const ACUITY_ROWS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
const RINGS_PER_ROW = 4;
const ROW_H = 72, TOP_PAD = 20, BOTTOM_PAD = 12;
const AREA_X0 = 60, AREA_X1 = 380;
const CANVAS_W = 560;

let currentDir = '';
let locked = false; // 正解検出〜次の問題表示まで入力をブロック
let chartDirs = [];          // chartDirs[row][col] = 向き
let active = { row: 0, idx: 0 }; // 現在出題中の環

// ── ランドルト環チャート描画 ──────────────────────
const chartCanvas = document.getElementById('chart-canvas');
const cctx = chartCanvas.getContext('2d');
chartCanvas.width = CANVAS_W;
chartCanvas.height = ACUITY_ROWS.length * ROW_H + TOP_PAD + BOTTOM_PAD;

function gapAngle(dir) {
  switch (dir) {
    case '右': return 0;
    case '下': return Math.PI / 2;
    case '左': return Math.PI;
    case '上': return -Math.PI / 2;
  }
}

function randomDir(exclude) {
  const choices = DIRECTIONS.filter(d => d !== exclude);
  return choices[Math.floor(Math.random() * choices.length)];
}

function ringDiameter(acuity) {
  const K = 14, minD = 12, maxD = 60;
  return Math.min(maxD, Math.max(minD, K / acuity));
}

function rowCenterY(rowIdx) {
  return TOP_PAD + rowIdx * ROW_H + ROW_H / 2;
}

function ringCenterX(idx) {
  const step = (AREA_X1 - AREA_X0) / RINGS_PER_ROW;
  return AREA_X0 + step * (idx + 0.5);
}

function drawRing(ctx, cx, cy, R, stroke, dir) {
  const gap = Math.PI / 6;
  const center = gapAngle(dir);
  ctx.beginPath();
  ctx.arc(cx, cy, R, center + gap, center - gap + Math.PI * 2);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = stroke;
  ctx.lineCap = 'butt';
  ctx.stroke();
}

function drawSparkle(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2 * scale;
  const s = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
  ctx.moveTo(x - s * 0.7, y - s * 0.7); ctx.lineTo(x + s * 0.7, y + s * 0.7);
  ctx.moveTo(x - s * 0.7, y + s * 0.7); ctx.lineTo(x + s * 0.7, y - s * 0.7);
  ctx.stroke();
  ctx.restore();
}

function initChart() {
  chartDirs = ACUITY_ROWS.map(() =>
    Array.from({ length: RINGS_PER_ROW }, () => randomDir())
  );
}

// 起動時のみ使用: アクティブな環の位置をランダムに決めて初期化
function initActiveRing() {
  active = {
    row: Math.floor(Math.random() * ACUITY_ROWS.length),
    idx: Math.floor(Math.random() * RINGS_PER_ROW)
  };
  rotateActiveDir();
}

// 正解時: 同じ環の向きだけをランダムに変える
function rotateActiveDir(excludeDir) {
  const dir = randomDir(excludeDir);
  chartDirs[active.row][active.idx] = dir;
  currentDir = dir;
  drawChart();
}

function drawChart() {
  const W = chartCanvas.width, H = chartCanvas.height;
  cctx.clearRect(0, 0, W, H);

  // 背景（方眼紙風）
  cctx.fillStyle = '#fff';
  cctx.fillRect(0, 0, W, H);
  cctx.strokeStyle = 'rgba(160,180,210,0.25)';
  cctx.lineWidth = 1;
  for (let x = 0; x < W; x += 20) {
    cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, H); cctx.stroke();
  }
  for (let y = 0; y < H; y += 20) {
    cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(W, y); cctx.stroke();
  }

  ACUITY_ROWS.forEach((acuity, rowIdx) => {
    const cy = rowCenterY(rowIdx);
    const D = ringDiameter(acuity);
    const R = D / 2, stroke = Math.max(3, D / 4.2);

    // 視力値ラベル
    cctx.fillStyle = '#222';
    cctx.font = 'bold 16px "Segoe UI", sans-serif';
    cctx.textAlign = 'left';
    cctx.textBaseline = 'middle';
    cctx.fillText(acuity.toFixed(1), 14, cy);

    // 行の区切り線
    cctx.strokeStyle = 'rgba(0,0,0,0.12)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(8, cy + ROW_H / 2);
    cctx.lineTo(W - 8, cy + ROW_H / 2);
    cctx.stroke();

    for (let i = 0; i < RINGS_PER_ROW; i++) {
      const cx = ringCenterX(i);
      const dir = chartDirs[rowIdx][i];
      drawRing(cctx, cx, cy, R, stroke, dir);

      const isActive = (rowIdx === active.row && i === active.idx);
      if (isActive) {
        // 強調用の破線サークル
        cctx.save();
        cctx.setLineDash([4, 4]);
        cctx.strokeStyle = '#ff6b81';
        cctx.lineWidth = 2;
        cctx.beginPath();
        cctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
        cctx.stroke();
        cctx.restore();

        drawSparkle(cctx, cx + R + 4, cy - R - 6);
        drawSparkle(cctx, cx - R - 8, cy + R + 8, 0.7);

        // 「これは？」矢印
        const ax0 = Math.min(W - 14, cx + R + 70);
        const ax1 = cx + R + 14;
        cctx.strokeStyle = '#2b2b3d';
        cctx.fillStyle = '#2b2b3d';
        cctx.lineWidth = 2;
        cctx.beginPath();
        cctx.moveTo(ax0, cy);
        cctx.lineTo(ax1, cy);
        cctx.stroke();
        cctx.beginPath();
        cctx.moveTo(ax1, cy);
        cctx.lineTo(ax1 + 8, cy - 5);
        cctx.lineTo(ax1 + 8, cy + 5);
        cctx.closePath();
        cctx.fill();

        cctx.font = 'bold 14px "Segoe UI", sans-serif';
        cctx.textAlign = 'left';
        cctx.fillText('これは？', Math.min(W - 90, ax0 + 4), cy - 12);
      }
    }
  });
}

// ── 音声合成 ──────────────────────────────────────
// 次の問題へ移行: 発話終了 + 1.5秒後
function speakAndAdvance(text) {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text + 'です');
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  utter.pitch = 1.1;
  utter.onend = () => {
    setTimeout(() => {
      locked = false;
      cooldownActive = false;
      clearZones();
      rotateActiveDir(currentDir);
      document.getElementById('answer-giant').textContent = '';
    }, 1500);
  };
  window.speechSynthesis.speak(utter);
}

// ── 方向検出 ──────────────────────────────────────
let cooldownActive = false;
let cooldownStart = 0;

function clearZones() {
  document.querySelectorAll('.dir-zone').forEach(z => z.classList.remove('active'));
}

function detectDirection(nx, ny) {
  if (ny < ZONE_THRESHOLD)     return '上';
  if (ny > 1 - ZONE_THRESHOLD) return '下';
  if (nx < ZONE_THRESHOLD)     return '左';
  if (nx > 1 - ZONE_THRESHOLD) return '右';
  return null;
}

function activateZone(dir) {
  clearZones();
  if (!dir) return;
  const map = { '上': 'zone-up', '下': 'zone-down', '左': 'zone-left', '右': 'zone-right' };
  document.getElementById(map[dir])?.classList.add('active');
}

function onFingerDetected(fingerDir) {
  if (cooldownActive || locked) return;

  // 指の向きが出題中の環の向きと一致した場合のみ反応
  if (fingerDir !== currentDir) {
    activateZone(fingerDir); // ゾーンはハイライトするが何もしない
    return;
  }

  // 正解検出 → 出題する環を変更して新しい向きを音声で伝える
  locked = true;
  cooldownActive = true;
  cooldownStart = performance.now();
  activateZone(fingerDir);

  rotateActiveDir(currentDir);
  document.getElementById('answer-giant').textContent = `${currentDir}です。`;

  speakAndAdvance(currentDir);
}

// ── MediaPipe HandLandmarker ──────────────────────
const video   = document.getElementById('video');
const hCanvas = document.getElementById('hand-canvas');
const hctx    = hCanvas.getContext('2d');

let handLandmarker = null;
let lastVideoTime = -1;

async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
  document.getElementById('status').textContent = 'ハンドトラッキング準備完了';
  startCamera();
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.addEventListener('loadeddata', () => {
      hCanvas.width  = video.videoWidth;
      hCanvas.height = video.videoHeight;
      document.getElementById('status').textContent = '検出中…';
      requestAnimationFrame(detect);
    });
  } catch (e) {
    document.getElementById('status').textContent = 'カメラエラー: ' + e.message;
  }
}

function detect(now) {
  if (video.readyState < 2) { requestAnimationFrame(detect); return; }
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, now);

    hctx.clearRect(0, 0, hCanvas.width, hCanvas.height);

    if (results.landmarks?.length > 0) {
      const lm = results.landmarks[0];
      drawHand(lm);

      // 人差し指先端 = landmark 8
      const tip = lm[8];
      // ミラー補正（canvas は -scaleX でミラー済みなので座標は 1-x）
      const mirroredX = 1 - tip.x;
      const dir = detectDirection(mirroredX, tip.y);
      if (dir) onFingerDetected(dir);
      else if (!cooldownActive) clearZones();
    } else {
      if (!cooldownActive) clearZones();
    }
  }
  requestAnimationFrame(detect);
}

// 手のスケルトン描画
const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawHand(lm) {
  const W = hCanvas.width, H = hCanvas.height;

  // 接続線
  hctx.strokeStyle = 'rgba(100,200,255,0.7)';
  hctx.lineWidth = 2;
  for (const [a, b] of CONNECTIONS) {
    hctx.beginPath();
    hctx.moveTo(lm[a].x * W, lm[a].y * H);
    hctx.lineTo(lm[b].x * W, lm[b].y * H);
    hctx.stroke();
  }

  // 関節点
  for (const p of lm) {
    hctx.beginPath();
    hctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
    hctx.fillStyle = '#fff';
    hctx.fill();
  }

  // 人差し指先端を強調
  const tip = lm[8];
  hctx.beginPath();
  hctx.arc(tip.x * W, tip.y * H, 9, 0, Math.PI * 2);
  hctx.fillStyle = '#ff6b6b';
  hctx.fill();
}

// ── 起動 ──────────────────────────────────────────
initChart();
initActiveRing();
initMediaPipe();
