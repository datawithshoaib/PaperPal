# Security notes

- **Authentication.** The API accepts two token kinds. Supabase access tokens are verified for signature, expiry, audience (`authenticated`), and issuer (`<SUPABASE_URL>/auth/v1`), using JWKS for asymmetric keys or `SUPABASE_JWT_SECRET` for legacy HS256. Demo tokens are HS256 tokens with a distinct issuer signed by `AUTH_SECRET`. Disable the demo account with `DEMO_ENABLED=false` and set a unique `AUTH_SECRET` outside local development.
- **Authorization.** Every paper, job, conversation, PDF, and feedback lookup is filtered by the token's user ID. Another user's resources return 404.
- **Uploads.** Content type and `%PDF-` magic bytes are checked, size is capped (`MAX_UPLOAD_BYTES`, default 25 MB), page count is capped, and PDFs are stored under server-generated names. arXiv downloads are streamed with the same cap.
- **Prompt injection.** Paper text is treated as untrusted data in the prompts. Models cannot choose what a citation points to: IDs are validated against the evidence actually retrieved, and unresolved markers are removed.
- **Output rendering.** Chat and analysis text is rendered as Markdown with no raw HTML. External links use `rel="noopener noreferrer"`.
- **Secrets.** `GROQ_API_KEY`, `SUPABASE_JWT_SECRET`, and `AUTH_SECRET` exist only on the API. The browser receives the Supabase URL and anon key, which are designed to be public.
- **Known gaps.** No per-user rate limits or quotas, no malware scanning of uploads, and the demo account shares one data set between everyone who uses it.
