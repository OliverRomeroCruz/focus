/**
 * FOCUS GOAT — Offscreen Audio Player
 * Genera un sonido de campana / chime armónico limpio usando Web Audio API.
 * Suena nítido, elegante y sin distorsión aún con el navegador minimizado.
 */

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Acorde armónico ascendente de victoria / campana de estudio
    // D5 (587.33Hz) -> A5 (880.00Hz) -> D6 (1174.66Hz)
    const notes = [
      { freq: 587.33, start: 0, dur: 0.9 },
      { freq: 880.00, start: 0.16, dur: 1.1 },
      { freq: 1174.66, start: 0.36, dur: 1.6 }
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);

      // Envolvente de volumen suave: ataque rápido y decaimiento exponencial natural
      gain.gain.setValueAtTime(0.001, ctx.currentTime + note.start);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + note.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + note.start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + note.start);
      osc.stop(ctx.currentTime + note.start + note.dur);
    });
  } catch (e) {
    console.warn("Error playing chime:", e);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "playFinishChime") {
    playChime();
    sendResponse({ played: true });
  }
});
