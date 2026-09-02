const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch the whole workspace so edits in packages/* trigger a reload.
config.watchFolders = [workspaceRoot]

// Resolve from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// node-linker=hoisted gives a single hoisted tree, so disabling hierarchical
// lookup stops Metro from picking up duplicate copies of React.
config.resolver.disableHierarchicalLookup = true

// packages/* are NodeNext TypeScript: relative imports carry a `.js` suffix that
// points at a `.ts` source. Node and tsc understand that; Metro does not, so map
// it here instead of stripping the suffixes and breaking the API build.
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3)
    for (const ext of ['.ts', '.tsx']) {
      try {
        return resolve(context, base + ext, platform)
      } catch {
        // fall through to the next candidate
      }
    }
  }
  return resolve(context, moduleName, platform)
}

module.exports = config
