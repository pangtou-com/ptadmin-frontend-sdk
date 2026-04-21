# @pangtou/shared

`@pangtou/shared` 是前端插件体系的公共协议包。

它主要包含三类能力：

- 模块元数据类型
- frontend manifest / catalog 协议
- JSON / SSE 请求与常用运行时工具

如果 `@pangtou/host-sdk` 解决的是“插件如何调用宿主”，那么 `@pangtou/shared` 解决的是“插件和宿主如何共享同一套数据结构和协议定义”。

## 安装

```bash
pnpm add @pangtou/shared
```

## 发布说明

发布前请先构建并校验类型：

```bash
pnpm --filter @pangtou/shared build
pnpm --filter @pangtou/shared check:types
```

当前包入口已指向 `dist/index.js` 和 `dist/index.d.ts`。
包内 `tsconfig` 为独立配置，迁移到单独仓库时不需要继续依赖当前 monorepo 的根配置文件。

## 主要模块

### `frontend-manifest`

定义标准插件清单结构：

- `FrontendManifest`
- `FrontendManifestEntry`
- `FederationEntry`
- `WujieEntry`
- `parseFrontendManifest`
- `resolveFrontendManifestEntry`

适合用于：

- 解析 `frontend.json`
- 解析 `/auth/frontends`
- 对插件清单做基础校验和标准化

### `frontend-catalog`

定义清单目录结构和工具：

- `FrontendCatalogPayload`
- `parseFrontendCatalog`
- `mergeFrontendManifests`
- `sortFrontendManifests`

适合用于：

- 合并默认插件和后端覆盖插件
- 对插件列表做排序和展示

### `module-meta`

定义模块输出的基础元数据类型：

- `ModuleRouteEntry`
- `ModulePageEntry`
- `ModuleWidgetEntry`

其中 `ModulePageEntry` 的 `schemaKey` 可用于标记 schema 页面。
当前协议层只保留标识字段，后续由宿主根据 `schemaKey` 切换到专用的 schema 页面容器并按需拉取配置。

`ModuleWidgetEntry` 当前也遵循同样的最小协议思路：

- 只声明 widget 的基础元数据
- 不直接约定 widget 的渲染组件实现
- 宿主可把它理解为“可用 widget 类型清单”

如果后续需要支持插件真正提供自定义 widget，再扩展 `component`、异步 loader、`schemaKey`、`defaultConfig` 等字段即可。

### `http`

定义公共请求工具：

- `requestJson`
- `requestSseJson`
- `unwrapBusinessEnvelope`
- `UnauthorizedError`

其中 `requestSseJson` 同时兼容：

- 标准 SSE：`event:` / `data:`
- 空行分隔 JSON 块

### `runtime`

定义简单的运行时工具：

- `resolveUrl`
- `resolveRequestMode`
- `resolveStringList`

## 示例

```ts
import {
  parseFrontendCatalog,
  requestJson,
  unwrapBusinessEnvelope,
} from '@pangtou/shared'

const catalog = parseFrontendCatalog([
  {
    id: 'cms',
    code: 'cms',
    name: '内容管理',
    version: '1.0.0',
    enabled: true,
    kind: 'module',
    runtime: 'federation',
    routeBase: '/cms',
    entry: {
      federation: {
        remote: 'cms_remote',
        entry: 'https://static.example.com/cms/assets/remoteEntry.js',
        expose: './module',
      },
    },
    capabilities: {
      routes: true,
      pages: true,
      widgets: false,
      settings: false,
    },
    compatibility: {
      console: '>=0.1.0',
    },
    meta: {},
  },
])

const response = await requestJson<{ code: number; data: unknown[] }>({
  baseURL: 'https://api.example.com',
  url: '/auth/frontends',
  method: 'GET',
})

const data = unwrapBusinessEnvelope(response)
```

## 设计目标

- 前后端共享插件协议
- 宿主、模板、业务模块复用相同类型
- 把和具体业务无关的解析逻辑集中到一个公共包
- 避免把具体 schema 引擎直接耦合进基础协议包

## 推荐搭配

- 宿主能力契约：`@pangtou/host-sdk`
- 模块运行时：`@pangtou/module-runtime`
- 协议与工具：`@pangtou/shared`

## 注意事项

- `requestJson` 不会自动拆业务包裹，若后端返回 `{ code, data }`，请配合 `unwrapBusinessEnvelope` 使用
- `requestSseJson` 既支持标准 SSE，也支持空行分隔 JSON 块
- 发布到 npm 前请确认依赖版本已从 workspace 引用切换到正式版本号
