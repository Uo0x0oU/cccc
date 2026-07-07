import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";
import { clearZones, detectDirection } from './zones.js';

const video   = document.getElementById('video');
const hCanvas = document.getElementById('hand-canvas');
const hctx    = hCanvas.getContext('2d');

let handLandmarker = null;
let lastVideoTime  = -1;

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

  hctx.strokeStyle = 'rgba(100,200,255,0.7)';
  hctx.lineWidth = 2;
  for (const [a, b] of CONNECTIONS) {
    hctx.beginPath();
    hctx.moveTo(lm[a].x * W, lm[a].y * H);
    hctx.lineTo(lm[b].x * W, lm[b].y * H);
    hctx.stroke();
  }

  for (const p of lm) {
    hctx.beginPath();
    hctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
    hctx.fillStyle = '#fff';
    hctx.fill();
  }

  const tip = lm[8];
  hctx.beginPath();
  hctx.arc(tip.x * W, tip.y * H, 9, 0, Math.PI * 2);
  hctx.fillStyle = '#ff6b6b';
  hctx.fill();
}

function startCamera(onFingerDetected, isCooldown) {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      video.addEventListener('loadeddata', () => {
        hCanvas.width  = video.videoWidth;
        hCanvas.height = video.videoHeight;
        document.getElementById('status').textContent = '検出中…';
        requestAnimationFrame(detect);
      });
    })
    .catch(e => {
      document.getElementById('status').textContent = 'カメラエラー: ' + e.message;
    });

  function detect(now) {
    if (video.readyState < 2) { requestAnimationFrame(detect); return; }
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const results = handLandmarker.detectForVideo(video, now);

      hctx.clearRect(0, 0, hCanvas.width, hCanvas.height);

      if (results.landmarks?.length > 0) {
        const lm = results.landmarks[0];
        drawHand(lm);

        const tip = lm[8];
        const mirroredX = 1 - tip.x;
        const dir = detectDirection(mirroredX, tip.y);
        if (dir) onFingerDetected(dir);
        else if (!isCooldown()) clearZones();
      } else {
        if (!isCooldown()) clearZones();
      }
    }
    requestAnimationFrame(detect);
  }
}

export async function initMediaPipe(onFingerDetected, isCooldown) {
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
  startCamera(onFingerDetected, isCooldown);
}
