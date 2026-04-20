#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const rootManifestPath = path.join(repoRoot, 'package.json')

const releasePackages = [
    {
        name: '@pangtou/host-sdk',
        dir: 'packages/host-sdk',
    },
    {
        name: '@pangtou/shared',
        dir: 'packages/shared',
    },
    {
        name: '@pangtou/module-runtime',
        dir: 'packages/module-runtime',
    },
]

const releasePackageNames = new Set(releasePackages.map((item) => item.name))
const defaultRegistry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org/'
const defaultTag = process.env.NPM_TAG || 'latest'
const defaultNpmCache = process.env.NPM_CONFIG_CACHE || path.join(repoRoot, '.npm-cache')

function fail(message) {
    console.error(`[release-packages] ${message}`)
    process.exit(1)
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd || repoRoot,
        stdio: 'inherit',
        env: {
            ...process.env,
            ...(options.env || {}),
        },
    })

    if (result.status !== 0) {
        fail(`Command failed: ${command} ${args.join(' ')}`)
    }
}

async function readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
}

async function writeJson(filePath, value) {
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 4)}\n`, 'utf8')
}

function parseArgs(argv) {
    const [command = 'help', ...rest] = argv
    const options = {
        dryRun: false,
        skipBuild: false,
        skipCheck: false,
        registry: defaultRegistry,
        tag: defaultTag,
        version: '',
    }

    for (let index = 0; index < rest.length; index += 1) {
        const current = rest[index]

        if (current === '--dry-run') {
            options.dryRun = true
            continue
        }

        if (current === '--skip-build') {
            options.skipBuild = true
            continue
        }

        if (current === '--skip-check') {
            options.skipCheck = true
            continue
        }

        if (current === '--version') {
            options.version = rest[index + 1] || ''
            index += 1
            continue
        }

        if (current === '--registry') {
            options.registry = rest[index + 1] || ''
            index += 1
            continue
        }

        if (current === '--tag') {
            options.tag = rest[index + 1] || ''
            index += 1
            continue
        }

        fail(`Unknown argument: ${current}`)
    }

    return {
        command,
        options,
    }
}

function assertVersion(value) {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)) {
        fail(`Invalid version: "${value}"`)
    }
}

function resolveManifestPath(packageDir) {
    return path.join(repoRoot, packageDir, 'package.json')
}

async function loadReleaseManifests() {
    return Promise.all(releasePackages.map(async (item) => {
        const manifestPath = resolveManifestPath(item.dir)
        const manifest = await readJson(manifestPath)

        return {
            ...item,
            manifestPath,
            manifest,
        }
    }))
}

function syncDependencyVersions(manifest, targetVersion) {
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        const dependencies = manifest[field]
        if (!dependencies || typeof dependencies !== 'object') {
            continue
        }

        for (const dependencyName of Object.keys(dependencies)) {
            if (releasePackageNames.has(dependencyName)) {
                dependencies[dependencyName] = targetVersion
            }
        }
    }
}

async function syncVersions(targetVersion) {
    assertVersion(targetVersion)
    const rootManifest = await readJson(rootManifestPath)
    const manifests = await loadReleaseManifests()

    rootManifest.version = targetVersion
    await writeJson(rootManifestPath, rootManifest)
    console.log(`[release-packages] synced workspace -> ${targetVersion}`)

    for (const item of manifests) {
        item.manifest.version = targetVersion
        syncDependencyVersions(item.manifest, targetVersion)
        await writeJson(item.manifestPath, item.manifest)
        console.log(`[release-packages] synced ${item.name} -> ${targetVersion}`)
    }
}

function validateManifestConsistency(manifests) {
    const versions = new Set(manifests.map((item) => item.manifest.version))

    if (versions.size !== 1) {
        fail(`Release packages must use the same version, found: ${Array.from(versions).join(', ')}`)
    }

    const [targetVersion] = Array.from(versions)

    for (const item of manifests) {
        for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            const dependencies = item.manifest[field]
            if (!dependencies || typeof dependencies !== 'object') {
                continue
            }

            for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
                if (!releasePackageNames.has(dependencyName)) {
                    continue
                }

                if (dependencyVersion !== targetVersion) {
                    fail(`${item.name} has unsynced dependency ${dependencyName}@${dependencyVersion}; expected ${targetVersion}`)
                }
            }
        }
    }

    return targetVersion
}

function runBuild() {
    for (const item of releasePackages) {
        run('pnpm', ['--filter', item.name, 'build'])
    }
}

function runTypeCheck() {
    for (const item of releasePackages) {
        run('pnpm', ['--filter', item.name, 'check:types'])
    }
}

function publishPackages(version, options) {
    console.log(`[release-packages] publishing version ${version}`)
    console.log(`[release-packages] registry: ${options.registry}`)
    console.log(`[release-packages] tag: ${options.tag}`)
    console.log(`[release-packages] dry-run: ${options.dryRun ? 'yes' : 'no'}`)

    for (const item of releasePackages) {
        const args = [
            'publish',
            '--access',
            'public',
            '--tag',
            options.tag,
            '--registry',
            options.registry,
        ]

        if (options.dryRun) {
            args.push('--dry-run')
        }

        run('npm', args, {
            cwd: path.join(repoRoot, item.dir),
            env: {
                npm_config_cache: defaultNpmCache,
            },
        })
    }
}

function printHelp() {
    console.log(`Usage:
  node ./scripts/release-packages.mjs version --version 0.1.0
  node ./scripts/release-packages.mjs check
  node ./scripts/release-packages.mjs publish --version 0.1.0 [--dry-run] [--registry ${defaultRegistry}] [--tag ${defaultTag}]

Commands:
  version  Sync package version and internal dependency versions for the release packages.
  check    Validate versions and run build + type check for the release packages.
  publish  Optionally sync versions, then build/check and publish the release packages in order.
`)
}

async function main() {
    const { command, options } = parseArgs(process.argv.slice(2))

    if (command === 'help' || command === '--help' || command === '-h') {
        printHelp()
        return
    }

    if (command === 'version') {
        if (!options.version) {
            fail('Missing required --version for "version" command.')
        }

        await syncVersions(options.version)
        return
    }

    if (command === 'check') {
        const manifests = await loadReleaseManifests()
        validateManifestConsistency(manifests)
        runBuild()
        runTypeCheck()
        return
    }

    if (command === 'publish') {
        if (options.version) {
            await syncVersions(options.version)
        }

        const manifests = await loadReleaseManifests()
        const targetVersion = validateManifestConsistency(manifests)

        if (!options.skipBuild) {
            runBuild()
        }

        if (!options.skipCheck) {
            runTypeCheck()
        }

        publishPackages(targetVersion, options)
        return
    }

    fail(`Unknown command: ${command}`)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
