import { parseFrontendManifest, type FrontendManifest, type FrontendManifestInput } from './frontend-manifest'

/** 标准 frontend catalog 载荷。 */
export interface FrontendCatalogPayload {
    items: FrontendManifest[]
}

/** 当前后端主格式：直接返回 manifest 数组。 */
export type FrontendCatalogArrayInput = FrontendManifestInput[]

/**
 * 解析后端返回的 frontend catalog 数据。
 * 这一层只关心清单本身，不处理通用业务响应包裹结构。
 *
 * 当前主协议为直接返回数组：
 * `[{ ...manifest }]`
 */
export function parseFrontendCatalog(input: FrontendCatalogArrayInput) {
    if (!Array.isArray(input)) {
        throw new Error('Invalid frontend catalog: root value must be an array.')
    }

    return {
        items: input.map((item) => parseFrontendManifest(item)),
    } satisfies FrontendCatalogPayload
}

/**
 * 以 code 为键合并 manifest 列表。
 * 后出现的同 code 项会覆盖前面的声明，适合“默认种子 + 后端配置覆盖”场景。
 */
export function mergeFrontendManifests(...groups: FrontendManifest[][]) {
    const merged = new Map<string, FrontendManifest>()

    groups.forEach((group) => {
        group.forEach((manifest) => {
            merged.set(manifest.code, manifest)
        })
    })

    return Array.from(merged.values())
}

/**
 * 统一按 meta.order 和 name 排序，保证宿主菜单、设置页和插件列表展示顺序稳定。
 */
export function sortFrontendManifests(items: FrontendManifest[]) {
    return [...items].sort((left, right) => {
        const orderDelta = (left.meta.order ?? Number.MAX_SAFE_INTEGER) - (right.meta.order ?? Number.MAX_SAFE_INTEGER)

        if (orderDelta !== 0) {
            return orderDelta
        }

        return left.name.localeCompare(right.name, 'zh-CN')
    })
}
