import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const packageJsonPath = new URL('../package.json', import.meta.url)

const bumpLevels = ['major', 'minor', 'patch']

const bumpVersion = (version, level) => {
  const parts = version.split('.').map(Number)
  if (
    parts.length !== 3 ||
    parts.some((part) => {
      return Number.isNaN(part)
    })
  ) {
    return undefined
  }
  if (level === 'major') {
    return `${parts[0] + 1}.0.0`
  }
  if (level === 'minor') {
    return `${parts[0]}.${parts[1] + 1}.0`
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}

const resolvePushRemote = () => {
  const remotes = execSync('git remote', { encoding: 'utf8' }).split('\n')
  return remotes.includes('github') ? 'github' : 'origin'
}

const assertCleanWorkTree = () => {
  const status = execSync('git status --porcelain', { encoding: 'utf8' })
  if (status.trim() !== '') {
    console.error('working tree is not clean — commit or stash before releasing')
    process.exit(1)
  }
}

const level = process.argv[2]

if (!bumpLevels.includes(level)) {
  console.error('Usage: node ./scripts/release.mjs <major|minor|patch>')
  process.exit(1)
}

assertCleanWorkTree()

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const nextVersion = bumpVersion(packageJson.version, level)

if (nextVersion === undefined) {
  console.error(`cannot bump invalid version "${packageJson.version}" in package.json`)
  process.exit(1)
}

packageJson.version = nextVersion

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`)

const pushRemote = resolvePushRemote()

execSync('git add package.json', { stdio: 'inherit' })
execSync(`git commit -m "chore: release v${nextVersion}"`, { stdio: 'inherit' })
execSync(`git tag -a v${nextVersion} -m "v${nextVersion}"`, { stdio: 'inherit' })
execSync(`git push ${pushRemote} HEAD --follow-tags`, { stdio: 'inherit' })

console.log(`released v${nextVersion} (pushed to "${pushRemote}")`)
