/** frontend manifest 支持的插件类型。 */
export const FRONTEND_KIND_VALUES = ['module', 'micro-app'] as const
/** frontend manifest 支持的运行时类型。 */
export const FRONTEND_RUNTIME_VALUES = ['local', 'federation', 'wujie'] as const

/** 插件类型。 */
export type FrontendKind = (typeof FRONTEND_KIND_VALUES)[number]
/** 插件运行时类型。 */
export type FrontendRuntime = (typeof FRONTEND_RUNTIME_VALUES)[number]

/** 清单中用于展示和排序的元信息。 */
export interface FrontendManifestMeta {
    icon?: string
    description?: string
    order?: number
    develop?: boolean
    preload?: boolean
}

/** 本地直连模块的入口信息。 */
export interface LocalEntry {
    package: string
    export: string
}

/** Federation 远端模块入口信息。 */
export interface FederationEntry {
    remote: string
    entry: string
    expose: string
}

/** Wujie 微应用入口信息。 */
export interface WujieEntry {
    name: string
    url: string
    alive: boolean
    degrade: boolean
    sync: boolean
}

/** 不同运行时的入口定义集合。 */
export interface FrontendManifestEntry {
    local?: LocalEntry
    federation?: FederationEntry
    wujie?: WujieEntry
}

/** 插件向宿主声明的能力边界。 */
export interface FrontendManifestCapabilities {
    routes: boolean
    pages: boolean
    widgets: boolean
    settings: boolean
}

/** 插件与宿主的兼容约束。 */
export interface FrontendManifestCompatibility {
    console: string
}

/** frontend manifest 标准结构。 */
export interface FrontendManifest {
    id: string
    code: string
    name: string
    version: string
    enabled: boolean
    kind: FrontendKind
    runtime: FrontendRuntime
    routeBase: string
    meta: FrontendManifestMeta
    entry: FrontendManifestEntry
    capabilities: FrontendManifestCapabilities
    compatibility: FrontendManifestCompatibility
}

