cd /home/user/chessroyale
until git fetch -q origin review/hidden-challenge 2>/dev/null; do sleep 60; done
echo DONE; git show FETCH_HEAD:review.md
