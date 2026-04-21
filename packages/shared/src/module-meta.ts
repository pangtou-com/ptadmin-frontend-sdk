/** 模块导出的路由元信息。 */
export interface ModuleRouteEntry {
    name: string
    path: string
    title: string
    component?: string
    redirect?: string
    icon?: string
    keepAlive?: boolean
    children?: ModuleRouteEntry[]
}

/**
 * 模块暴露给宿主的 widget 定义。
 *
 * 当前 v1 协议只负责声明“有哪些 widget 类型可用”，不直接承载渲染组件本身。
 * 宿主应把它理解为 widget 的元数据入口，而不是完整的自定义 widget 渲染协议。
 *
 * TODO: 如果后续需要支持插件自定义 widget 实现，可在这里继续扩展
 * `component`、异步 loader、`schemaKey`、`defaultConfig` 等字段。
 */
export interface ModuleWidgetEntry {
    /** widget 唯一类型标识；宿主通常据此匹配对应的实现。 */
    type: string
    /** widget 展示标题。 */
    title: string
    /** widget 简短说明，用于选择器、配置面板等场景。 */
    description?: string
}

/** 模块页面声明，用于和后端资源树按 `module + page_key` 做绑定。 */
export interface ModulePageEntry {
    key: string
    title: string
    module: string
    path: string
    component: unknown
    /**
     * 页面对应的 schema 标识。
     *
     * TODO: 当宿主识别到 `schemaKey` 时，这类页面应切换到专用的 schema 页面容器，
     * 由容器按 key 动态拉取 schema 并完成渲染；当前阶段只保留协议字段，不接入实际行为。
     */
    schemaKey?: string
}
