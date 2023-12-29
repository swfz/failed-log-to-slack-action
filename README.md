# Create a GitHub Action Using TypeScript

[![GitHub Super-Linter](https://github.com/actions/failed-log-slack-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/failed-log-slack-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/failed-log-slack-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/failed-log-slack-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/failed-log-slack-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/failed-log-slack-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

## Usage

### call by workflow configuration

- .github/workflows/xxxxx.yml

```yaml
name: ci

on: [push]

jobs:
  test:
  .....
  .....

  slack-notify:
    if: always()
    needs: [test]
    name: post slack
    runs-on: ubuntu-latest
    steps:
      - uses: swfz/failed-log-to-slack-action@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### call by workflow_run trigger

- .github/workflows/slack.yml

```yaml
name: slack notification

on:
  workflow_run:
    workflows:
      - ci
      - analysis
    types:
      - completed
jobs:
  main:
    name: main
    runs-on: ubuntu-latest
    steps:
      - uses: swfz/failed-log-to-slack-action@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

`ci`,`analysis` is other workflow name

run this workflow is there workflow completed

## Development

Enter the actual values you want to use.

```shell
export INPUT_GITHUB_TOKEN=xxxxx
export SLACK_WEBHOOK_URL=xxxxx

source script/dev_env.sh https://github.com/{owner}/{repo}/actions/runs/{run_id}
```

required `gh` command

Pass the URL of the GitHub Workflow execution result to the script

and set the environment variables necessary for development.

### simple execution

```shell
ts-node src/index.ts
```
