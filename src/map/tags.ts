/**
 * 特性标签语法（纯模块，无副作用）。
 * 标签形如 `路径[:主版本.次版本]`，路径 = `[a-z0-9-]+` 段以 `/` 连接；版本后缀可省略。
 */

export interface TagVersion {
  major: number
  minor: number
}

export interface ParsedTag {
  /** 原始字符串 */
  raw: string
  /** 去掉版本后缀的路径，如 `text-tag/font/size` */
  path: string
  /** path 按 `/` 切分的段落 */
  segments: string[]
  /** 无版本后缀时为 null */
  version: TagVersion | null
}

const PATH_RE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/
const VERSION_RE = /^(\d+)\.(\d+)$/

/** 解析 `text-tag/font/size:1.0`；非法返回 null（版本须为 `主.次` 两个非负整数） */
export function parseTag(raw: string): ParsedTag | null {
  const colon = raw.indexOf(':')
  const path = colon === -1 ? raw : raw.slice(0, colon)
  const versionPart = colon === -1 ? null : raw.slice(colon + 1)
  if (!PATH_RE.test(path)) return null

  let version: TagVersion | null = null
  if (versionPart !== null) {
    const m = VERSION_RE.exec(versionPart)
    if (!m) return null
    version = { major: Number(m[1]), minor: Number(m[2]) }
  }
  return { raw, path, segments: path.split('/'), version }
}

export function formatVersion(v: TagVersion): string {
  return `${v.major}.${v.minor}`
}

/** -1 | 0 | 1 */
export function compareVersion(a: TagVersion, b: TagVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  return 0
}
