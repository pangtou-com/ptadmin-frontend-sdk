/** 宿主路由来源模式。 */
export type RouteMode = 'backend' | 'static' | 'hybrid'
/** 宿主布局模式。 */
export type LayoutMode = 'left' | 'top' | 'left-top'
/** 宿主请求模式。 */
export type RequestMode = 'mock' | 'http' | 'hybrid'
/** 宿主发起请求时允许使用的 HTTP 方法。 */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * 宿主转发给插件的单条 SSE 消息。
 *
 * `data` 会优先按 JSON 解析，解析失败时保留原始字符串。
 */
export interface HostSseMessage<T = unknown> {
    event: string
    id?: string
    retry?: number
    data: T | string | null
    rawData: string
}

/** 宿主统一的 SSE 请求配置。 */
export interface HostSseRequestConfig<T = unknown> {
    url: string
    method?: RequestMethod
    params?: Record<string, any>
    data?: Record<string, any> | FormData
    headers?: Record<string, any>
    onMessage?: (message: HostSseMessage<T>) => void | Promise<void>
}

/**
 * 插件运行期间可访问的宿主能力集合。
 *
 * 该接口是插件和宿主之间的核心契约，插件应只依赖这里暴露出的能力，
 * 不直接引用 console 内部实现。
 */
export interface HostSdk {
    /** 当前登录态与权限判断能力。 */
    auth: {
        getToken: () => string
        getUser: () => Record<string, any> | null
        hasRole: (role: string) => boolean
        hasPermission: (code: string) => boolean
    }
    /** 统一请求能力，包含普通 JSON 请求和 SSE 流式请求。 */
    request: {
        raw: <T = any>(config: Record<string, any>) => Promise<T>
        sse: <T = any>(config: HostSseRequestConfig<T>) => Promise<HostSseMessage<T>[]>
        get: <T = any>(url: string, params?: Record<string, any>) => Promise<T>
        post: <T = any>(url: string, data?: Record<string, any>) => Promise<T>
        put: <T = any>(url: string, data?: Record<string, any>) => Promise<T>
        delete: <T = any>(url: string, data?: Record<string, any>) => Promise<T>
    }
    /** 宿主 UI 交互能力。 */
    ui: {
        success: (message: string) => void
        error: (message: string) => void
        warning: (message: string) => void
        info: (message: string) => void
        alert?: (options: {
            title?: string
            message: string
            type?: 'success' | 'info' | 'warning' | 'error'
            confirmButtonText?: string
        }) => Promise<void>
        confirm?: (options: {
            title?: string
            message: string
            type?: 'success' | 'info' | 'warning' | 'error'
            confirmButtonText?: string
            cancelButtonText?: string
        }) => Promise<void>
    }
    /** 宿主路由跳转能力。 */
    router: {
        push: (path: string, query?: Record<string, any>) => void
        replace: (path: string, query?: Record<string, any>) => void
        back: () => void
    }
    /** 页签操作能力。 */
    tabs: {
        open: (tab: { title: string; path: string }) => void
        close: (path: string) => void
        refresh?: (path?: string) => void
    }
    /** 宿主运行时上下文。 */
    runtime: {
        getBaseURL: () => string
        getUploadURL: () => string
        getRequestMode: () => RequestMode
        getRouteMode: () => RouteMode
        getLayoutMode: () => LayoutMode
        isDark: () => boolean
        getThemeTokens: () => Record<string, string>
        getModuleConfig?: (moduleKey: string) => Record<string, any> | null
    }
}

let currentHostSdk: HostSdk | null = null

/** 注册当前运行时可被插件读取的宿主 SDK 单例。 */
export function defineHostSdk(sdk: HostSdk) {
    currentHostSdk = sdk
    return sdk
}

/** 获取当前宿主 SDK；若宿主尚未初始化则抛出异常。 */
export function getHostSdk() {
    if (!currentHostSdk) {
        throw new Error('Host SDK has not been defined yet.')
    }

    return currentHostSdk
}
