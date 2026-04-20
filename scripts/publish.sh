#!/usr/bin/env bash

set -euo pipefail

SDK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$SDK_ROOT/.." && pwd)"
MODULE_TEMPLATE_ROOT="$WORKSPACE_ROOT/frontend-templates/plugin-module"
MICRO_APP_TEMPLATE_ROOT="$WORKSPACE_ROOT/frontend-templates/plugin-micro-app"
DEFAULT_BRANCH="main"
DEFAULT_BUMP="patch"

TARGET_VERSION=""
BUMP_TYPE="$DEFAULT_BUMP"
RUN_CHECKS=1
PUSH_CHANGES=1
NPM_TAG="latest"

usage() {
    cat <<'EOF'
用法:
  ./scripts/publish.sh [选项]

选项:
  --version 0.1.2              指定发布版本
  --bump patch|minor|major     未指定 --version 时按最新 tag 自动递增，默认 patch
  --npm-tag latest|next        npm 发布 dist-tag，默认 latest
  --skip-checks                跳过发布前校验
  --no-push                    只提交和打 tag，不推送远程
  -h, --help                   查看帮助

示例:
  ./scripts/publish.sh --version 0.1.2
  ./scripts/publish.sh --bump patch
EOF
}

info() {
    printf '\033[36m%s\033[0m\n' "$1"
}

success() {
    printf '\033[32m%s\033[0m\n' "$1"
}

error() {
    printf '\033[31m%s\033[0m\n' "错误: $1" >&2
    exit 1
}

normalize_version() {
    local version="${1#v}"

    if ! echo "$version" | grep -Eq '^[0-9]+(\.[0-9]+){0,2}$'; then
        error "版本格式错误: $1"
    fi

    local old_ifs="$IFS"
    local parts=()
    IFS='.'
    read -r -a parts <<< "$version"
    IFS="$old_ifs"

    while [ "${#parts[@]}" -lt 3 ]; do
        parts+=("0")
    done

    printf '%s.%s.%s' "${parts[0]}" "${parts[1]}" "${parts[2]}"
}

bump_version() {
    local version="$1"
    local bump="$2"
    local major minor patch

    IFS='.' read -r major minor patch <<< "$version"

    case "$bump" in
        patch)
            patch=$((patch + 1))
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *)
            error "不支持的版本递增策略: $bump"
            ;;
    esac

    printf '%s.%s.%s' "$major" "$minor" "$patch"
}

git_latest_tag() {
    local repo_dir="$1"
    git -C "$repo_dir" tag --list 'v*' --sort=-v:refname | head -n 1
}

assert_repo_exists() {
    local repo_dir="$1"

    [ -d "$repo_dir/.git" ] || error "仓库不存在或未初始化: $repo_dir"
}

assert_repo_ready() {
    local repo_dir="$1"
    local repo_name="$2"
    local branch
    local status

    assert_repo_exists "$repo_dir"

    branch="$(git -C "$repo_dir" rev-parse --abbrev-ref HEAD)"
    [ "$branch" = "$DEFAULT_BRANCH" ] || error "$repo_name 当前分支不是 $DEFAULT_BRANCH: $branch"

    status="$(git -C "$repo_dir" status --porcelain)"
    [ -z "$status" ] || error "$repo_name 存在未提交改动，请先清理工作区"
}

commit_repo() {
    local repo_dir="$1"
    local repo_name="$2"
    local version="$3"

    if [ -z "$(git -C "$repo_dir" status --porcelain)" ]; then
        error "$repo_name 没有生成任何版本变更，无法发布 $version"
    fi

    git -C "$repo_dir" add .
    git -C "$repo_dir" commit -m "chore: release v$version"
}

create_tag() {
    local repo_dir="$1"
    local version="$2"

    if git -C "$repo_dir" rev-parse "v$version" >/dev/null 2>&1; then
        error "仓库 $repo_dir 已存在本地 tag v$version"
    fi

    git -C "$repo_dir" tag "v$version"
}

push_repo() {
    local repo_dir="$1"
    local version="$2"

    git -C "$repo_dir" push origin "$DEFAULT_BRANCH"
    git -C "$repo_dir" push origin "v$version"
}

