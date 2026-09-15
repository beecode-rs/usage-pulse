export class CommonMemoryDal<T> {
  protected _value?: T

  readValue(): T | undefined {
    return this._value
  }

  writeValue(params: { value: T }): void {
    const { value } = params
    this._value = value
  }
}
