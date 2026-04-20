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

/** 模块暴露给宿主的 widget 定义。 */
export interface ModuleWidgetEntry {
    type: string
    title: string
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
