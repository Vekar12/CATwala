const PREFIX = 'catwala_';

export function saveSession(testId, sessionData) {
  localStorage.setItem(`${PREFIX}session_${testId}`, JSON.stringify(sessionData));
}

export function loadSession(testId) {
  const raw = localStorage.getItem(`${PREFIX}session_${testId}`);
  return raw ? JSON.parse(raw) : null;
}

export function saveResult(testId, resultData) {
  localStorage.setItem(`${PREFIX}result_${testId}`, JSON.stringify(resultData));
}

export function loadResult(testId) {
  const raw = localStorage.getItem(`${PREFIX}result_${testId}`);
  return raw ? JSON.parse(raw) : null;
}

export function getUnlocks() {
  const raw = localStorage.getItem(`${PREFIX}unlocks`);
  return raw ? JSON.parse(raw) : [];
}

export function markTestComplete(testId) {
  const unlocks = getUnlocks();
  if (!unlocks.includes(Number(testId))) {
    unlocks.push(Number(testId));
    localStorage.setItem(`${PREFIX}unlocks`, JSON.stringify(unlocks));
  }
}
