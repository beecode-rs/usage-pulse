import { type ISessionInfo, type SessionStatus } from '#src/shared/session-model'
import { MAX_SOUND_VOLUME_PERCENT, MIN_SOUND_VOLUME_PERCENT, SessionSoundId } from '#src/shared/settings-model'

const TONE_ATTACK_SECONDS = 0.01
const TONE_MAX_GAIN = 0.4
const TONE_SILENCE_GAIN = 0.0001

interface ISessionSoundTone {
  durationSeconds: number
  frequencyHz: number
  gainMultiplier: number
  offsetSeconds: number
  waveType: OscillatorType
}

const SESSION_SOUND_TONES: Record<SessionSoundId, ISessionSoundTone[]> = {
  [SessionSoundId.BEEP]: [
    { durationSeconds: 0.2, frequencyHz: 830, gainMultiplier: 1, offsetSeconds: 0, waveType: 'sine' },
  ],
  [SessionSoundId.CHIME]: [
    { durationSeconds: 0.18, frequencyHz: 523.25, gainMultiplier: 1, offsetSeconds: 0, waveType: 'sine' },
    { durationSeconds: 0.3, frequencyHz: 783.99, gainMultiplier: 1, offsetSeconds: 0.16, waveType: 'sine' },
  ],
  [SessionSoundId.DING]: [
    { durationSeconds: 0.9, frequencyHz: 1318.51, gainMultiplier: 1, offsetSeconds: 0, waveType: 'sine' },
    { durationSeconds: 0.5, frequencyHz: 2637.02, gainMultiplier: 0.4, offsetSeconds: 0, waveType: 'sine' },
    { durationSeconds: 0.25, frequencyHz: 3559.98, gainMultiplier: 0.18, offsetSeconds: 0, waveType: 'sine' },
  ],
  [SessionSoundId.FANFARE]: [
    { durationSeconds: 0.16, frequencyHz: 392, gainMultiplier: 0.6, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 587.33, gainMultiplier: 0.6, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 783.99, gainMultiplier: 0.7, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.45, frequencyHz: 523.25, gainMultiplier: 0.7, offsetSeconds: 0.16, waveType: 'triangle' },
    { durationSeconds: 0.45, frequencyHz: 659.25, gainMultiplier: 0.7, offsetSeconds: 0.16, waveType: 'triangle' },
    { durationSeconds: 0.45, frequencyHz: 1046.5, gainMultiplier: 0.9, offsetSeconds: 0.16, waveType: 'triangle' },
  ],
  [SessionSoundId.NONE]: [],
  [SessionSoundId.PING]: [
    { durationSeconds: 0.12, frequencyHz: 1174.66, gainMultiplier: 1, offsetSeconds: 0, waveType: 'triangle' },
  ],
  [SessionSoundId.SUCCESS]: [
    { durationSeconds: 0.16, frequencyHz: 523.25, gainMultiplier: 0.7, offsetSeconds: 0, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 659.25, gainMultiplier: 0.8, offsetSeconds: 0.1, waveType: 'triangle' },
    { durationSeconds: 0.16, frequencyHz: 783.99, gainMultiplier: 0.9, offsetSeconds: 0.2, waveType: 'triangle' },
    { durationSeconds: 0.4, frequencyHz: 1046.5, gainMultiplier: 1, offsetSeconds: 0.3, waveType: 'triangle' },
  ],
}

const audioContextCache: { context?: AudioContext } = {}

export class SessionSoundUtil {
  playSessionSound(params: { soundId: SessionSoundId; volumePercent: number }): void {
    if (params.soundId === SessionSoundId.NONE) {
      return
    }

    const gain = this.resolveSoundGain({ volumePercent: params.volumePercent })

    if (gain <= 0) {
      return
    }

    const audioContext = this._resolveAudioContext()

    SESSION_SOUND_TONES[params.soundId].map((tone) => {
      this._playTone({ audioContext, gain, tone })
    })
  }

  resolveNewlyStatusSessionIds(params: {
    currentSessions: ISessionInfo[]
    previousSessions?: ISessionInfo[]
    status: SessionStatus
  }): string[] {
    if (params.previousSessions === undefined) {
      return []
    }

    const previousStatusSessionIds = new Set(
      params.previousSessions
        .filter((session) => {
          return session.status === params.status
        })
        .map((session) => {
          return session.sessionId
        }),
    )

    return params.currentSessions
      .filter((session) => {
        return session.status === params.status && !previousStatusSessionIds.has(session.sessionId)
      })
      .map((session) => {
        return session.sessionId
      })
  }

  resolveSoundGain(params: { volumePercent: number }): number {
    const clampedVolumePercent = Math.min(
      Math.max(params.volumePercent, MIN_SOUND_VOLUME_PERCENT),
      MAX_SOUND_VOLUME_PERCENT,
    )

    return (clampedVolumePercent / MAX_SOUND_VOLUME_PERCENT) * TONE_MAX_GAIN
  }

  resolveStatusTransitionSessionIds(params: {
    currentSessions: ISessionInfo[]
    fromStatus: SessionStatus
    previousSessions?: ISessionInfo[]
    toStatus: SessionStatus
  }): string[] {
    if (params.previousSessions === undefined) {
      return []
    }

    const fromStatusSessionIds = new Set(
      params.previousSessions
        .filter((session) => {
          return session.status === params.fromStatus
        })
        .map((session) => {
          return session.sessionId
        }),
    )

    return params.currentSessions
      .filter((session) => {
        return session.status === params.toStatus && fromStatusSessionIds.has(session.sessionId)
      })
      .map((session) => {
        return session.sessionId
      })
  }

  protected _playTone(params: { audioContext: AudioContext; gain: number; tone: ISessionSoundTone }): void {
    const gainNode = params.audioContext.createGain()
    const oscillator = params.audioContext.createOscillator()
    const startAtSeconds = params.audioContext.currentTime + params.tone.offsetSeconds
    const stopAtSeconds = startAtSeconds + params.tone.durationSeconds

    const toneGain = params.gain * params.tone.gainMultiplier

    gainNode.gain.setValueAtTime(0, startAtSeconds)
    gainNode.gain.linearRampToValueAtTime(toneGain, startAtSeconds + TONE_ATTACK_SECONDS)
    gainNode.gain.exponentialRampToValueAtTime(TONE_SILENCE_GAIN, stopAtSeconds)
    oscillator.frequency.value = params.tone.frequencyHz
    oscillator.type = params.tone.waveType
    oscillator.connect(gainNode)
    gainNode.connect(params.audioContext.destination)
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
