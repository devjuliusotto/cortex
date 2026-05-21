# Security Policy

## Supported Versions

Cortex is pre-1.0 software. Security fixes are handled on the latest main branch and on tagged releases when practical.

## Local Data

Cortex v0.1 stores workspace, session, layout, profile, and window metadata locally on the user's machine. It does not send this data to a server.

Do not commit local databases, JSON state files, exported user state, logs containing private paths, generated app data, or build artifacts.

## Secrets

Do not commit secrets, API keys, tokens, signing certificates, passwords, private URLs, personal email addresses, usernames, or machine-specific paths.

Use `.env.example` for documented placeholder configuration only. Real `.env` files are ignored by Git and must remain local.

## Network And Telemetry

Cortex v0.1 has no telemetry, analytics, tracking, cloud sync, or external API calls.

Any future networked integration must be opt-in, configurable, documented, and disabled by default.

## Windows Builds

Release builds are currently unsigned. Unsigned Windows installers or executables may trigger Microsoft SmartScreen warnings. Do not add signing certificates or private signing credentials to this repository.

## Reporting Issues

If you find a vulnerability, do not publish exploit details before maintainers have had time to respond.

Prefer GitHub Security Advisories if they are enabled for the repository. If not, open a minimal public issue stating that you have a security report and need a private contact path.
