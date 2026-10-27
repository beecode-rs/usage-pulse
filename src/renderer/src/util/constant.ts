import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { SoundNameMapper } from '#src/shared/business/enum/sound-name-mapper-enum'
import { appTitleUtil } from '#src/shared/util/app-title-util'

type SessionSoundTone = {
  durationSeconds: number
  frequencyHz: number
  gainMultiplier: number
  offsetSeconds: number
  waveType: OscillatorType
}

type UpdateDownloadState = 'downloaded' | 'downloading' | 'idle' | 'installing' | 'restart-required'

type UpdateDownload = {
  errorMessage: string
  filePath: string
  percent?: number
  state: UpdateDownloadState
}

const plannerDialSizePx = 76

const appFooterIdleDownload: UpdateDownload = {
  errorMessage: '',
  filePath: '',
  state: 'idle',
}

const scheduleTriggerDayLabels: Record<ScheduleTriggerDayMapper, string> = {
  [ScheduleTriggerDayMapper.FRIDAY]: 'Fri',
  [ScheduleTriggerDayMapper.MONDAY]: 'Mon',
  [ScheduleTriggerDayMapper.SATURDAY]: 'Sat',
  [ScheduleTriggerDayMapper.SUNDAY]: 'Sun',
  [ScheduleTriggerDayMapper.THURSDAY]: 'Thu',
  [ScheduleTriggerDayMapper.TUESDAY]: 'Tue',
  [ScheduleTriggerDayMapper.WEDNESDAY]: 'Wed',
}

const sessionSoundTones: Record<SoundNameMapper, SessionSoundTone[]> = {
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

export const constant = {
  aboutPage: {
    developmentUnlockClickCount: 7,
  },
  app: {
    title: appTitleUtil.resolve({ isDev: import.meta.env.DEV }),
  },
  appFooter: {
    idleDownload: appFooterIdleDownload,
  },
  dayTimeSelect: {
    hourOptions: Array.from({ length: 24 }, (_unused, hour) => {
      return String(hour).padStart(2, '0')
    }),
    minuteOptions: Array.from({ length: 60 }, (_unused, minute) => {
      return String(minute).padStart(2, '0')
    }),
  },
  development: {
    defaultElapsedMinutes: 60,
    defaultUsedPercent: 45,
    elapsedMinutes: {
      max: 300,
    },
    page: {
      dayOffsets: [0, 1, 2, 3, 4, 5, 6],
      defaultFetchedElapsedMinutes: 1,
      fetchedElapsedMinutes: {
        max: 3 * 24 * 60,
      },
      minuteOfDay: {
        max: 23 * 60 + 59,
      },
      minutesPerHour: 60,
      preview: {
        mcpTotalCalls: 1000,
        nextRefreshOffsetMs: 150_000,
        refreshIntervalMs: 300_000,
        refreshSpinMs: 1000,
      },
      severityBands: [
        { colorVar: 'var(--meter-accent)', label: 'Normal', range: '0–69%' },
        { colorVar: 'var(--meter-warning)', label: 'Filling up', range: '70–84%' },
        { colorVar: 'var(--meter-serious)', label: 'High usage', range: '85–94%' },
        { colorVar: 'var(--meter-critical)', label: 'Limit reached', range: '95–100%' },
      ],
      usedPercent: {
        max: 100,
      },
      weekdayOptions: [
        { label: 'Monday', value: '1' },
        { label: 'Tuesday', value: '2' },
        { label: 'Wednesday', value: '3' },
        { label: 'Thursday', value: '4' },
        { label: 'Friday', value: '5' },
        { label: 'Saturday', value: '6' },
        { label: 'Sunday', value: '0' },
      ],
    },
  },
  icon: {
    defaultSizePx: 15,
    peakSizePx: 13,
    providerDefaultSizePx: 18,
  },
  localStorage: {
    developmentIsUnlockedKey: 'development.is-unlocked',
    sideMenuIsCollapsedKey: 'side-menu.is-collapsed',
  },
  menuStatusDot: {
    peakTitle: 'z.ai peak hours: premium models bill at 3× credits (weekdays 14:00–18:00 UTC+8)',
    warningTitle: 'Usage warning: tracker data is stale or usage is outpacing the reset window',
  },
  pairingToken: {
    copiedResetMs: 2000,
  },
  planner: {
    firstTrigger: {
      maxMs: 85_500_000,
      stepMs: 900_000,
    },
    firstWindowGapMs: 18_120_000,
    timelineTicks: [
      { dayMs: 0, label: '00:00' },
      { dayMs: 10_800_000, label: '03:00' },
      { dayMs: 21_600_000, label: '06:00' },
      { dayMs: 32_400_000, label: '09:00' },
      { dayMs: 43_200_000, label: '12:00' },
      { dayMs: 54_000_000, label: '15:00' },
      { dayMs: 64_800_000, label: '18:00' },
      { dayMs: 75_600_000, label: '21:00' },
      { dayMs: 86_400_000, label: '24:00' },
    ],
  },
  plannerDial: {
    angleRangeDegrees: 270,
    centerPx: plannerDialSizePx / 2,
    knobRadiusPx: 3.5,
    radiusPx: plannerDialSizePx / 2 - 7,
    sizePx: plannerDialSizePx,
    startAngleDegrees: 135,
  },
  regex: {
    modelDateSuffixRegex: /-\d{8}$/,
    titleHyphenSplitRegex: /^(.+)-(.+)$/,
    whitespaceCollapseRegex: /\s+/g,
  },
  scheduleTrigger: {
    dayLabels: scheduleTriggerDayLabels,
    defaultCommand: 'claude -p "what is your name, only name"',
  },
  sessionCard: {
    lastPromptMaxLength: 200,
  },
  sound: {
    selectOptions: [
      { label: 'None', soundId: SoundNameMapper.NONE },
      { label: 'Beep', soundId: SoundNameMapper.BEEP },
      { label: 'Chime', soundId: SoundNameMapper.CHIME },
      { label: 'Ding', soundId: SoundNameMapper.DING },
      { label: 'Fanfare', soundId: SoundNameMapper.FANFARE },
      { label: 'Ping', soundId: SoundNameMapper.PING },
      { label: 'Success', soundId: SoundNameMapper.SUCCESS },
    ],
    toneAttackSeconds: 0.01,
    toneMaxGain: 0.4,
    tonesBySoundId: sessionSoundTones,
    toneSilenceGain: 0.0001,
  },
  triggerWindowExplainer: {
    domainMs: { endMs: 82_800_000, startMs: 21_600_000 },
    ticks: ['07:00', '12:00', '17:00', '22:00'],
    workRange: { endMs: 64_800_000, startMs: 36_000_000 },
    workRangeLabel: 'Work 10:00–18:00',
  },
  ui: {
    fastNowTickIntervalMs: 1000,
    nowTickIntervalMs: 30_000,
  },
  usagePace: {
    maxStepCount: 5,
    minDriftPercent: 10,
    onPaceBandPercent: 5,
    stepPercent: 20,
  },
  zaiPeak: {
    endMinuteOfDay: 18 * 60,
    startMinuteOfDay: 14 * 60,
    utcOffsetMinutes: 8 * 60,
    weekdayFirst: 1,
    weekdayLast: 5,
  },
}
