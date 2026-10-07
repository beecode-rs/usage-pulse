# Releasing

Releases are tag-driven. From `main` (after merging what you want to ship):

```bash
pnpm release:patch   # or release:minor / release:major
```

That bumps `package.json`, commits, tags `v<version>`, and pushes. GitHub Actions then runs the quality gate (typecheck, lint, contract tests), builds the macOS and Linux installers — failing if the tag does not match the package version — and publishes them to the [Releases](https://github.com/beecode-rs/usage-pulse/releases) page with auto-generated notes. The workflow can also be run manually ("Run workflow") as a dry run that builds everything without creating a release.
