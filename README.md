# Railway n8n Single Service

This deployment runs three processes in one Railway service:

- n8n, exposed on Railway's public `PORT`
- question image renderer on `127.0.0.1:3010`
- terms multi-image renderer on `127.0.0.1:3020`

The long renderer on port `3030` is intentionally excluded.

## Railway Variables

Set these on the Railway service:

```env
WEBHOOK_URL=https://your-n8n-domain.up.railway.app/
GENERIC_TIMEZONE=Asia/Shanghai
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
N8N_ENCRYPTION_KEY=<choose one existing key, or create and keep a new 32+ char key>
ELEVENLABS_API_KEY=<your ElevenLabs API key>
META_ACCESS_TOKEN=<your Meta Graph API token for Instagram publishing>
FEISHU_BOT_WEBHOOK_URL=<your Feishu bot webhook URL>
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Attach a Railway volume at:

```text
/home/node/.n8n
```

## Import

Patched workflow imports are bundled at `/app/imports/`.

Import workflows:

```bash
import-workflows.sh
```

Credentials are intentionally not included in this repository. Recreate them in the n8n UI after importing workflows.
