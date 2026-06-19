(function () {
  let audioCtx = null;

  function getContext() {
    if (audioCtx) {
      return audioCtx;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return null;
    }

    audioCtx = new AudioContext();
    return audioCtx;
  }

  function unlock() {
    const ctx = getContext();
    if (!ctx) {
      return Promise.resolve(false);
    }

    if (ctx.state === "suspended") {
      return ctx.resume().then(() => true).catch(() => false);
    }

    return Promise.resolve(true);
  }

  function play(type) {
    const ctx = getContext();
    if (!ctx) {
      return;
    }

    const schedule = () => {
      const now = ctx.currentTime;

      if (type === "reveal") {
        playReveal(ctx, now);
      } else if (type === "score") {
        playScore(ctx, now);
      } else if (type === "buzzer") {
        playBuzzer(ctx, now);
      }
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(schedule).catch(() => {});
      return;
    }

    schedule();
  }

  function playReveal(ctx, now) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.07);
    osc.frequency.setValueAtTime(783.99, now + 0.14);
    osc.frequency.setValueAtTime(1046.5, now + 0.22);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  function playScore(ctx, now) {
    [659.25, 880, 1174.66].forEach((frequency, index) => {
      const start = now + index * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  function playBuzzer(ctx, now) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "square";
    osc1.frequency.setValueAtTime(115, now);
    osc2.frequency.setValueAtTime(118, now);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(750, now);
    gain.gain.setValueAtTime(0.34, now);
    gain.gain.linearRampToValueAtTime(0.34, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.78);
    osc2.stop(now + 0.78);
  }

  function bindUnlock(target) {
    if (!target) {
      return;
    }

    target.addEventListener("pointerdown", unlock, { capture: true });
    target.addEventListener("keydown", unlock, { capture: true });
  }

  window.AINSFeudAudio = {
    bindUnlock,
    play,
    unlock
  };
}());
