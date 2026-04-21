import type { HostSdk } from '@pangtou/host-sdk'
import type { ModulePageEntry, ModuleWidgetEntry } from '@pangtou/shared'

/**
 * 模块的标准导出结构。
 *
 * 宿主会从这里收集页面、widget 和安装钩子。
 */
export interface Module {
    name: string
    version: string
    title: string
    description?: string
    pages?: ModulePageEntry[]
    widgets?: ModuleWidgetEntry[]
    install?: (sdk: HostSdk) => void | Promise<void>
}

/** 模块应用实例在 mount 时收到的上下文。 */
export interface ModuleApplicationProps {
    sdk: HostSdk
    container?: unknown
    basePath?: string
}

/**
 * 可挂载模块应用的统一导出约定。
 *
 * 对于 federation / micro-app 等需要先执行宿主桥接初始化的场景，
 * 建议额外暴露该对象。
 */
export interface ModuleApplication {
    module: Module
    mount: (props: ModuleApplicationProps) => void | Promise<void>
    unmount: () => void | Promise<void>
}

/** 从 frontend manifest 派生出的运行时远端定义。 */
export interface RemoteModuleDefinition {
    name: string
    type: 'local' | 'federation' | 'wujie'
    entry?: string
    scope?: string
    exposedModule?: string
}

type ModuleExportShape =
    | Module
    | { default: Module }
    | { module: Module }
    | { createModule: () => Module }

type ModuleApplicationExportShape =
    | ModuleApplication
    | { default: ModuleApplication }
    | { application: ModuleApplication }
    | { createApplication: () => ModuleApplication }

const moduleRegistry = new Map<string, Module>()

/** 向当前运行时注册一个模块。 */
export function registerModule(module: Module) {
    moduleRegistry.set(module.name, module)
    return module
}

/** 获取当前已注册的全部模块。 */
export function getRegisteredModules() {
    return Array.from(moduleRegistry.values())
}

/** 汇总当前所有模块声明的 widget。 */
export function getRegisteredWidgets() {
    return getRegisteredModules().flatMap((module) => module.widgets ?? [])
}

/** 汇总当前所有模块声明的页面。 */
export function getRegisteredPages() {
    return getRegisteredModules().flatMap((module) => module.pages ?? [])
}

/** 清空当前模块注册表。 */
export function clearRegisteredModules() {
    moduleRegistry.clear()
}

/** 依次执行已注册模块的 install 钩子。 */
export async function installRegisteredModules(sdk: HostSdk) {
    for (const module of moduleRegistry.values()) {
        await module.install?.(sdk)
    }
}

/** 兼容多种模块导出形态并统一解析为 `Module`。 */
export function resolveModuleExport(input: ModuleExportShape) {
    if ('name' in input) {
        return input
    }

    if ('default' in input) {
        return input.default
    }

    if ('module' in input) {
        return input.module
    }

    return input.createModule()
}

/** 兼容多种应用导出形态并统一解析为 `ModuleApplication`。 */
export function resolveModuleApplicationExport(input: ModuleApplicationExportShape) {
    if ('module' in input && 'mount' in input && 'unmount' in input) {
        return input
    }

    if ('default' in input) {
        return input.default
    }

    if ('application' in input) {
        return input.application
    }

    return input.createApplication()
}

export {
    loadModuleApplicationByDefinition,
    loadModuleApplicationByLoader,
    loadModuleByDefinition,
    loadModuleByLoader,
    mountModuleApplication,
    unmountModuleApplication,
} from './loaders'
export * from './manifest'
