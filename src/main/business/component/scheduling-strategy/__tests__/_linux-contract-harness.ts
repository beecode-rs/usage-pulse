import { SchedulingStrategyLinux } from '#src/main/business/component/scheduling-strategy/linux'

export class SchedulingStrategyLinuxContractHarness extends SchedulingStrategyLinux {
  protected override _assertLinuxOsPlatform(): void {
    return
  }

  resolveConstructorContract(): { homeDir: string; isSupported: boolean; unitDir: string } {
    return { homeDir: this._homeDir, isSupported: this.isSupported, unitDir: this._unitDir }
  }
}
