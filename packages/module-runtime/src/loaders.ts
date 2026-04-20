import type {
    Module,
    ModuleApplication,
    ModuleApplicationProps,
    RemoteModuleDefinition,
} from './index'
import { resolveModuleApplicationExport, resolveModuleExport } from './index'

/** 返回远端模块导出的懒加载器。 */
export type ModuleLoader = () => Promise<unknown>

/** 通过自定义 loader 解析模块导出。 */
export async function loadModuleByLoader(loader: ModuleLoader) {
    const mod = await loader()
    return resolveModuleExport(mod as any)
}

/** 通过自定义 loader 解析模块应用导出。 */
export async function loadModuleApplicationByLoader(loader: ModuleLoader) {
    const mod = await loader()
    return resolveModuleApplicationExport(mod as any)
}

/** 挂载模块应用并返回原始应用实例。 */
export async function mountModuleApplication(application: ModuleApplication, props: ModuleApplicationProps) {
    await application.mount(props)
    return application
}

/** 卸载模块应用。 */
export async function unmountModuleApplication(application: ModuleApplication) {
    await application.unmount()
}

/** 通过 `RemoteModuleDefinition.name` 从 loader 表中加载模块。 */
export async function loadModuleByDefinition(
    definition: RemoteModuleDefinition,
    loaders: Record<string, ModuleLoader>,
): Promise<Module> {
    const loader = loaders[definition.name]

    if (!loader) {
        throw new Error(`No loader registered for module "${definition.name}".`)
    }

    return loadModuleByLoader(loader)
}

/** 通过 `RemoteModuleDefinition.name` 从 loader 表中加载模块应用。 */
export async function loadModuleApplicationByDefinition(
    definition: RemoteModuleDefinition,
    loaders: Record<string, ModuleLoader>,
) {
    const loader = loaders[definition.name]

    if (!loader) {
        throw new Error(`No application loader registered for module "${definition.name}".`)
    }

    return loadModuleApplicationByLoader(loader)
}
