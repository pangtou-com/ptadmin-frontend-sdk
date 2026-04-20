import type { FrontendManifest, FrontendRuntime } from '@pangtou/shared'
import { isMicroAppManifest, isModuleManifest, resolveFrontendManifestEntry } from '@pangtou/shared'
import type { RemoteModuleDefinition } from './index'

function assertRuntimeEntry(manifest: FrontendManifest, runtime: FrontendRuntime) {
    const entry = resolveFrontendManifestEntry(manifest)

    if (!entry) {
        throw new Error(`Frontend manifest "${manifest.id}" is missing runtime entry for "${runtime}".`)
    }

    return entry
}

export function createRemoteModuleDefinitionFromManifest(manifest: FrontendManifest): RemoteModuleDefinition {
    if (!isModuleManifest(manifest)) {
        throw new Error(`Frontend manifest "${manifest.id}" is not a module manifest.`)
    }

    if (manifest.runtime === 'local') {
        assertRuntimeEntry(manifest, manifest.runtime)

        return {
            name: manifest.code,
            type: 'local',
        }
    }

    if (manifest.runtime === 'federation') {
        assertRuntimeEntry(manifest, manifest.runtime)
        const entry = manifest.entry.federation!

        return {
            name: manifest.code,
            type: 'federation',
            entry: entry.entry,
            scope: entry.remote,
            exposedModule: entry.expose,
        }
    }

    throw new Error(`Frontend manifest "${manifest.id}" uses runtime "${manifest.runtime}" which is not supported for module loading.`)
}

/**
 * 将 frontend manifest 转换为应用级运行时定义。
 *
 * `module` 清单会继续走模块加载规则；
 * `micro-app` 清单会转换为 wujie 应用定义。
 */
export function createRemoteApplicationDefinitionFromManifest(manifest: FrontendManifest): RemoteModuleDefinition {
    if (manifest.runtime === 'wujie' && isMicroAppManifest(manifest)) {
        assertRuntimeEntry(manifest, manifest.runtime)
        const entry = manifest.entry.wujie!

        return {
            name: manifest.code,
            type: 'wujie',
            entry: entry.url,
            scope: entry.name,
        }
    }

    if (manifest.runtime === 'local' || manifest.runtime === 'federation') {
        return createRemoteModuleDefinitionFromManifest(manifest)
    }

    throw new Error(`Frontend manifest "${manifest.id}" cannot be converted to an application definition.`)
}
