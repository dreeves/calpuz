// Sound effects module using Web Audio API
const Sounds = (function() {
  let audioCtx = null;
  let muted = localStorage.getItem('calpuz-muted') === 'true';

  function getContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (required by browsers after user gesture)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function isMuted() { return muted; }
  
  function setMuted(m) {
    muted = m;
    localStorage.setItem('calpuz-muted', String(m));
  }
  
  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  // Subtle melodic ratchet sound for rotation - ascending for clockwise, descending for counter
  function ratchet(clockwise) {
    if (muted) return;
    const ctx = getContext();
    
    // Mid-range notes for melodic but subtle sound (C4-E4-G4 range, around middle C)
    const notesUp = [261.63, 329.63, 392.00];   // C4, E4, G4 - ascending major triad
    const notesDown = [392.00, 329.63, 261.63]; // G4, E4, C4 - descending
    const notes = clockwise ? notesUp : notesDown;
    
    const noteGap = 0.028;      // 28ms between clicks
    const noteDuration = 0.035; // 35ms per click
    
    notes.forEach((freq, i) => {
      const startTime = ctx.currentTime + i * noteGap;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Triangle wave for softer, more melodic sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      // Subtle pitch drop for ratchet feel
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, startTime + noteDuration);
      
      // Percussive but soft envelope
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.07, startTime + 0.003);  // Quick attack
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  // Pleasant airy swoosh sound for flip using filtered noise
  function swoosh() {
    if (muted) return;
    const ctx = getContext();
    
    // Create white noise buffer
    const bufferSize = ctx.sampleRate * 0.25; // 250ms of noise
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    // Bandpass filter for airy quality - sweeps for swoosh effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.5, ctx.currentTime);
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
    
    // Smooth gain envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.25);
  }

  // Satisfying snap/thock sound for snap-to-grid
  function snap() {
    if (muted) return;
    const ctx = getContext();
    
    // Low thump oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    
    // Click transient for attack
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    
    click.type = 'square';
    click.frequency.setValueAtTime(1200, ctx.currentTime);
    
    clickGain.gain.setValueAtTime(0.1, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    
    click.start(ctx.currentTime);
    click.stop(ctx.currentTime + 0.02);
  }

  // Happy fanfare for solving today's date
  function fanfare() {
    if (muted) return;
    const ctx = getContext();
    
    // Play ascending arpeggio: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDelay = 0.08;
    const noteDuration = 0.25;
    
    notes.forEach((freq, i) => {
      const startTime = ctx.currentTime + i * noteDelay;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.setValueAtTime(0.15, startTime + noteDuration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });
  }

  // Sad trombone for wrong date
  function sadTrombone() {
    if (muted) return;
    const ctx = getContext();
    
    // Descending "wah wah wah wahhh"
    const notes = [293.66, 277.18, 261.63, 246.94]; // D4, C#4, C4, B3
    const durations = [0.2, 0.2, 0.2, 0.5];
    
    let time = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      // Slight pitch drop for "wah" effect
      osc.frequency.exponentialRampToValueAtTime(freq * 0.95, time + durations[i]);
      
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.setValueAtTime(0.08, time + durations[i] * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + durations[i]);
      
      time += durations[i];
    });
  }

  return {
    ratchet,
    swoosh,
    snap,
    fanfare,
    sadTrombone,
    isMuted,
    toggleMute
  };
})();
