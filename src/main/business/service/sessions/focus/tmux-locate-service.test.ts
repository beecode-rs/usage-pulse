import { describe, expect, it } from 'vitest'

import { SessionsFocusTmuxLocateService } from '#src/main/business/service/sessions/focus/tmux-locate-service'

describe('SessionsFocusTmuxLocateService', () => {
  const service = new SessionsFocusTmuxLocateService()

  it('parses tmux list-panes rows', () => {
    const paneRows = service.parsePaneRows({
      stdout: 's01\t501\t/home/user/project\t1788357898\ns02\t502\t/home/user/other\t1788367210\n\n',
    })

    expect(paneRows).toEqual([
      {
        paneCurrentPath: '/home/user/project',
        panePid: 501,
        paneTitle: '',
        sessionActivityAtSec: 1788357898,
        sessionName: 's01',
      },
      {
        paneCurrentPath: '/home/user/other',
        panePid: 502,
        paneTitle: '',
        sessionActivityAtSec: 1788367210,
        sessionName: 's02',
      },
    ])
  })

  it('parses the pane title column of tmux list-panes rows', () => {
    const paneRows = service.parsePaneRows({
      stdout: 'usage-pulse\t33312\t/Users/milos/code/usage-pulse\t100\tOC | Local vs remote session focus\n',
    })

    expect(paneRows).toEqual([
      {
        paneCurrentPath: '/Users/milos/code/usage-pulse',
        panePid: 33312,
        paneTitle: 'OC | Local vs remote session focus',
        sessionActivityAtSec: 100,
        sessionName: 'usage-pulse',
      },
    ])
  })

  it('drops malformed tmux pane rows', () => {
    const paneRows = service.parsePaneRows({
      stdout: '\t501\t/home/user/project\t1788357898\nbad\tzero\t/x\t0\nbad2\t9\t/x\t\n',
    })

    expect(paneRows).toEqual([
      { paneCurrentPath: '/x', panePid: 9, paneTitle: '', sessionActivityAtSec: 0, sessionName: 'bad2' },
    ])
  })

  it('parses the pid and ppid columns of a full process list', () => {
    const processRows = service.parseProcessRows({ stdout: '  501 4242\n502 1\nnot a row\n' })

    expect(processRows).toEqual([
      { pid: 501, ppid: 4242 },
      { pid: 502, ppid: 1 },
    ])
  })

  it('parses the pid and tty columns of a full process list', () => {
    const processTtyRows = service.parseProcessTtyRows({ stdout: '  501 ttys009\n502 ??\n' })

    expect(processTtyRows).toEqual([
      { pid: 501, tty: 'ttys009' },
      { pid: 502, tty: '??' },
    ])
  })

  it('parses the tmux client tty list', () => {
    const clientTtys = service.parseTtyList({ stdout: '/dev/ttys009\n/dev/ttys010\n\n' })

    expect(clientTtys).toEqual(['/dev/ttys009', '/dev/ttys010'])
  })

  it('collects the ancestor pids up to init', () => {
    const parentByPid = new Map([
      [4242, 501],
      [501, 502],
      [502, 1],
    ])

    expect(service.resolveAncestorPids({ parentByPid, pid: 4242 })).toEqual(new Set([4242, 501, 502]))
  })

  it('stops the ancestor walk after the configured hop limit', () => {
    const parentByPid = new Map(
      [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87].map((pid, index, pids) => {
        return [pid, pids[index + 1] ?? 1]
      }),
    )

    expect(service.resolveAncestorPids({ parentByPid, pid: 100 })).toEqual(
      new Set([100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89]),
    )
  })

  it('matches the tmux pane whose pane pid is an ancestor of the session pid', () => {
    const paneRows = [
      {
        paneCurrentPath: '/home/user/project',
        panePid: 501,
        paneTitle: '',
        sessionActivityAtSec: 1,
        sessionName: 's01',
      },
      {
        paneCurrentPath: '/home/user/other',
        panePid: 502,
        paneTitle: '',
        sessionActivityAtSec: 2,
        sessionName: 's02',
      },
    ]

    expect(service.resolveSessionNameByPid({ ancestorPids: new Set([4242, 501]), paneRows })).toBe('s01')
  })

  it('falls back to the most recently active pane whose cwd matches', () => {
    const paneRows = [
      {
        paneCurrentPath: '/home/user/project',
        panePid: 501,
        paneTitle: '',
        sessionActivityAtSec: 10,
        sessionName: 's01',
      },
      {
        paneCurrentPath: '/home/user/project',
        panePid: 502,
        paneTitle: '',
        sessionActivityAtSec: 20,
        sessionName: 's02',
      },
      {
        paneCurrentPath: '/home/user/other',
        panePid: 503,
        paneTitle: '',
        sessionActivityAtSec: 30,
        sessionName: 's03',
      },
    ]

    expect(service.resolveSessionNameByCwd({ cwd: '/home/user/project', paneRows })).toBe('s02')
    expect(service.resolveSessionNameByCwd({ cwd: '', paneRows })).toBe(undefined)
    expect(service.resolveSessionNameByCwd({ cwd: '/home/user/missing', paneRows })).toBe(undefined)
  })

  it('matches the pane whose title contains the session name within the same cwd', () => {
    const paneRows = [
      {
        paneCurrentPath: '/Users/milos/code/usage-pulse',
        panePid: 33312,
        paneTitle: 'OC | Local vs remote session focus',
        sessionActivityAtSec: 10,
        sessionName: 'usage-pulse',
      },
      {
        paneCurrentPath: '/Users/milos/code/usage-pulse',
        panePid: 83309,
        paneTitle: 'OC | Red progress at 100% usage',
        sessionActivityAtSec: 5,
        sessionName: 'usage-pulse01',
      },
    ]

    expect(
      service.resolveSessionNameByTitle({
        cwd: '/Users/milos/code/usage-pulse',
        name: 'Red progress at 100% usage',
        paneRows,
      }),
    ).toBe('usage-pulse01')
    expect(
      service.resolveSessionNameByTitle({
        cwd: '/Users/milos/code/usage-pulse',
        name: 'Local vs remote session focus',
        paneRows,
      }),
    ).toBe('usage-pulse')
    expect(
      service.resolveSessionNameByTitle({ cwd: '/Users/milos/code/usage-pulse', name: 'missing title', paneRows }),
    ).toBe(undefined)
    expect(
      service.resolveSessionNameByTitle({
        cwd: '/Users/milos/code/other-project',
        name: 'Red progress at 100% usage',
        paneRows,
      }),
    ).toBe(undefined)
    expect(service.resolveSessionNameByTitle({ cwd: '/Users/milos/code/usage-pulse', name: '', paneRows })).toBe(
      undefined,
    )
  })

  it('picks the most recently active pane when several share the same title', () => {
    const paneRows = [
      {
        paneCurrentPath: '/home/user/project',
        panePid: 501,
        paneTitle: 'OC | shared title',
        sessionActivityAtSec: 10,
        sessionName: 's01',
      },
      {
        paneCurrentPath: '/home/user/project',
        panePid: 502,
        paneTitle: 'OC | shared title',
        sessionActivityAtSec: 20,
        sessionName: 's02',
      },
    ]

    expect(service.resolveSessionNameByTitle({ cwd: '/home/user/project', name: 'shared title', paneRows })).toBe('s02')
  })
})
