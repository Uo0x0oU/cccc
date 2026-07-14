import { currentDir, initChart, initActiveRing, rotateActiveDir, moveToNewRing } from './chart.js';
import { clearZones, activateZone } from './zones.js';
import { initMediaPipe } from './hand.js';

let locked = false;
let cooldownActive = false;

function speak(text) {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text + 'です');
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  utter.pitch = 1.1;
  window.speechSynthesis.speak(utter);
}

function onFingerDetected(fingerDir) {
  if (cooldownActive || locked) return;

  if (fingerDir !== currentDir) {
    activateZone(fingerDir);
    return;
  }

  locked = true;
  cooldownActive = true;
  activateZone(fingerDir);

  // 同じ環の向きだけ変える（「これは？」と黄色枠線はそのまま残る）
  rotateActiveDir(currentDir);
  document.getElementById('answer-giant').textContent = `${currentDir}です。`;
  speak(currentDir);

  // 1.5秒後に新しいランダムな環へ移動してアンロック
  setTimeout(() => {
    locked = false;
    cooldownActive = false;
    clearZones();
    document.getElementById('answer-giant').textContent = '';
    moveToNewRing(currentDir);
  }, 1500);
}

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('intro-overlay').style.display = 'none';
  initChart();
  initActiveRing();
  initMediaPipe(onFingerDetected, () => cooldownActive);
});
