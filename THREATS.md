# TrustVault — Threat Model

## 1. Purpose

TrustVault is a secure document-sharing application designed to help users manage documents and control access through permissions. This document identifies potential security threats and describes mitigations that should be enforced and verified.

## 2. Assets to Protect

- Uploaded documents and their contents
- User accounts and authentication sessions
- Document ownership and sharing permissions
- Audit logs and security-related events
- User information, including email addresses
- Supabase credentials and server-side secrets

## 3. Users and Access Model

### Document Owner
The authenticated user who owns a document. The owner can manage sharing permissions for that document, subject to the application's authorization rules.

### Viewer
An authenticated user who has been granted read permission for a specific document. Read permission allows viewing and downloading where supported by the application.

### Administrator
An administrative role only if explicitly assigned and enforced by the application. Its existence and capabilities must be verified against the implementation.

Users authenticate through the application's sign-in flow. Users must not be able to grant themselves administrative privileges by selecting a role during registration.

A user who owns one document does not automatically own another user's documents. Access must be checked separately for every document and operation.

## 4. Potential Threats and Mitigations

### T1 — Unauthorized Document Access

**Threat:** A user attempts to view or download a document without permission.

**Mitigation:** Enforce server-side authorization for every document read and download. Verify document ownership or the required permission before returning document contents.

### T2 — Unauthorized Editing or Deletion

**Threat:** A viewer or another unauthorized user attempts to modify or delete a document.

**Mitigation:** Check ownership and the required edit or delete permission on the server before processing the request. Do not rely only on frontend controls.

### T3 — Permission Abuse

**Threat:** A user attempts to grant access to a document they do not own or continues accessing a document after permission has been revoked.

**Mitigation:** Restrict permission grants and revocations to authorized users. Recheck permissions on each request and test that revoked access is denied immediately.

### T4 — Authentication Bypass

**Threat:** An unauthenticated user attempts to invoke protected application operations.

**Mitigation:** Require a valid authenticated session in protected server functions. Reject requests when authentication is missing or invalid.

### T5 — Insecure Direct Object Reference

**Threat:** A user changes a document ID in a request to attempt to access another user's document.

**Mitigation:** Validate the requested document ID and check the authenticated user's authorization on the server for every operation.

### T6 — Malicious or Invalid File Upload

**Threat:** A user uploads an oversized, invalid, or potentially dangerous file.

**Mitigation:** Validate file size, file type, and filename on the server. Do not depend solely on browser-side validation.

### T7 — Sensitive Information Exposure

**Threat:** Private documents, user information, or privileged database credentials are exposed to unauthorized users.

**Mitigation:** Keep service-role secrets on the server, use appropriate database access policies, and return only the data needed by the client. Never expose privileged keys in browser code or public repositories.

### T8 — Audit Log Gaps or Tampering

**Threat:** Important security events are missing or audit records can be modified by unauthorized users.

**Mitigation:** Record relevant successful and denied operations, including document actions and permission changes. Restrict modification and access to audit records according to the application's security design.

### T9 — Incorrect Role Assignment

**Threat:** A user obtains administrative or document-owner privileges without authorization.

**Mitigation:** Do not allow users to assign themselves privileged roles through the sign-up form. Assign and verify roles through trusted server-side logic. Check authorization for every protected operation.

### T10 — Permission Enumeration or Information Leakage

**Threat:** A user attempts to list other users' permissions or obtain email addresses without authorization.

**Mitigation:** Restrict permission-listing operations to authorized document owners or other explicitly authorized roles. Return only necessary user information.

## 5. Security Verification Plan

The following checks should be performed against the application:

- Sign in with separate user accounts and verify document access boundaries.
- Verify that a user without permission cannot read or download another user's document.
- Verify that a viewer cannot edit, delete, or share a document unless explicitly authorized.
- Grant read access and verify the intended user can access only the shared document.
- Revoke permission and verify that further requests are denied.
- Test protected operations while signed out.
- Verify that users cannot grant themselves administrative privileges.
- Check that permission changes and relevant successful or denied actions appear in audit logs.
- Test invalid and oversized file uploads.
- Verify that permission listings do not expose unauthorized information.

## 6. Residual Risks

A written threat model does not prove that the application is secure. Security depends on correct server-side authorization, database policies, storage configuration, authentication, and deployment secrets.

Manual checks may not cover every attack path. Automated authorization tests and a review of the deployed configuration are recommended. Only tests actually executed should be reported as completed.

## 7. AI Assistance

AI assistance was used to help organize potential threats, identify security considerations, and prepare a verification checklist. The implementation, configuration, and test results must be independently checked against the actual application.
