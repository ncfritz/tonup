# Ton Up

An iOS darts app for scoring games, practice and learning the rules, with camera scoring to follow. Built with Expo; all data stays on the device. Website: [tonup.app](https://tonup.app).

- Docs: [docs/README.md](docs/README.md) (features, research, decisions, design)
- Status: M0 (scaffold) in progress; see the [v1 implementation plan](docs/plan/v1-implementation.md).

## Run it

Needs Node 22, pnpm 10 and Xcode on a Mac.

```sh
pnpm install
pnpm ios          # builds the dev client and runs it on the simulator or a connected iPhone
pnpm start        # Metro only, once the dev client is installed
pnpm check        # typecheck, lint, tests and the contrast check
```
