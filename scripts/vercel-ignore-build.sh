#!/usr/bin/env bash
# Vercel's Ignored Build Step: decide whether a push is worth a deployment.
#
# Exit 1 = build, exit 0 = skip. That is Vercel's convention and it reads backwards, so it
# is stated once here and every exit below says which it means.
#
# Why this exists
# ---------------
# The site is static and every generated file is committed, so a deployment is only ever
# worth doing when something that is actually served changed. A README edit, a tweak to
# the build scripts, a CI workflow change: none of those alter a single byte the CDN hands
# out, and each one otherwise costs a full deploy.
#
# The exclude list is the deploy-time twin of .vercelignore, and the two are kept in sync
# by hand for the same reason .vercelignore exists at all: what is not served should not
# trigger a rebuild of what is.
#
# Two things that look excludable are deliberately not. .vercelignore decides which files
# reach the CDN at all, so a commit that touches only that file changes the deployment
# even though it changes no page: skipping it would leave the edit with no way to take
# effect. This script is the same argument one level up, and it lives under scripts/,
# which is otherwise excluded. Both are re-included below as positive pathspecs.
#
# Hence `scripts/*.py` rather than `scripts`: a broader exclude wins over a narrower
# positive pathspec, so excluding the directory would swallow this file's own re-inclusion
# and a fix to the skip logic would skip its own deployment. Every other file in scripts/
# is Python, so the toolchain is still fully covered.
set -euo pipefail

# A shallow clone with no parent (the first deployment, or a fetch depth of 1) has nothing
# to diff against. Build: never skip on missing information.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "No parent commit, building."
  exit 1
fi

CHANGED=$(git diff --name-only HEAD^ HEAD -- . \
  ':(exclude)scripts/*.py' ':(exclude).github' ':(exclude)docs' \
  ':(exclude)*.md' ':(exclude)**/*.md' \
  ':(exclude)LICENSE' ':(exclude)CITATION.cff' \
  ':(exclude).gitignore' ':(exclude).gitattributes' \
  ':(exclude)favicon.ico' ':(exclude)apple-touch-icon.png' \
  '.vercelignore' 'scripts/vercel-ignore-build.sh')

if [ -z "$CHANGED" ]; then
  echo "Only docs/icons changed, skipping."
  exit 0
fi

echo "Building for:"
echo "$CHANGED"
exit 1
