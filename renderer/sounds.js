// Agent Radar sounds — synthesised with Web Audio, so there are no audio files to ship.
//   needs    → bright two-note rising chime ("hey, over here")
//   reminder → the same chime, quieter
//   done     → soft three-note major arpeggio ("all finished")
(function () {
  let ctx = null;
  const audio = () => (ctx ||= new AudioContext());

  // One bell-like note: sine + a quiet octave partial, quick attack, exponential decay.
  function note(freq, at, { dur = 0.9, gain = 0.2, type = 'sine' } = {}) {
    const a = audio();
    const t = a.currentTime + at;
    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(a.destination);

    for (const [mult, level, wave] of [[1, 1, type], [2, 0.18, 'sine'], [3.01, 0.05, 'sine']]) {
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq * mult, t);
      g.gain.value = level;
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  const SOUNDS = {
    needs: () => { note(880.0, 0, { gain: 0.22, dur: 0.7 }); note(1318.5, 0.14, { gain: 0.2, dur: 1.1 }); },
    reminder: () => { note(880.0, 0, { gain: 0.12, dur: 0.6 }); note(1318.5, 0.14, { gain: 0.11, dur: 0.9 }); },
    done: () => {
      note(523.25, 0, { gain: 0.14, dur: 0.8, type: 'triangle' });
      note(659.25, 0.11, { gain: 0.13, dur: 0.8, type: 'triangle' });
      note(783.99, 0.22, { gain: 0.14, dur: 1.3, type: 'triangle' });
    },
  };

  window.playRadarSound = (kind) => {
    try {
      if (audio().state === 'suspended') audio().resume();
      (SOUNDS[kind] || SOUNDS.needs)();
      console.debug(`[sound] ${kind}`);
    } catch (e) { console.warn('Agent Radar: sound failed', e); }
  };
})();
