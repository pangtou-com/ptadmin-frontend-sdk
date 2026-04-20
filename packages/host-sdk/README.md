# @pangtou/host-sdk

`@pangtou/host-sdk` 定义插件和宿主之间的运行时契约。

它本身不包含具体 UI、路由或请求实现，只提供统一的类型声明和 SDK 访问入口，方便插件在不同宿主环境里复用同一套接入代码。

## 安装

```bash
pnpm add @pangtou/host-sdk
```

## 发布说明

发布到 npm 时请使用构建产物而不是源码目录：

```bash
pnpm --filter @pangtou/host-sdk build
pnpm --filter @pangtou/host-sdk check:types
```

包入口已经指向 `dist/index.js` 和 `dist/index.d.ts`。
包内 `tsconfig` 为自包含配置，不依赖仓库根目录的 TypeScript 基础配置。

## 包含内容

- `HostSdk`
  插件可调用的宿主能力集合，包括 `auth`、`request`、`ui`、`router`、`tabs`、`runtime`
- `HostSseMessage`
  宿主转发给插件的 SSE 消息结构
- `HostSseRequestConfig`
  插件发起 SSE 请求时的统一配置类型
- `defineHostSdk`
  在宿主初始化阶段注册 SDK 单例
- `getHostSdk`
  在插件运行时读取当前 SDK

## 典型用法

```ts
import { defineHostSdk, getHostSdk, type HostSdk } from '@pangtou/host-sdk'

const sdk: HostSdk = {
  auth: {
    getToken: () => '',
    getUser: () => null,
    hasRole: () => false,
    hasPermission: () => false,
  },
  request: {
    raw: async (config) => config,
    sse: async () => [],
    get: async () => ({}),
    post: async () => ({}),
    put: async () => ({}),
    delete: async () => ({}),
  },
  ui: {
    success: console.log,
    error: console.error,
    warning: console.warn,
    info: console.info,
  },
  router: {
    push: () => {},
    replace: () => {},
    back: () => {},
  },
  tabs: {
    open: () => {},
    close: () => {},
  },
  runtime: {
    getBaseURL: () => '',
    getUploadURL: () => '',
    getRequestMode: () => 'http',
    getRouteMode: () => 'hybrid',
    getLayoutMode: () => 'left',
    isDark: () => false,
    getThemeTokens: () => ({}),
  },
}

defineHostSdk(sdk)

const current = getHostSdk()
current.ui.success('ready')
```

## 使用建议

- 插件层应只依赖 `HostSdk` 暴露的能力，不直接引用宿主私有实现
- 宿主应在插件 mount 之前调用 `defineHostSdk`
- 如果宿主支持 SSE 长任务，建议通过 `request.sse` 统一暴露给插件
- 如果要发布到 npm，请先构建 `dist` 再执行 `npm publish`

## 适用场景

- console 宿主向 federation 模块注入能力
- 微应用桥接宿主登录态、路由和提示能力
- 插件模板和业务模块共享同一套宿主契约
