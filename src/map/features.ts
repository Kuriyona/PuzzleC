import type { MessageKey } from '../i18n/messages'
import type { TagVersion } from './tags'
import { formatVersion, parseTag } from './tags'

export interface FeatureNode {
  version: TagVersion
  /** 该特性下可用的子特性 */
  features?: Record<string, FeatureNode>
}

export interface MainTagNode extends FeatureNode {
  /** 上级主标签名（仅说明用），根为 null */
  parent: string | null
}

/**
 * 游戏侧特性表：主标签 = 无 `/` 的标签；副标签挂在上级的 features 下。
 * 版本号是唯一真源，编辑器写出标签时也取自这里。
 */
export const MAIN_TAGS: Record<string, MainTagNode> = {
  game: { version: { major: 0, minor: 1 }, parent: null },
  editor: { version: { major: 0, minor: 1 }, parent: 'game' },
  wall: { version: { major: 1, minor: 0 }, parent: 'editor' },
  start: { version: { major: 1, minor: 0 }, parent: 'editor' },
  goal: { version: { major: 1, minor: 0 }, parent: 'editor' },
  'text-tag': {
    version: { major: 1, minor: 0 },
    parent: 'editor',
    features: {
      font: {
        version: { major: 1, minor: 0 },
        features: {
          size: { version: { major: 1, minor: 0 } },
          align: { version: { major: 1, minor: 0 } },
        },
      },
      i18n: { version: { major: 1, minor: 0 } },
    },
  },
}

/** 按路径查表：首段必须是主标签，其后沿 features 逐段下行；未知返回 null */
export function findFeature(segments: string[]): FeatureNode | null {
  if (segments.length === 0) return null
  let node: FeatureNode | undefined = MAIN_TAGS[segments[0]]
  for (let i = 1; i < segments.length; i++) {
    node = node?.features?.[segments[i]]
    if (!node) return null
  }
  return node ?? null
}

export type IssueSeverity = 'minor' | 'major'

export interface TagIssue {
  key: MessageKey
  params?: Record<string, string | number>
  severity: IssueSeverity
}

/**
 * 去重后逐条检查标签；返回的问题顺序与标签首次出现顺序一致。
 * 未写版本号 = 无问题；主版本不同 = major；主版本相同且次版本更高 = minor。
 */
export function checkTags(tags: string[]): TagIssue[] {
  const issues: TagIssue[] = []
  const seen = new Set<string>()
  for (const raw of tags) {
    if (seen.has(raw)) continue
    seen.add(raw)

    const parsed = parseTag(raw)
    if (!parsed) {
      issues.push({ key: 'map.warn.unknownTag', params: { tag: raw }, severity: 'major' })
      continue
    }
    const node = findFeature(parsed.segments)
    if (!node) {
      issues.push({ key: 'map.warn.unknownTag', params: { tag: raw }, severity: 'major' })
      continue
    }
    if (!parsed.version) continue
    const supported = formatVersion(node.version)
    if (parsed.version.major !== node.version.major) {
      issues.push({
        key: 'map.warn.majorVersion',
        params: { tag: raw, supported },
        severity: 'major',
      })
    } else if (parsed.version.minor > node.version.minor) {
      issues.push({
        key: 'map.warn.higherVersion',
        params: { tag: raw, supported },
        severity: 'minor',
      })
    }
  }
  return issues
}
