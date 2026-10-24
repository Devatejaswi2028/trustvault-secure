# TrustVault Secure

**Secure Document Sharing with Access Control and Auditability**

TrustVault Secure is a document-sharing application designed to help users manage documents and control access through permissions. It focuses on document ownership, authorized sharing, and protecting documents from unauthorized operations.

## Project Overview

Sharing documents securely requires more than a login page. Each user should only be able to access documents and perform actions they are authorized to perform.

TrustVault uses authentication, document-level permissions, server-side authorization, and Supabase to support secure document management.

## Key Features

- **Authentication:** Sign-in and user authentication through Supabase.
- **Document Ownership:** Documents are associated with their owners.
- **Permission-Based Sharing:** Share documents with authorized users using read permissions and other supported permission levels.
- **Access Management:** View shared-user permissions and revoke access where authorized.
- **Server-Side Authorization:** Check access permissions before allowing protected document operations.
- **File Validation:** Validate uploaded files according to the application's configured rules.
- **Document Management:** Support document operations subject to the user's permissions.
- **Security Logging:** Support audit logging for relevant document and permission-related activities, as implemented in the application.

## User Access Model

| Access type | Purpose |
|---|---|
| Document Owner | Manages their document and its sharing permissions, subject to authorization rules. |
| Read Permission | Allows an authorized user to view and download a shared document where supported. |
| Edit Permission | Allows an authorized user to make supported changes where edit permission is enforced. |
| Administrator | Administrative access depends on the role assignment and authorization implemented in the application. |

Users must not be able to grant themselves elevated privileges simply by choosing a role during sign-up. Access decisions should be enforced on the server, not just by hiding or displaying interface elements.

## Technology Stack

- **Frontend:** React and TypeScript
- **Application Framework:** TanStack Start
- **Build Tool:** Vite
- **Backend and Authentication:** Supabase
- **Database:** PostgreSQL through Supabase
- **Validation:** Zod
- **Version Control:** Git and GitHub
- **Deployment:** Vercel

## Security Approach

TrustVault is designed around the following security principles:

- Verify the authenticated user's identity before protected operations.
- Check document ownership and permissions on the server.
- Prevent unauthorized document reads, edits, deletions, and sharing operations.
- Recheck permissions when access is changed or revoked.
- Validate file uploads on the server.
- Keep privileged service-role credentials out of browser code and public repositories.
- Restrict access to permission information and audit records.

These are security objectives; the effectiveness of each control depends on the implementation and verification of the deployed application.

## Local Setup

### Prerequisites

- Node.js
- npm
- Git
- A Supabase project with the required database schema and authentication configuration

### Installation

Clone the repository:

```bash
git clone https://github.com/Devatejaswi2028/trustvault-secure.git
cd trustvault-secure
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables using the names referenced by the application and its deployment configuration. Do not commit actual credentials.

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

### Build

To check whether the project builds successfully, run:

```bash
npm run build
```

## Environment Variables

Configure the required Supabase settings in your local environment and deployment platform. Variable names must match the application's code.

Depending on the server and client integrations, the project may require variables such as:

- `SUPABASE_URL`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

**Security note:** Never expose the Supabase service-role key in client-side code, commit it to GitHub, or include its value in documentation. Only configure it in the trusted server environment when required.

## Testing and Verification

The following checks should be performed before treating the application as security-verified:

- Verify that authenticated users can access their own documents.
- Verify that ungranted users cannot read or download another user's documents.
- Verify that read-only users cannot perform unauthorized edits or deletions.
- Verify that only authorized users can grant or revoke permissions.
- Revoke access and confirm that subsequent protected requests are denied.
- Test protected operations without an authenticated session.
- Test invalid and oversized uploads.
- Check that relevant successful and denied security events are logged.

Only report tests as passed when they have actually been executed and their results recorded.

## Project Documentation

- [`PROMPTS.md`](./PROMPTS.md) — Development log and AI assistance notes.
- [`THREATS.md`](./THREATS.md) — Threat model, potential risks, mitigations, and verification plan.

## Links

- **GitHub Repository:** https://github.com/Devatejaswi2028/trustvault-secure
- **Vercel Deployment:** https://trustvault-secure-ylxt.vercel.app/

## Future Improvements

- Expand automated authorization and permission-revocation tests.
- Improve security test coverage for document operations.
- Verify role assignment and administrative access controls.
- Improve deployment monitoring and audit-log review.

## Acknowledgements

Built as part of the Snovasys Fresher Hiring Challenge 2026.

