/** 默认 API 基地址，占位用于本地 mock 或未显式配置时的回退值。 */
export const DEFAULT_API_BASE_URL = 'https://m1.apifoxmock.com/m1/7358748-7089625-default'

/** 规范化 URL，统一移除尾部斜杠。 */
export function resolveUrl(value: string | undefined, fallback: string) {
    const resolved = (value || fallback).trim()
    return resolved ? resolved.replace(/\/+$/, '') : ''
}

/** 解析请求模式，未知值统一回退到 `mock`。 */
export function resolveRequestMode(value?: string) {
    return value === 'http' || value === 'hybrid' ? value : 'mock'
}

/** 解析逗号分隔字符串或数组，并去重后返回字符串列表。 */
export function resolveStringList(value?: string | string[], fallback: string[] = []) {
    const source = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : fallback

    return Array.from(new Set(source.map((item) => item.trim()).filter(Boolean)))
}
