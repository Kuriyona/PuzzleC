import { inject, provide } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import type { LocaleId } from '../types'
import { translate } from './messages'
import type { MessageKey } from './messages'

/** 当前界面语言（App 从 settings.locale 派生） */
export const LOCALE_KEY: InjectionKey<Ref<LocaleId>> = Symbol('puzzlec.locale')

export function provideLocale(locale: Ref<LocaleId>): void {
  provide(LOCALE_KEY, locale)
}

export type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string

/**
 * 返回翻译函数。在模板里调用时读取的是注入的 `locale` ref，
 * 因此它天然是响应式的（渲染副作用会重新收集依赖）。
 */
export function useT(): TranslateFn {
  const locale = inject(LOCALE_KEY)
  if (!locale) throw new Error('useT() 必须在 App 调用了 provideLocale() 之后使用')
  return (key, params) => translate(locale.value, key, params)
}
