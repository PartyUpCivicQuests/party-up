// The Cheery Bard: an original "critter babble" voice. Each letter becomes a
// short synthesized blip, made on the spot with the Web Audio API. No recorded
// or game sounds are used. Plays when a quest has a transcript but no recording.

export const CHEERY_BARD = { base: 330, spread: 150, step: 70, wave: 'triangle', cut: 2000, volume: 0.14 };

let ctx = null;

function blip(t, freq, dur, p, out) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = p.wave;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.linearRampToValueAtTime(freq * (0.92 + Math.random() * 0.16), t + dur);
  f.type = 'lowpass'; f.frequency.value = p.cut;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(p.volume, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

// Babbles `text`, calling onChar(ch) as each character "is spoken" so the
// words can type out on screen, then onEnd(). Returns { stop }.
export function babble(text, { onChar, onEnd, voice = CHEERY_BARD } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { if (onChar) for (const ch of text) onChar(ch); if (onEnd) onEnd(); return { stop() {} }; }
  ctx = ctx || new AC();
  if (ctx.state === 'suspended') ctx.resume();
  const p = voice, timers = [], master = ctx.createGain();
  master.connect(ctx.destination);
  let t = ctx.currentTime + 0.05, ms = 50;
  for (const ch of text) {
    const c = ch.toLowerCase();
    let gap = p.step;
    if (/\p{L}/u.test(c)) {
      const vowel = 'aeiouyáéíóúü'.includes(c);
      const freq = p.base + (vowel ? p.spread * 0.6 : 0) + ((c.codePointAt(0) * 37) % p.spread) * 0.5 + Math.random() * p.spread * 0.25;
      blip(t, freq, (p.step / 1000) * 0.85, p, master);
    } else if (/[.!?¡¿]/.test(c)) gap = p.step * 4;
    else if (/[,;:]/.test(c)) gap = p.step * 2.5;
    else if (/\s/.test(c)) gap = p.step * 0.6;
    timers.push(setTimeout(() => { if (onChar) onChar(ch); }, ms));
    t += gap / 1000; ms += gap;
  }
  timers.push(setTimeout(() => { try { master.disconnect(); } catch { /* already stopped */ } if (onEnd) onEnd(); }, ms + 150));
  return {
    stop() {
      timers.forEach(clearTimeout);
      try { master.gain.setValueAtTime(0, ctx.currentTime); master.disconnect(); } catch { /* already stopped */ }
    }
  };
}
