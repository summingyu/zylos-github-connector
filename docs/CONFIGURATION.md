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
| `port` | integer | No | `3461` | TCP port for the HTTP server. The server listens on `0.0.0.0:{port}`. |
| `webhookSecret` | string | **Yes** | `""` | GitHub webhook secret for HMAC-SHA256 signature verification. **Required for secure operation.** |
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
| `logging.level` | string | No | `"info"` | Log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `logging.pretty` | boolean | No | `true` | Enable pretty-printed console output via pino-pretty. Set to `false` for JSON-only logs. |

## Environment Variables

Environment variables override configuration file values:

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `GITHUB_WEBHOOK_SECRET` | `webhookSecret` | GitHub webhook secret. Takes precedence over the config file value. |

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
  "webhookSecret": "production-webhook-secret",
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

- **`webhookSecret` is missing or empty:** All webhook signature verification attempts will fail, returning `500` errors. The connector logs repeated warnings at startup.

### Validation Rules

1. **Port Range:** The port must be a valid TCP port (1-65535). If invalid, the connector defaults to `3461`.
2. **Log Level:** Must be one of: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. Invalid values default to `info`.
3. **Payload Size:** Must match the pattern `<number><unit>` (e.g., `10mb`, `1024kb`). Invalid values default to `10mb`.

## Hot Reload

The connector automatically watches its configuration file for changes and reloads without requiring a restart:

### How It Works

1. The `fs.watch()` API monitors `~/zylos/components/github-connector/config.json`
2. On file change, the configuration is reloaded immediately
3. All subsequent webhook requests use the new configuration
4. If `enabled` is set to `false`, the server initiates graceful shutdown

### What Gets Reloaded

- Webhook secret (affects signature verification for new requests)
- Port changes (require server restart to take effect)
- Log level (applies immediately)
- Communication bridge settings (applies to new requests)
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

**Warning:** The default `webhookSecret` is empty, which causes all webhook signature verification to fail. You must provide a secret value either via config file or environment variable.

## Per-Environment Configuration

### Development

For local development, use environment variables:

```bash
export GITHUB_WEBHOOK_SECRET="local-dev-secret"
npm start
```

Or create a development config file:

```json
{
  "port": 3461,
  "webhookSecret": "local-dev-secret",
  "logging": {
    "level": "debug"
  }
}
```

### Production

For production, use environment variables via your process manager or container orchestration:

```bash
export GITHUB_WEBHOOK_SECRET="<strong-random-secret>"
export PORT=3461  # Optional: override default port
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
  "webhookSecret": "ghp_example_secret_key_from_github",
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

**Solution:** Set the secret in config.json or via the `GITHUB_WEBHOOK_SECRET` environment variable. Obtain the secret from your GitHub webhook configuration settings.

### Port Already in Use

**Problem:** Server fails to start with "EADDRINUSE" error.

**Solution:** Either:
1. Change the `port` value in config.json
2. Stop the process using port 3461
3. Use a different port via environment-specific configuration

### Configuration Changes Not Taking Effect

**Problem:** Modified config.json but changes appear ignored.

**Solution:** 
- For port or payload size changes: restart the server process
- For other changes: verify the file was saved to `~/zylos/components/github-connector/config.json` (not the project directory)

## Security Considerations

1. **File Permissions:** Ensure `~/zylos/components/github-connector/config.json` is readable only by the connector process user (`chmod 600` recommended).
2. **Secret Storage:** Never commit the actual `webhookSecret` value to version control. Use environment variables in production.
3. **Secret Rotation:** To rotate the webhook secret:
   - Generate a new secret in GitHub webhook settings
   - Update the connector configuration (file or environment variable)
   - The hot reload feature applies the new secret immediately
   - Old webhooks will fail verification until GitHub updates to the new secret

## Related Documentation

- [README.md](../README.md) - Installation and GitHub webhook setup
- [GETTING-STARTED.md](GETTING-STARTED.md) - First-time setup guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment configuration
