import { currentDir, initChart, initActiveRing, rotateActiveDir } from './chart.js';
import { clearZones, activateZone } from './zones.js';
import { initMediaPipe } from './hand.js';

let locked = false;
let cooldownActive = false;

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

function onFingerDetected(fingerDir) {
  if (cooldownActive || locked) return;

  if (fingerDir !== currentDir) {
    activateZone(fingerDir);
    return;
  }

  locked = true;
  cooldownActive = true;
  activateZone(fingerDir);

  rotateActiveDir(currentDir);
  document.getElementById('answer-giant').textContent = `${currentDir}です。`;

  speakAndAdvance(currentDir);
}

initChart();
initActiveRing();
initMediaPipe(onFingerDetected, () => cooldownActive);
