import { constant } from '#src/renderer/src/util/constant'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import { constant as sharedConstant } from '#src/shared/util/constant'

type SessionSoundTone = {
  durationSeconds: number
  frequencyHz: number
  gainMultiplier: number
  offsetSeconds: number
  waveType: OscillatorType
}

const audioContextCache: { context?: AudioContext } = {}

export class SessionSoundService {
  playSessionSound(params: { soundId: SoundNameMapper; volumePercent: number }): void {
    const { soundId, volumePercent } = params
    if (soundId === SoundNameMapper.NONE) {
      return
    }

    const gain = this.resolveSoundGain({ volumePercent })

    if (gain <= 0) {
      return
    }

    const audioContext = this._resolveAudioContext()

    constant.sound.tonesBySoundId[soundId].map((tone) => {
      this._playTone({ audioContext, gain, tone })
    })
  }

  resolveSoundGain(params: { volumePercent: number }): number {
    const { volumePercent } = params
    const clampedVolumePercent = Math.min(
      Math.max(volumePercent, sharedConstant.soundVolume.minPercent),
      sharedConstant.soundVolume.maxPercent,
    )

    return (clampedVolumePercent / sharedConstant.soundVolume.maxPercent) * constant.sound.toneMaxGain
  }

  protected _playTone(params: { audioContext: AudioContext; gain: number; tone: SessionSoundTone }): void {
    const { audioContext, gain, tone } = params
    const gainNode = audioContext.createGain()
    const oscillator = audioContext.createOscillator()
    const startAtSeconds = audioContext.currentTime + tone.offsetSeconds
    const stopAtSeconds = startAtSeconds + tone.durationSeconds

    const toneGain = gain * tone.gainMultiplier

    gainNode.gain.setValueAtTime(0, startAtSeconds)
    gainNode.gain.linearRampToValueAtTime(toneGain, startAtSeconds + constant.sound.toneAttackSeconds)
    gainNode.gain.exponentialRampToValueAtTime(constant.sound.toneSilenceGain, stopAtSeconds)
    oscillator.frequency.value = tone.frequencyHz
    oscillator.type = tone.waveType
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start(startAtSeconds)
    oscillator.stop(stopAtSeconds)
  }

  protected _resolveAudioContext(): AudioContext {
    audioContextCache.context = audioContextCache.context ?? new AudioContext()

    const audioContext = audioContextCache.context

    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }

    return audioContext
  }
}
