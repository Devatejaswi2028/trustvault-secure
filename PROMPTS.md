# PROMPTS.md — TrustVault

## 2026-10-19 — Project Setup
- Reviewed the TrustVault challenge requirements and identified secure document sharing, role-based access, permission management, and audit logging as core features.
- Set up the development environment using Node.js, npm, VS Code, and Git.
- Created and started the application locally.
- Used AI assistance to understand the setup process and resolve environment issues.

## 2026-10-20 — Frontend and Authentication
- Worked on the login and signup experience and connected the application to Supabase authentication.
- Used AI assistance to understand Supabase configuration and environment variables.
- Checked the authentication flow and recorded issues encountered during development.

## 2026-10-21 — Access Control and Sharing
- Tested document sharing and permission-management screens using separate user accounts.
- Reviewed how read access and document-owner permissions should be enforced.
- Used AI assistance to reason about unauthorized access scenarios and testing steps.

## 2026-10-22 — Deployment
- Configured deployment settings and environment variables for the hosted application.
- Checked the deployed application and investigated authentication and runtime issues.
- Used AI assistance to troubleshoot deployment configuration and verify the application manually.

## 2026-10-23 — Permissions Debugging
- Investigated an issue where the People with access section failed to load in the deployed application.
- Reviewed the `listPermissions` server function and the `document_permissions` table schema.
- Removed the reference to the unavailable `updated_at` column from the query.
- Committed and pushed the fix to GitHub.
- Used AI assistance to review the code change and identify the next verification steps.

## 2026-10-24 — Verification and Final Preparation
- Rechecked the deployed Sharing & permissions section.
- Confirmed that three shared-user entries appeared in the deployed interface.
- Used AI assistance to organize final verification, documentation, and submission tasks.

## AI Usage Notes
AI assistance was used for understanding requirements, debugging, reviewing code changes, planning tests, and drafting documentation. Code and behavior must be verified against the actual repository and deployed application before submission.
