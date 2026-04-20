# Frontend SDK

这个仓库只维护前端插件体系的基础 SDK 包：

- `@pangtou/host-sdk`
- `@pangtou/shared`
- `@pangtou/module-runtime`

## 发布流程

推荐直接使用本地一键发布脚本：

```bash
./scripts/publish.sh --version 0.1.2
```

或者：

```bash
pnpm release:all -- --version 0.1.2
```

如果不手动指定版本，也可以按最新 tag 自动递增：

```bash
./scripts/publish.sh --bump patch
```

这个脚本会按固定顺序处理：

- 同步 `frontend-sdk` 仓库根版本和 3 个 SDK 包版本
- 同步 `plugin-module`、`plugin-micro-app` 两个模板仓库的版本号
- 同步模板仓库中的 SDK 依赖版本
- 执行 SDK 的 build 和 `check:types`
- 执行两个模板仓库的 `check:types` 和 `manifest:check`
- 提交三个仓库
- 发布 `@pangtou/host-sdk`、`@pangtou/shared`、`@pangtou/module-runtime` 到 npm
- 为三个仓库创建并推送同名 tag，例如 `v0.1.2`

发布脚本要求目录结构保持如下：

```text
ptadmin_vue.pangtou.com/
├─ frontend-sdk/
└─ frontend-templates/
   ├─ plugin-module/
   └─ plugin-micro-app/
```

发布前要求：

- 三个仓库都在 `main` 分支
- 三个仓库工作区都必须是干净状态
- 本地已经具备 Git 推送权限
- 本地已经完成 npm 登录，并具备这 3 个包的发布权限

如果只想做版本同步和校验，仍然可以分别使用：

```bash
pnpm release:version -- --version 0.1.2
pnpm release:check
pnpm release:publish -- --version 0.1.2
```