/** manifest 原始输入，既支持字符串 JSON，也支持对象。 */
export type FrontendManifestInput = string | Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readRequiredString(source: Record<string, unknown>, key: string) {
    const value = source[key]

    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid frontend manifest: field "${key}" is required.`)
    }

    return value.trim()
}

function readOptionalString(source: Record<string, unknown>, key: string) {
    const value = source[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readBoolean(source: Record<string, unknown>, key: string, fallback = false) {
    const value = source[key]
    return typeof value === 'boolean' ? value : fallback
}

function readNumber(source: Record<string, unknown>, key: string) {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readEnum<T extends readonly string[]>(
    source: Record<string, unknown>,
    key: string,
    values: T,
    fallback: T[number],
) {
    const value = source[key]
    return typeof value === 'string' && values.includes(value as T[number]) ? value as T[number] : fallback
}

function normalizeRouteBase(value: string | undefined, fallbackCode: string) {
    const raw = (value || `/${fallbackCode}`).trim()
    const normalized = raw.startsWith('/') ? raw : `/${raw}`
    return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

function normalizeManifestMeta(source: unknown): FrontendManifestMeta {
    if (!isRecord(source)) {
        return {}
    }

    return {
        icon: readOptionalString(source, 'icon'),
        description: readOptionalString(source, 'description'),
        order: readNumber(source, 'order'),
        develop: readBoolean(source, 'develop'),
        preload: readBoolean(source, 'preload'),
    }
}

function normalizeLocalEntry(source: unknown) {
    if (!isRecord(source)) {
        return undefined
    }

    const packageName = readOptionalString(source, 'package')
    if (!packageName) {
        return undefined
    }

    return {
        package: packageName,
        export: readOptionalString(source, 'export') || 'module',
    } satisfies LocalEntry
}

function normalizeFederationEntry(source: unknown) {
    if (!isRecord(source)) {
        return undefined
    }

    const remote = readOptionalString(source, 'remote')
    const entry = readOptionalString(source, 'entry')

    if (!remote || !entry) {
        return undefined
    }

    return {
        remote,
        entry,
        expose: readOptionalString(source, 'expose') || './module',
    } satisfies FederationEntry
}

function normalizeWujieEntry(source: unknown) {
    if (!isRecord(source)) {
        return undefined
    }

    const name = readOptionalString(source, 'name')
    const url = readOptionalString(source, 'url')

    if (!name || !url) {
        return undefined
    }

    return {
        name,
        url,
        alive: readBoolean(source, 'alive'),
        degrade: readBoolean(source, 'degrade'),
        sync: readBoolean(source, 'sync', true),
    } satisfies WujieEntry
}

function normalizeEntry(source: unknown): FrontendManifestEntry {
    if (!isRecord(source)) {
        return {}
    }

    return {
        local: normalizeLocalEntry(source.local),
        federation: normalizeFederationEntry(source.federation),
        wujie: normalizeWujieEntry(source.wujie),
    }
}

function normalizeCapabilities(source: unknown): FrontendManifestCapabilities {
    if (!isRecord(source)) {
        return {
            routes: false,
            pages: false,
            widgets: false,
            settings: false,
        }
    }

    return {
        routes: readBoolean(source, 'routes'),
        pages: readBoolean(source, 'pages'),
        widgets: readBoolean(source, 'widgets'),
        settings: readBoolean(source, 'settings'),
    }
}

function normalizeCompatibility(source: unknown): FrontendManifestCompatibility {
    if (!isRecord(source)) {
        return {
            console: '*',
        }
    }

    return {
        console: readOptionalString(source, 'console') || '*',
    }
}

/** 解析并规范化单条 frontend manifest。 */
export function parseFrontendManifest(input: FrontendManifestInput) {
    const parsed = typeof input === 'string' ? JSON.parse(input) as unknown : input

    if (!isRecord(parsed)) {
        throw new Error('Invalid frontend manifest: root value must be an object.')
    }

    const id = readRequiredString(parsed, 'id')
    const code = readOptionalString(parsed, 'code') || id
    const runtime = readEnum(parsed, 'runtime', FRONTEND_RUNTIME_VALUES, 'local')
    const entry = normalizeEntry(parsed.entry)

    // 统一 frontend.json 为宿主可直接消费的结构。
    const manifest: FrontendManifest = {
        id,
        code,
        name: readRequiredString(parsed, 'name'),
        version: readRequiredString(parsed, 'version'),
        enabled: readBoolean(parsed, 'enabled', true),
        kind: readEnum(parsed, 'kind', FRONTEND_KIND_VALUES, 'module'),
        runtime,
        routeBase: normalizeRouteBase(readOptionalString(parsed, 'routeBase'), code),
        meta: normalizeManifestMeta(parsed.meta),
        entry,
        capabilities: normalizeCapabilities(parsed.capabilities),
        compatibility: normalizeCompatibility(parsed.compatibility),
    }

    if (runtime === 'local' && !manifest.entry.local) {
        throw new Error(`Invalid frontend manifest "${manifest.id}": runtime "local" requires "entry.local".`)
    }

    if (runtime === 'federation' && !manifest.entry.federation) {
        throw new Error(`Invalid frontend manifest "${manifest.id}": runtime "federation" requires "entry.federation".`)
    }

    if (runtime === 'wujie' && !manifest.entry.wujie) {
        throw new Error(`Invalid frontend manifest "${manifest.id}": runtime "wujie" requires "entry.wujie".`)
    }

    return manifest
}

/** 根据 manifest.runtime 返回当前真正生效的 entry。 */
export function resolveFrontendManifestEntry(manifest: FrontendManifest) {
    if (manifest.runtime === 'local') {
        return manifest.entry.local
    }

    if (manifest.runtime === 'federation') {
        return manifest.entry.federation
    }

    return manifest.entry.wujie
}

/** 判断清单是否为模块型插件。 */
export function isModuleManifest(manifest: FrontendManifest) {
    return manifest.kind === 'module'
}

/** 判断清单是否为微应用型插件。 */
export function isMicroAppManifest(manifest: FrontendManifest) {
    return manifest.kind === 'micro-app'
}
