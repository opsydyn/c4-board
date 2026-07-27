# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.17](https://github.com/opsydyn/c4-board/compare/v0.0.16...v0.0.17) - 2026-07-27

### Other

- mark app changes outside src-tauri as releasable [skip ci]

## [0.0.16](https://github.com/opsydyn/c4-board/compare/v0.0.15...v0.0.16) - 2026-07-27

### Other

- mark the save cue fix as a releasable app change

## [0.0.15](https://github.com/opsydyn/c4-board/compare/v0.0.14...v0.0.15) - 2026-07-27

### Added

- report load test results by status, and let the test decide what passes
- stop discarding the latency of failed requests

### Other

- apply rustfmt to the load test changes

## [0.0.14](https://github.com/opsydyn/c4-board/compare/v0.0.13...v0.0.14) - 2026-07-26

### Added

- classify Azure resources by type and connect container apps

## [0.0.13](https://github.com/opsydyn/c4-board/compare/v0.0.12...v0.0.13) - 2026-07-26

### Other

- mark the canvas chrome fix as a releasable app change

## [0.0.12](https://github.com/opsydyn/c4-board/compare/v0.0.11...v0.0.12) - 2026-07-26

### Fixed

- publish releases again, and fix the bug that was blocking them

## [0.0.11](https://github.com/opsydyn/c4-board/compare/v0.0.10...v0.0.11) - 2026-07-26

### Added

- add the Big Picture Event Storming vocabulary
- widen the diagram domain to admit Event Storming

## [0.0.10](https://github.com/opsydyn/c4-board/compare/v0.0.9...v0.0.10) - 2026-07-26

### Other

- update Cargo.lock dependencies

## [0.0.9](https://github.com/opsydyn/c4-board/compare/v0.0.8...v0.0.9) - 2026-07-26

### Added

- publish releases only once every platform has uploaded

## [0.0.8](https://github.com/opsydyn/c4-board/compare/v0.0.7...v0.0.8) - 2026-07-25

### Added

- record Postee agent runs and proposals
- let the Postee agent diagnose failures from history
- propose Postee requests as scratch drafts
- ground the Postee agent in collections and the cached GraphQL schema
- add Postee read tools to the agent runtime

### Fixed

- satisfy clippy's unnecessary_sort_by in the history tool

### Other

- format the Rust added this session

## [0.0.7](https://github.com/opsydyn/c4-board/compare/v0.0.6...v0.0.7) - 2026-07-25

### Other

- generate release notes from commit history
