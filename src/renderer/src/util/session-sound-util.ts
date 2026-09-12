import { type SessionStatusMapper } from '#src/shared/business/enum/session-status-mapper-enum'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import { type SessionInfo } from '#src/shared/business/model/session-model'
import { constant } from '#src/shared/util/constant'

const TONE_ATTACK_SECONDS = 0.01
const TONE_MAX_GAIN = 0.4
const TONE_SILENCE_GAIN = 0.0001

type SessionSoundTone = {
  durationSeconds: number
  frequencyHz: number
  gainMultiplier: number
  offsetSeconds: number
  waveType: OscillatorType
}

const SESSION_SOUND_TONES: Record<SoundNameMapper, SessionSoundTone[]> = {
  [SoundNameMapper.BEEP]: [
    { durationSeconds: 0.2, frequencyHz: 830, gainMultiplier: 1, offsetSeconds: 0, waveType: 'sine' },
  ],
  [SoundNameMapper.CHIME]: [
    { durationSeconds: 0.18, frequencyHz: 523.25, gainMultiplier: 1, offsetSeconds: 0, waveType: 'sine' },
    { durationSeconds: 0.3, frequencyHz: 783.99, gainMultiplier: 1, offsetSeconds: 0.16, waveType: 'sine' },
  ],
  [SoundNameMapper.DING]: [
    { durationSeconds: 0.9, frequencyHz: 1318.51, gainMultiplier: 1, offsetSeconds: 0, waveType: 'sine' },
    { durationSeconds: 0.5, frequencyHz: 2637.02, gainMultiplier: 0.4, offsetSeconds: 0, waveType: 'sine' },
    { durationSeconds: 0.25, frequencyHz: 3559.98, gainMultiplier: 0.18, offsetSeconds: 0, waveType: 'sine' },
  ],
  [SoundNameMapper.FANFARE]: [
    { durationSeconds: 0.16, frequencyHz: 392, gainMultiplier: 0.6, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 587.33, gainMultiplier: 0.6, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 783.99, gainMultiplier: 0.7, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.45, frequencyHz: 523.25, gainMultiplier: 0.7, offsetSeconds: 0.16, waveType: 'triangle' },
    { durationSeconds: 0.45, frequencyHz: 659.25, gainMultiplier: 0.7, offsetSeconds: 0.16, waveType: 'triangle' },
    { durationSeconds: 0.45, frequencyHz: 1046.5, gainMultiplier: 0.9, offsetSeconds: 0.16, waveType: 'triangle' },
  ],
  [SoundNameMapper.NONE]: [],
  [SoundNameMapper.PING]: [
    { durationSeconds: 0.12, frequencyHz: 1174.66, gainMultiplier: 1, offsetSeconds: 0, waveType: 'triangle' },
  ],
  [SoundNameMapper.SUCCESS]: [
    { durationSeconds: 0.16, frequencyHz: 523.25, gainMultiplier: 0.7, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 659.25, gainMultiplier: 0.8, offsetSeconds: 0.1, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 783.99, gainMultiplier: 0.9, offsetSeconds: 0.2, waveType: 'triangle' },
    { durationSeconds: 0.4, frequencyHz: 1046.5, gainMultiplier: 1, offsetSeconds: 0.3, waveType: 'triangle' },
  ],
}

const audioContextCache: { context?: AudioContext } = {}

export class SessionSoundUtil {
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

    SESSION_SOUND_TONES[soundId].map((tone) => {
      this._playTone({ audioContext, gain, tone })
    })
  }

  resolveNewlyStatusSessionIds(params: {
    currentSessions: SessionInfo[]
    previousSessions?: SessionInfo[]
    status: SessionStatusMapper
  }): string[] {
    const { currentSessions, previousSessions, status } = params
    if (previousSessions === undefined) {
      return []
    }

    const previousStatusSessionIds = new Set(
      previousSessions
        .filter((session) => {
          return session.status === status
        })
        .map((session) => {
          return session.sessionId
        }),
    )

    return currentSessions
      .filter((session) => {
        return session.status === status && !previousStatusSessionIds.has(session.sessionId)
      })
      .map((session) => {
        return session.sessionId
      })
  }

  resolveSoundGain(params: { volumePercent: number }): number {
    const { volumePercent } = params
    const clampedVolumePercent = Math.min(
      Math.max(volumePercent, constant.soundVolume.minPercent),
      constant.soundVolume.maxPercent,
    )

    return (clampedVolumePercent / constant.soundVolume.maxPercent) * TONE_MAX_GAIN
  }

  resolveStatusTransitionSessionIds(params: {
    currentSessions: SessionInfo[]
    fromStatus: SessionStatusMapper
    previousSessions?: SessionInfo[]
    toStatus: SessionStatusMapper
  }): string[] {
    const { currentSessions, fromStatus, previousSessions, toStatus } = params
    if (previousSessions === undefined) {
      return []
    }

    const fromStatusSessionIds = new Set(
      previousSessions
        .filter((session) => {
          return session.status === fromStatus
        })
        .map((session) => {
          return session.sessionId
        }),
    )

    return currentSessions
      .filter((session) => {
        return session.status === toStatus && fromStatusSessionIds.has(session.sessionId)
      })
      .map((session) => {
        return session.sessionId
      })
  }

  protected _playTone(params: { audioContext: AudioContext; gain: number; tone: SessionSoundTone }): void {
    const { audioContext, gain, tone } = params
    const gainNode = audioContext.createGain()
    const oscillator = audioContext.createOscillator()
    const startAtSeconds = audioContext.currentTime + tone.offsetSeconds
    const stopAtSeconds = startAtSeconds + tone.durationSeconds

    const toneGain = gain * tone.gainMultiplier

    gainNode.gain.setValueAtTime(0, startAtSeconds)
    gainNode.gain.linearRampToValueAtTime(toneGain, startAtSeconds + TONE_ATTACK_SECONDS)
    gainNode.gain.exponentialRampToValueAtTime(TONE_SILENCE_GAIN, stopAtSeconds)
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
