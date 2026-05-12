<!-- generated-by: gsd-doc-writer -->
# Configuration

This document describes all configuration options for the Zylos GitHub Connector.

## Configuration File Location

The connector loads its configuration from:

```
~/zylos/components/github-connector/config.json
```

The configuration directory is automatically created during installation. If the configuration file does not exist, the connector will use default values and log warnings for missing required settings.

## Configuration Options

### Top-Level Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `enabled` | boolean | No | `true` | Master switch to enable/disable the connector. When `false`, the server exits immediately. |
| `port` | integer | No | `3461` | TCP port for the HTTP server. The server listens on `0.0.0.0:{port}`. Must be between 1-65535. |
| `webhookSecret` | string | **Yes** | `""` | GitHub webhook secret for HMAC-SHA256 signature verification. Must be at least 16 characters long. **Required for secure operation.** |
| `maxPayloadSize` | string | No | `"10mb"` | Maximum webhook payload size. Supports format: `10mb`, `1024kb`, `1048576` (bytes). |
| `commBridge` | object | No | See below | Communication bridge configuration for forwarding webhook events. |
| `logging` | object | No | See below | Logging configuration. |
| `settings` | object | No | `{}` | Custom application settings (reserved for future use). |

### Communication Bridge Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `commBridge.enabled` | boolean | No | `true` | Enable/disable message forwarding through the C4 communication bridge. |
| `commBridge.defaultEndpoint` | string | No | `"default"` | Default endpoint name for routed messages. |

### Logging Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `logging.level` | string | No | `"info"` | Log level: `error`, `warn`, `info`, `debug`. |
| `logging.pretty` | boolean | No | `true` | Enable pretty-printed console output via pino-pretty. Set to `false` for JSON-only logs. |

## Environment Variables

Environment variables override configuration file values:

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `GITHUB_WEBHOOK_SECRET` | `webhookSecret` | GitHub webhook secret. Takes precedence over the config file value. Must be at least 16 characters long. |

**Security Best Practice:** Use environment variables for sensitive values like webhook secrets in production deployments.

## Minimal Configuration Example

```json
{
  "webhookSecret": "your-github-connector-secret-here"
}
```

All other options use sensible defaults. For production use, also specify explicit values for:

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "production-webhook-secret-at-least-16-chars",
  "maxPayloadSize": "10mb",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "default"
  },
  "logging": {
    "level": "info",
    "pretty": false
  }
}
```

## Configuration Validation

### Required Settings

The connector validates configuration on startup and will fail with clear error messages if:

- **`webhookSecret` is missing or empty:** All webhook signature verification attempts will fail. The connector logs repeated warnings at startup.
- **`webhookSecret` is too short:** Must be at least 16 characters long for security reasons.

### Validation Rules

1. **Port Range:** The port must be a valid TCP port (1-65535). If invalid or out of range, validation fails with an error.
2. **Log Level:** Must be one of: `error`, `warn`, `info`, `debug`. Invalid values cause validation to fail.
3. **Webhook Secret Length:** Must be at least 16 characters if provided. Empty strings are allowed but will cause signature verification to fail.
4. **Type Safety:** All configuration values must match their expected types (boolean, string, number, object).

## Hot Reload

The connector automatically watches its configuration file for changes and reloads without requiring a restart:

### How It Works

1. The `fs.watch()` API monitors `~/zylos/components/github-connector/config.json`
2. On file change, the configuration is reloaded with 500ms debounce
3. All subsequent webhook requests use the new configuration
4. If `enabled` is set to `false`, the server initiates graceful shutdown

### What Gets Reloaded

- Webhook secret (affects signature verification for new requests)
- Log level (applies immediately)
- Communication bridge settings (applied to new requests)
- `enabled` flag (triggers shutdown if set to `false`)

### What Does NOT Get Reloaded

- **Port changes:** Require a full server restart (stop and start the process)
- **Max payload size:** Requires server restart (Fastify body limit is set at startup)

## Default Configuration

When no configuration file exists, the connector uses these defaults:

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "",
  "maxPayloadSize": "10mb",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "default"
  },
  "logging": {
    "level": "info",
    "pretty": true
  },
  "settings": {}
}
```

