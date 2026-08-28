# Production deployment

The GitHub Actions workflow deploys to `usgp1.koi.ci` as `dragonren` and runs the unified service on port 3000.

## Authorize the deploy key

Password authentication is disabled on the server. Add this dedicated public key as one line in `/home/dragonren/.ssh/authorized_keys`:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAd4+GuCGelSBgNg78Nv4TPFRk+2aeUU1LzGPJ7ne8B0 github-actions:jadrens/jadren_web_suit
```

The matching private key exists only in the repository's `SSH_PRIVATE_KEY` Actions secret.

## Enable deployment

After authorizing the key, set the repository variable `DEPLOY_ENABLED` to `true`, then run the **Deploy production** workflow or push to `run`.

The `dragonren` account must have passwordless sudo permission for these commands:

- `systemctl daemon-reload`
- `systemctl enable jadren-web-suit.service`
- `systemctl restart jadren-web-suit.service`
- `install` into `/etc/systemd/system`
