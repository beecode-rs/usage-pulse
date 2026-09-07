import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export class CommonFileDal {
  protected async _appendTextFile(params: { content: string; filePath: string }): Promise<void> {
    const { content, filePath } = params
    await mkdir(dirname(filePath), { recursive: true })
    await appendFile(filePath, content, 'utf8')
  }

  protected _isNotFoundError(error: unknown): boolean {
    const errnoException = error as NodeJS.ErrnoException

    return errnoException.code === 'ENOENT'
  }

  protected _parseJsonContent(params: { content: string }): unknown {
    const { content } = params
    try {
      return JSON.parse(content)
    } catch {
      return undefined
    }
  }

  protected async _readJsonFile(params: { filePath: string }): Promise<unknown> {
    const content = await this._readTextFile(params)

    if (content === undefined) {
      return undefined
    }

    return this._parseJsonContent({ content })
  }

  protected async _readTextFile(params: { filePath: string }): Promise<string | undefined> {
    const { filePath } = params
    try {
      return await readFile(filePath, 'utf8')
    } catch (error) {
      if (this._isNotFoundError(error)) {
        return undefined
      }

      throw error
    }
  }

  protected async _resolveFileSize(params: { filePath: string }): Promise<number | undefined> {
    const { filePath } = params
    try {
      const fileInfo = await stat(filePath)

      return fileInfo.size
    } catch {
      return undefined
    }
  }

  protected async _writeJsonFile(params: { content: unknown; filePath: string }): Promise<void> {
    const { content, filePath } = params
    await this._writeTextFile({ content: `${JSON.stringify(content, null, 2)}\n`, filePath })
  }

  protected async _writeTextFile(params: { content: string; filePath: string }): Promise<void> {
    const { content, filePath } = params
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }
}