**Warning:** The default `webhookSecret` is empty, which causes all webhook signature verification to fail. You must provide a secret value (at least 16 characters) either via config file or environment variable.

## Per-Environment Configuration

### Development

For local development, use environment variables:

```bash
export GITHUB_WEBHOOK_SECRET="local-dev-secret-at-least-16-chars"
npm start
```

Or create a development config file:

```json
{
  "port": 3461,
  "webhookSecret": "local-dev-secret-at-least-16-chars",
  "logging": {
    "level": "debug"
  }
}
```

### Production

For production, use environment variables via your process manager or container orchestration:

```bash
export GITHUB_WEBHOOK_SECRET="<strong-random-secret-at-least-16-chars>"
```

**Do not commit production secrets to version control.**

## Configuration File Format

- **Format:** JSON
- **Encoding:** UTF-8
- **File name:** `config.json`
- **Location:** `~/zylos/components/github-connector/config.json`

Example complete configuration:

```json
{
  "enabled": true,
  "port": 3461,
  "webhookSecret": "ghp_example_secret_key_from_github_at_least_16",
  "maxPayloadSize": "10mb",
  "commBridge": {
    "enabled": true,
    "defaultEndpoint": "production"
  },
  "logging": {
    "level": "info",
    "pretty": false
  },
  "settings": {
    "customProperty": "value"
  }
}
```

## Troubleshooting Configuration

### "Webhook secret not configured" Warning

**Problem:** Startup logs show warnings about missing `webhookSecret`.

**Solution:** Set the secret in config.json or via the `GITHUB_WEBHOOK_SECRET` environment variable. Obtain the secret from your GitHub webhook configuration settings. Ensure the secret is at least 16 characters long.

### Port Already in Use

**Problem:** Server fails to start with "EADDRINUSE" error.

**Solution:** Either:
1. Change the `port` value in config.json
2. Stop the process using port 3461
3. Use a different port via environment-specific configuration

### Configuration Validation Errors

**Problem:** Server exits with validation error messages.

**Solution:** Check the error message for specific validation failures:
- **Port out of range:** Use a value between 1-65535
- **Invalid log level:** Use one of `error`, `warn`, `info`, `debug`
- **Secret too short:** Ensure webhook secret is at least 16 characters
- **Type mismatch:** Verify boolean fields are `true`/`false`, not strings

### Configuration Changes Not Taking Effect

**Problem:** Modified config.json but changes appear ignored.

**Solution:** 
- For port or payload size changes: restart the server process
- For other changes: verify the file was saved to `~/zylos/components/github-connector/config.json` (not the project directory)
- Check logs for configuration reload confirmation messages

## Security Considerations

1. **File Permissions:** Ensure `~/zylos/components/github-connector/config.json` is readable only by the connector process user (`chmod 600` recommended).
2. **Secret Storage:** Never commit the actual `webhookSecret` value to version control. Use environment variables in production.
3. **Secret Length:** Always use webhook secrets that are at least 16 characters long to meet validation requirements.
4. **Secret Rotation:** To rotate the webhook secret:
   - Generate a new secret in GitHub webhook settings (ensure it's at least 16 characters)
   - Update the connector configuration (file or environment variable)
   - The hot reload feature applies the new secret immediately
   - Old webhooks will fail verification until GitHub updates to the new secret

## Configuration via Zylos CLI

When using the Zylos component management system, configuration can be automated through the `hooks/configure.js` script:

1. The Zylos CLI collects required configuration values (defined in `SKILL.md`)
2. Values are passed to the configure hook via stdin as JSON
3. The hook writes the configuration to `~/zylos/components/github-connector/config.json`
4. Environment variable prefix: `GITHUB_WEBHOOK_*` (mapped to config keys)

Example configure input:
```json
{
  "GITHUB_WEBHOOK_SECRET": "your-secret-here-at-least-16-chars"
}
```

## Related Documentation

- [README.md](../README.md) - Installation and GitHub webhook setup
- [GETTING-STARTED.md](GETTING-STARTED.md) - First-time setup guide
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development environment configuration
