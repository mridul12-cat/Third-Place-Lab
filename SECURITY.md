# Security

Keep Qloo and Turso credentials in an ignored local environment or the host's server-side encrypted secret store. Never paste credentials, raw upstream responses, environment dumps, or signed access links into issues, screenshots, or logs.

If a credential is exposed, revoke it through the provider and replace the server secret. Removing a commit alone does not revoke a leaked credential. Use the production live kill switch and redeploy while investigating quota abuse.

For private reports, use the repository's private vulnerability reporting feature after its owner enables it. Until that channel is configured, contact the repository owner privately; do not disclose sensitive details in a public issue.

The public app has no user accounts or authorization boundary. Origin checks and per-isolate limits reduce incidental abuse; the shared production allowance caps outgoing Qloo attempts, including retries. Anonymous users can exhaust that allowance and temporarily deny research to others. The host must preserve its durable budget database (Turso for native Next.js; D1 for Sites rollback) and avoid deploying duplicate production budgets against the same API key.

All live application runs, including local development, require the budget guard and release switch. Preview deployments must remain mock and receive no production credentials. Configured origins are server-owned; arbitrary forwarded hosts and Cloudflare IP headers are not trusted by native Vercel code.

See docs/native-next-migration.md and docs/release-checklist.md for deployment controls and rollback. No security contact endpoint or private reporting channel has been created by this preparation.
