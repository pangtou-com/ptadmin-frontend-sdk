# Frontend SDK

这个仓库只维护前端插件体系的基础 SDK 包：

- `@pangtou/host-sdk`
- `@pangtou/shared`
- `@pangtou/module-runtime`

## 发布流程

同步版本：

```bash
pnpm release:version -- --version 0.1.0
```

本地校验：

```bash
pnpm release:check
```

发布到 npm：

```bash
pnpm release:publish -- --version 0.1.0
```

发布脚本会自动：

- 同步三个包的版本号
- 同步内部依赖版本
- 依次执行 build 和 check:types
- 按顺序发布到 npm registry
