#!/bin/sh
# Usage: prep-pr.sh <branch>. Strips .pr-body.md (and .review-fixes.md/.done/.go/.mockup: handoff files never reach main), merges main, pushes; writes the body to $S/body-<branch>.md and prints the new head.
S=/tmp/claude-0/-home-user-chessroyale/37426f64-a77b-5541-afaa-1847c6a1f530/scratchpad
b=$1; w=$S/wt-$b
cd /home/user/chessroyale && git fetch -q origin "$b" main && rm -rf "$w" && git worktree prune && git worktree add -q "$w" "origin/$b" 2>/dev/null
cd "$w" && git checkout -q -B "$b" && git show HEAD:.pr-body.md | sed 's#session_01EKH5j59nMnRVnekEcuZbim#session_01JuCWRuPpvjpkJLcU3sM3cR#' > "$S/body-$(echo $b | tr / -).md"
for f in .pr-body.md .review-fixes.md .done .go .mockup; do git cat-file -e HEAD:$f 2>/dev/null && git rm -q $f; done
git commit -qm "Drop the PR body file

Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR"
if ! git merge -q --no-edit origin/main >/dev/null 2>&1; then echo "MERGE CONFLICT with main (nothing pushed past the body drop): $(git diff --name-only --diff-filter=U | tr '\n' ' ')"; git merge --abort; git push -q origin "$b"; cd /home/user/chessroyale && git worktree remove --force "$w"; exit 2; fi
git push -q origin "$b" && git rev-parse HEAD
cd /home/user/chessroyale && git worktree remove --force "$w"
