#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${BLOG_STUDIO_REPO:-/Users/tky/Desktop/blog}"
SOURCE="${BLOG_SYNC_SOURCE:-manual}"
BRANCH="${BLOG_SYNC_BRANCH:-}"
ACTION="${1:-sync}"
DEFAULT_PATHS=(
  "src/content"
  "public"
  "site.config.mjs"
)

case "$ACTION" in
  sync|push)
    ;;
  *)
    echo "Usage: $0 [sync|push]" >&2
    exit 2
    ;;
esac

if [ ! -d "$REPO/.git" ]; then
  echo "Not a git repository: $REPO" >&2
  exit 1
fi

cd "$REPO"

git_operation_in_progress() {
  for marker in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
    if [ -e "$(git rev-parse --git-path "$marker")" ]; then
      return 0
    fi
  done

  for state_dir in rebase-merge rebase-apply sequencer; do
    if [ -d "$(git rev-parse --git-path "$state_dir")" ]; then
      return 0
    fi
  done

  [ -n "$(git diff --name-only --diff-filter=U)" ]
}

if git_operation_in_progress; then
  echo "A Git operation or unresolved conflict is already in progress. Finish or abort it before syncing." >&2
  exit 1
fi

BRANCH="${BRANCH:-$(git branch --show-current)}"
if [ -z "$BRANCH" ]; then
  echo "Refusing to sync: repository is in detached HEAD state." >&2
  exit 1
fi

LOCK_DIR="${TMPDIR:-/tmp}/blog-studio-sync.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  if [ -n "${BLOG_SYNC_FORCE_UNLOCK:-}" ]; then
    rm -rf "$LOCK_DIR"
    mkdir "$LOCK_DIR"
  else
    echo "Another sync is already running. Remove $LOCK_DIR if that is stale." >&2
    exit 1
  fi
fi
trap 'rm -rf "$LOCK_DIR"' EXIT

echo "=== MyBlog sync ==="
echo "source:    $SOURCE"
echo "repo:      $REPO"
echo "branch:    $BRANCH"
echo "action:    $ACTION"
echo "paths:     ${DEFAULT_PATHS[*]}"
echo "time:      $(date '+%Y-%m-%d %H:%M:%S %Z')"

is_draft_frontmatter() {
  awk '
    NR == 1 && $0 ~ /^---[[:space:]]*$/ { in_frontmatter = 1; next }
    in_frontmatter && $0 ~ /^---[[:space:]]*$/ { exit }
    in_frontmatter && $0 ~ /(^|[,{[:space:]])draft[[:space:]]*:[[:space:]]*true([[:space:],}]|$)/ { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "$1"
}

draft_excludes=()
draft_path_seen='|'
while IFS= read -r -d '' path; do
  case "$path" in
    *.md|*.mdx)
      case "$draft_path_seen" in
        *"|$path|"*) continue ;;
      esac
      if [ -f "$path" ]; then
        is_draft_frontmatter "$path" || continue
      else
        git show "HEAD:$path" 2>/dev/null | is_draft_frontmatter /dev/stdin || continue
      fi
      draft_path_seen+="$path|"
      draft_excludes+=(":(exclude)$path")
      draft_excludes+=(":(exclude)${path%.md}-assets/**")
      draft_excludes+=(":(exclude)${path%.mdx}-assets/**")
      ;;
  esac
done < <(git ls-files -z --cached --others --exclude-standard -- src/content)

stage_paths=()
for path in "${DEFAULT_PATHS[@]}"; do
  if [ -e "$path" ] || [ -n "$(git ls-files -- "$path")" ]; then
    stage_paths+=("$path")
  fi
done

if [ "${#draft_excludes[@]}" -gt 0 ]; then
  echo "excluding draft content:"
  for exclude in "${draft_excludes[@]}"; do
    case "$exclude" in
      ':(exclude)'*-assets/**) ;;
      *) echo "  ${exclude#\:\(exclude\)}" ;;
    esac
  done
fi

if [ "$ACTION" = "sync" ]; then
  changed_paths=()
  while IFS= read -r path; do
    [ -n "$path" ] && changed_paths+=("$path")
  done < <(git status --porcelain=v1 --untracked-files=all -- "${stage_paths[@]}")

  if [ "${#changed_paths[@]}" -eq 0 ]; then
    echo "No changes under the configured paths."
  else
    stage_args=(-- "${stage_paths[@]}" "${draft_excludes[@]}")
    git add "${stage_args[@]}"
    commit_paths=()
    while IFS= read -r -d '' path; do
      [ -n "$path" ] && commit_paths+=("$path")
    done < <(git diff --cached --name-only -z -- "${stage_paths[@]}" "${draft_excludes[@]}")

    if [ "${#commit_paths[@]}" -eq 0 ]; then
      echo "No publishable changes to commit (draft content is excluded)."
    else
      commit_message="content: local studio sync $(date '+%F')"
      echo "Writing commit: $commit_message"
      git commit -m "$commit_message" -- "${commit_paths[@]}"
    fi
  fi
  echo "Sync complete. Use Push to GitHub when you are ready to publish local commits."
  exit 0
fi

if ! git fetch origin "$BRANCH" --quiet; then
  echo "Could not fetch origin/$BRANCH. Check network or SSH credentials." >&2
  exit 1
fi

echo "Synchronizing with origin/$BRANCH..."
if ! git merge --no-edit "origin/$BRANCH"; then
  if git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    if ! git merge --abort; then
      echo "Merge failed and could not be rolled back automatically." >&2
      exit 1
    fi
  fi
  echo "Could not merge origin/$BRANCH. Resolve the remote changes and push again." >&2
  exit 1
fi

if [ "$(git rev-list --count "origin/$BRANCH..HEAD")" != "0" ]; then
  echo "Pushing to origin/$BRANCH..."
  git push origin "$BRANCH"
else
  echo "No commits to push."
fi

echo "Push complete."