assert_remote_tag_absent() {
    local repo_dir="$1"
    local version="$2"

    if git -C "$repo_dir" ls-remote --tags origin "v$version" | grep -q "refs/tags/v$version$"; then
        error "仓库 $repo_dir 的远程已存在 tag v$version，请更换版本号"
    fi
}

resolve_target_version() {
    if [ -n "$TARGET_VERSION" ]; then
        normalize_version "$TARGET_VERSION"
        return
    fi

    local latest_tag
    latest_tag="$(git_latest_tag "$SDK_ROOT")"

    if [ -z "$latest_tag" ]; then
        bump_version "0.0.0" "$BUMP_TYPE"
        return
    fi

    bump_version "$(normalize_version "${latest_tag#v}")" "$BUMP_TYPE"
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --version)
            TARGET_VERSION="${2:-}"
            shift 2
            ;;
        --bump)
            BUMP_TYPE="${2:-}"
            shift 2
            ;;
        --npm-tag)
            NPM_TAG="${2:-}"
            shift 2
            ;;
        --skip-checks)
            RUN_CHECKS=0
            shift
            ;;
        --no-push)
            PUSH_CHANGES=0
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "未知参数: $1"
            ;;
    esac
done

VERSION="$(resolve_target_version)"

assert_repo_ready "$SDK_ROOT" "frontend-sdk"
assert_repo_ready "$MODULE_TEMPLATE_ROOT" "plugin-module"
assert_repo_ready "$MICRO_APP_TEMPLATE_ROOT" "plugin-micro-app"

if [ "$PUSH_CHANGES" -eq 1 ]; then
    assert_remote_tag_absent "$SDK_ROOT" "$VERSION"
    assert_remote_tag_absent "$MODULE_TEMPLATE_ROOT" "$VERSION"
    assert_remote_tag_absent "$MICRO_APP_TEMPLATE_ROOT" "$VERSION"
fi

info "准备发布版本 v$VERSION"

info "同步 SDK 版本"
node "$SDK_ROOT/scripts/release-packages.mjs" version --version "$VERSION"
pnpm install --dir "$SDK_ROOT"

info "同步模板版本"
node "$MODULE_TEMPLATE_ROOT/scripts/sync-sdk-version.mjs" --version "$VERSION"
node "$MICRO_APP_TEMPLATE_ROOT/scripts/sync-sdk-version.mjs" --version "$VERSION"

if [ "$RUN_CHECKS" -eq 1 ]; then
    info "执行 SDK 校验"
    pnpm --dir "$SDK_ROOT" run release:check

    info "执行模板校验"
    pnpm --dir "$MODULE_TEMPLATE_ROOT" check:types
    pnpm --dir "$MODULE_TEMPLATE_ROOT" manifest:check
    pnpm --dir "$MICRO_APP_TEMPLATE_ROOT" check:types
    pnpm --dir "$MICRO_APP_TEMPLATE_ROOT" manifest:check
fi

info "提交三个仓库"
commit_repo "$SDK_ROOT" "frontend-sdk" "$VERSION"
commit_repo "$MODULE_TEMPLATE_ROOT" "plugin-module" "$VERSION"
commit_repo "$MICRO_APP_TEMPLATE_ROOT" "plugin-micro-app" "$VERSION"

info "发布到 npm"
node "$SDK_ROOT/scripts/release-packages.mjs" publish --version "$VERSION" --tag "$NPM_TAG" --skip-build --skip-check

info "创建 tag"
create_tag "$SDK_ROOT" "$VERSION"
create_tag "$MODULE_TEMPLATE_ROOT" "$VERSION"
create_tag "$MICRO_APP_TEMPLATE_ROOT" "$VERSION"

if [ "$PUSH_CHANGES" -eq 1 ]; then
    info "推送到 GitHub"
    push_repo "$SDK_ROOT" "$VERSION"
    push_repo "$MODULE_TEMPLATE_ROOT" "$VERSION"
    push_repo "$MICRO_APP_TEMPLATE_ROOT" "$VERSION"
fi

success "发布完成: v$VERSION"
