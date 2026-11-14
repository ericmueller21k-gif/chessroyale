# Usage: wait-any.sh <branch>... : waits until any listed branch has .done (or a review branch exists); prints which.
# Each branch is fetched into its own ref (refs/watch/<branch>), never FETCH_HEAD: several watchers run at once in this
# checkout, and a shared FETCH_HEAD let one watcher read another's branch (Nov 14: a false DONE for claude/music-clean).
cd /home/user/chessroyale
while :; do
  for b in "$@"; do
    r="refs/watch/$b"
    if git fetch -q origin "+$b:$r" 2>/dev/null; then
      case "$b" in review/*) echo "DONE $b $(git rev-parse --short=8 "$r")"; exit 0;; esac
      git cat-file -e "$r:.done" 2>/dev/null && { echo "DONE $b $(git rev-parse --short=8 "$r")"; exit 0; }
    fi
  done
  sleep 60
done
