const DIRECTIONS = ['上', '下', '左', '右'];
const ACUITY_ROWS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2];
const RINGS_PER_ROW = 4;
const ROW_H = 72, TOP_PAD = 20, BOTTOM_PAD = 12;
const AREA_X0 = 60, AREA_X1 = 380;
const CANVAS_W = 560;

export let currentDir = '';
let active = { row: 0, idx: 0 };
let chartDirs = [];

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

function drawChart() {
  const W = chartCanvas.width, H = chartCanvas.height;
  cctx.clearRect(0, 0, W, H);

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

    cctx.fillStyle = '#222';
    cctx.font = 'bold 16px "Segoe UI", sans-serif';
    cctx.textAlign = 'left';
    cctx.textBaseline = 'middle';
    cctx.fillText(acuity.toFixed(1), 14, cy);

    cctx.strokeStyle = 'rgba(0,0,0,0.12)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(8, cy + ROW_H / 2);
    cctx.lineTo(W - 8, cy + ROW_H / 2);
    cctx.stroke();

    for (let i = 0; i < RINGS_PER_ROW; i++) {
      const cx = ringCenterX(i);
      drawRing(cctx, cx, cy, R, stroke, chartDirs[rowIdx][i]);
    }
  });

  // アクティブ環のハイライト・矢印・「これは？」を最前面に描画
  const acy = rowCenterY(active.row);
  const aD  = ringDiameter(ACUITY_ROWS[active.row]);
  const aR  = aD / 2;
  const acx = ringCenterX(active.idx);

  cctx.save();
  cctx.setLineDash([4, 4]);
  cctx.strokeStyle = '#ffd166';
  cctx.lineWidth = 2;
  cctx.beginPath();
  cctx.arc(acx, acy, aR + 10, 0, Math.PI * 2);
  cctx.stroke();
  cctx.restore();

  drawSparkle(cctx, acx + aR + 4, acy - aR - 6);
  drawSparkle(cctx, acx - aR - 8, acy + aR + 8, 0.7);

  const ax0 = Math.min(W - 14, acx + aR + 70);
  const ax1 = acx + aR + 14;
  cctx.strokeStyle = '#c0336e';
  cctx.fillStyle = '#c0336e';
  cctx.lineWidth = 3;
  cctx.beginPath();
  cctx.moveTo(ax0, acy); cctx.lineTo(ax1, acy);
  cctx.stroke();
  cctx.beginPath();
  cctx.moveTo(ax1, acy);
  cctx.lineTo(ax1 + 12, acy - 7);
  cctx.lineTo(ax1 + 12, acy + 7);
  cctx.closePath();
  cctx.fill();

  cctx.fillStyle = '#c0336e';
  cctx.font = '900 18px "Segoe UI", sans-serif';
  cctx.textAlign = 'left';
  cctx.fillText('これは？', Math.min(W - 90, ax0 + 4), acy - 14);
}

export function initChart() {
  chartDirs = ACUITY_ROWS.map(() =>
    Array.from({ length: RINGS_PER_ROW }, () => randomDir())
  );
}

export function initActiveRing() {
  moveToNewRing();
}

// 同じ位置のまま向きだけ変える（正解直後の即時フィードバック用）
export function rotateActiveDir(excludeDir) {
  const dir = randomDir(excludeDir);
  chartDirs[active.row][active.idx] = dir;
  currentDir = dir;
  drawChart();
}

// ランダムな新しい位置へ移動（1.5秒後の次の問題遷移用）
export function moveToNewRing(excludeDir) {
  active = {
    row: Math.floor(Math.random() * ACUITY_ROWS.length),
    idx: Math.floor(Math.random() * RINGS_PER_ROW)
  };
  rotateActiveDir(excludeDir);
}
