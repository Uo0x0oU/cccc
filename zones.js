const ZONE_THRESHOLD = 0.18;

export function detectDirection(nx, ny) {
  if (ny < ZONE_THRESHOLD)     return '上';
  if (ny > 1 - ZONE_THRESHOLD) return '下';
  if (nx < ZONE_THRESHOLD)     return '左';
  if (nx > 1 - ZONE_THRESHOLD) return '右';
  return null;
}

export function clearZones() {
  document.querySelectorAll('.dir-zone').forEach(z => z.classList.remove('active'));
}

export function activateZone(dir) {
  clearZones();
  if (!dir) return;
  const map = { '上': 'zone-up', '下': 'zone-down', '左': 'zone-left', '右': 'zone-right' };
  document.getElementById(map[dir])?.classList.add('active');
}
