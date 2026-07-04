/**
 * Aşama 15: "Saldırı Modu" açılış/kapanış ses efektleri — dış ses dosyası
 * gerektirmeden Web Audio API ile anlık olarak sentezlenir (kısa bir
 * yükselen/alçalan osilatör sweep'i + beyaz gürültü patlaması).
 */

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return null
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContextCtor()
  if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume()
  return sharedAudioCtx
}

function playNoiseBurst(ctx: AudioContext, durationSec: number, peakGain: number): void {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * durationSec))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peakGain, ctx.currentTime)
  source.connect(gain).connect(ctx.destination)
  source.start()
}

/** Saldırı modu AÇILDIĞINDA çalınan yükselen "power-up" sweep'i + gürültü. */
export function playHackerActivateSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(70, now)
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.32)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.42)
    playNoiseBurst(ctx, 0.28, 0.05)
  } catch {
    // Ses API'si engellenmiş veya kullanılamıyor olabilir — sessizce yut.
  }
}

/**
 * Gerçek bir pane 'hata' durumuna geçtiğinde çalınan alarm/siren sesi —
 * iki frekans arasında hızla salınan kısa "bip" dizisi (polis sireni hissi).
 */
export function playHackerBreachAlertSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const toneDuration = 0.15
    const frequencies = [920, 620, 920, 620, 980, 660]
    frequencies.forEach((freq, index) => {
      const start = now + index * toneDuration
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, start)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.11, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + toneDuration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + toneDuration + 0.02)
    })
  } catch {
    // Ses API'si engellenmiş veya kullanılamıyor olabilir — sessizce yut.
  }
}

/** Saldırı modu KAPANDIĞINDA çalınan alçalan "power-down" sweep'i. */
export function playHackerDeactivateSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(640, now)
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.3)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.13, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.34)
  } catch {
    // Ses API'si engellenmiş veya kullanılamıyor olabilir — sessizce yut.
  }
}
