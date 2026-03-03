#!/usr/bin/env bash

export GH_TOKEN="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"
USERNAME="fanik041"

while read -r repo; do
  [ -z "$repo" ] && continue
  gh repo delete "$USERNAME/$repo" --confirm
done < repo.txt
