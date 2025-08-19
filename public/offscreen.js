// Offscreen audio player with multiple preset sounds
(function () {
  const sounds = {
    ding: () => tone({ startFreq: 660, endFreq: 990, attack: 0.02, hold: 0.15, release: 0.6, wave: 'sine' }),
    chime: () => chord([523.25, 659.25, 783.99], 0.6), // C major arpeggio
    bell: () => tone({ startFreq: 880, endFreq: 880, attack: 0.005, hold: 0.2, release: 1.2, wave: 'triangle' }),
  };

  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message?.type === 'PLAY_SOUND') {
      try {
        const play = sounds[message.sound] || sounds.ding;
        await play();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }
  });

  function tone({ startFreq, endFreq, attack, hold, release, wave }) {
    return new Promise((resolve) => {
      const ctx = new (self.AudioContext || self.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      if (endFreq !== startFreq) {
        osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + attack + hold);
      }
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + attack + hold + release);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + attack + hold + release + 0.05);
      osc.onended = () => ctx.close().finally(resolve);
    });
  }

  function chord(freqs, duration) {
    return new Promise((resolve) => {
      const ctx = new (self.AudioContext || self.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      gain.connect(ctx.destination);
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, ctx.currentTime);
        o.connect(gain);
        o.start();
        o.stop(ctx.currentTime + duration + 0.05);
        return o;
      });
      oscs[oscs.length - 1].onended = () => ctx.close().finally(resolve);
    });
  }
})();


