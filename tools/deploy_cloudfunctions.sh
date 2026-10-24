#!/usr/bin/env bash
# 通过微信开发者工具官方 CLI 部署全部云函数（带重试）
# 用法: bash tools/deploy_cloudfunctions.sh
set -u

CLI="E:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat"
PROJ="E:/移通工作/26-27上/微信小程序-三纲/demo/jk"
PORT=13641
ENV_ID="cloud1-d5gr2v7tz34fafa7c"
LOGDIR="$PROJ/tools/logs"
mkdir -p "$LOGDIR"

FUNCS=(auth user learn contest announce social agent)

for fn in "${FUNCS[@]}"; do
  ok=0
  for attempt in 1 2 3; do
    echo ">>> deploy $fn (attempt $attempt)"
    "$CLI" cloud functions deploy \
      --project "$PROJ" --port "$PORT" --lang zh \
      --env "$ENV_ID" --names "$fn" --remote-npm-install \
      > "$LOGDIR/$fn.attempt$attempt.log" 2>&1
    if grep -q '"success"[[:space:]]*│[[:space:]]*true' "$LOGDIR/$fn.attempt$attempt.log" \
       || grep -q "success" "$LOGDIR/$fn.attempt$attempt.log"; then
      # 再次确认没有 error
      if ! grep -q "部署失败" "$LOGDIR/$fn.attempt$attempt.log"; then
        echo "    OK $fn"
        ok=1
        break
      fi
    fi
    echo "    retry $fn"
    sleep 8
  done
  if [ "$ok" -eq 0 ]; then
    echo "    FAIL $fn (see $LOGDIR/$fn.attempt3.log)"
  fi
done

echo "=== ALL DONE ==="
