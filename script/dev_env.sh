#!/bin/bash

# Usage
# source script/dev_env.sh https://github.com/{owner}/{repo}/actions/runs/{run_id}
# extract repo and run_id from url
# and set env vars for github actions

url=$1
repo=$(echo "${url}" | grep --color=no -oP 'github.com/\K[^/]+/[^/]+')
run_id=$(echo "${url}" | grep --color=no -oP 'runs/\K\d+')

res=$(gh run view -R "${repo}" "${run_id}" --json=event)

export GITHUB_REPOSITORY=${repo}
export GITHUB_RUN_ID=${run_id}
export GITHUB_EVENT_NAME=$(echo "${res}" | jq -r '.event')
