# TeeTimeQuest — NPM Package Safety Guide

How to ensure you're never pulling packages published in the last 7 days (or unstable versions), and how to keep the dependency tree reproducible and auditable.

---

## The core rule: pin exact versions, never use `^` or `~`

The current `package.json` uses exact versions with no range operators:

```json
"dependencies": {
  "react": "18.3.1",
  "react-router-dom": "6.28.1"
}
```

**Why this matters:**
- `^18.3.1` means "any 18.x.x" — could pull 18.4.0 released yesterday
- `~18.3.1` means "any 18.3.x" — could pull a patch from this morning
- `18.3.1` (no operator) means exactly that version, always

This is already done in this project. Never add `^` or `~` when adding new packages.

---

## Use `npm ci` instead of `npm install` in CI/CD

```bash
# Development (generates/updates package-lock.json)
npm install

# CI / Vercel builds (uses package-lock.json exactly, fails if it's out of sync)
npm ci
```

Vercel runs `npm install` by default. To force `npm ci`, add to your `package.json`:

```json
"scripts": {
  "vercel-install": "npm ci"
}
```

Then in Vercel dashboard → Settings → Build & Development Settings → Install Command: `npm ci`

---

## Commit `package-lock.json`

This file records the **exact resolved version** of every package and sub-dependency. Committing it means:
- Every developer and every Vercel build installs the exact same tree
- No surprise updates from transitive dependencies

```bash
git add package-lock.json
git commit -m "chore: lock dependencies"
```

Make sure `.gitignore` does **not** include `package-lock.json`.

---

## How to check if a package was published recently

Before installing any new package, check its publish date:

```bash
# Option 1: npm info
npm info <package-name> time.modified

# Option 2: Check the latest version publish date
npm view <package-name> dist-tags.latest
npm view <package-name>@latest time

# Example:
npm info react time.modified
# → Returns the last modified date for the package
```

Or check on npmjs.com — the publish date is shown on the package page.

**Rule of thumb:** if the version you want was published less than 7 days ago, wait or pin an earlier patch.

---

## Installing a new package safely

```bash
# 1. Check what the latest stable version is
npm view <package-name> versions --json | tail -20

# 2. Check when it was published
npm view <package-name> time --json

# 3. Install a specific known-stable version
npm install <package-name>@<specific-version> --save-exact

# The --save-exact flag adds it without ^ or ~ in package.json
```

Example — adding `axios` safely:

```bash
npm view axios versions --json
# pick a version that's at least a week old

npm install axios@1.6.7 --save-exact
```

---

## Audit your dependencies for vulnerabilities

```bash
# Run the built-in npm audit
npm audit

# Fix automatically where safe
npm audit fix

# See which packages are outdated (without updating)
npm outdated
```

---

## Lock file integrity check

Before any deployment, verify the lock file matches `package.json`:

```bash
npm ci --dry-run
```

If this fails, someone changed `package.json` without updating the lock file.

---

## Updating a dependency safely

When you do want to update:

1. Check the changelog for the new version
2. Verify publish date is > 7 days old
3. Update the exact version in `package.json` manually
4. Run `npm install` to regenerate `package-lock.json`
5. Run `npm run build` to verify nothing broke
6. Commit both `package.json` and `package-lock.json`
7. Add the change to `CHANGELOG.md` under the new version

```bash
# Example: updating react from 18.3.1 to 18.3.2
# 1. Manually edit package.json: "react": "18.3.2"
# 2. Then:
npm install
npm run build
git add package.json package-lock.json
git commit -m "chore: update react to 18.3.2"
```

---

## `.npmrc` — enforce exact versions globally

Add this file to the project root to make `npm install <pkg>` always save exact versions:

```
save-exact=true
```

With this in place, you never need `--save-exact` on the command line.

---

## Summary checklist

- [x] All versions in `package.json` are exact (no `^` or `~`)
- [x] `package-lock.json` is committed to Git
- [ ] Add `.npmrc` with `save-exact=true`
- [ ] Set Vercel install command to `npm ci`
- [ ] Run `npm audit` before each release
- [ ] Check publish dates before adding new packages
