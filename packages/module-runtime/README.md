# @pangtou/module-runtime

`@pangtou/module-runtime` 提供模块的运行时抽象，包括模块导出类型、模块应用类型、注册表、加载器工具，以及基于 `frontend manifest` 的远端定义转换。

这个包用于解决两类问题：

- 插件如何以统一结构导出模块和模块应用
- 宿主如何在本地、federation、wujie 等运行时下解析和挂载这些导出

## 安装

```bash
pnpm add @pangtou/module-runtime @pangtou/host-sdk @pangtou/shared
```

## 发布说明

发布前先生成 `dist`：

```bash
pnpm --filter @pangtou/module-runtime build
pnpm --filter @pangtou/module-runtime check:types
```

当前 npm 入口已指向 `dist/index.js` 和 `dist/index.d.ts`。
包内 `tsconfig` 已经改为独立配置，不依赖 monorepo 根目录的 `tsconfig.base.json` 或仓库路径映射。

## 核心导出

- `Module`
  标准模块结构，承载 `routes`、`pages`、`widgets`、`install`
- `ModuleApplication`
  需要显式 `mount/unmount` 的应用级导出
- `registerModule` / `getRegisteredModules`
  模块注册和读取
- `getRegisteredRoutes` / `getRegisteredPages` / `getRegisteredWidgets`
  从注册表中汇总模块能力
- `resolveModuleExport`
  兼容 `default`、`module`、`createModule` 等导出形式
- `resolveModuleApplicationExport`
  兼容 `default`、`application`、`createApplication` 等导出形式
- `loadModuleByLoader`
  通过自定义 loader 解析模块
- `createRemoteModuleDefinitionFromManifest`
  从 `frontend manifest` 派生运行时远端定义

## 示例

```ts
import type { Module } from '@pangtou/module-runtime'

export const demoModule: Module = {
  name: 'demo',
  version: '1.0.0',
  title: '示例模块',
  routes: [
    {
      name: 'demo-home',
      path: '/demo',
      title: '示例首页',
    },
  ],
  pages: [],
}
```

```ts
import {
  registerModule,
  getRegisteredRoutes,
  resolveModuleExport,
} from '@pangtou/module-runtime'

registerModule(resolveModuleExport({ module: demoModule }))

const routes = getRegisteredRoutes()
```

## 和 `frontend manifest` 的关系

如果宿主已经拿到后端返回的 `frontend manifest`，可以使用：

- `createRemoteModuleDefinitionFromManifest`
- `createRemoteApplicationDefinitionFromManifest`

把协议层数据转换为运行时可消费的远端定义，再交给宿主自己的 loader 实现。

## 设计原则

- 模块导出结构稳定
- 运行时实现和宿主 UI 解耦
- 兼容本地直连与远端懒加载
- 尽量让宿主只处理“加载”，而不是重复解释插件协议
- 发布到 npm 时请确保内部依赖已经切换为正式版本号

## 适用场景

- console 动态装配业务模块
- federation remote 的模块元数据加载
- 插件模板输出标准模块或模块应用
