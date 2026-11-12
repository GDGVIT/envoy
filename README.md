<p align="center">
<a href="https://dscvit.com">
	<img width="400" src="https://user-images.githubusercontent.com/56252312/159312411-58410727-3933-4224-b43e-4e9b627838a3.png#gh-light-mode-only" alt="GDG VIT"/>
</a>
	<h2 align="center">Envoy - Secure Environment Variable Management</h2>
	<h4 align="center">A secure platform for managing and sharing environment variables across development teams<h4>
</p>

---
[![Join Us](https://img.shields.io/badge/Join%20Us-Developer%20Student%20Clubs-red)](https://dsc.community.dev/vellore-institute-of-technology/)
[![Discord Chat](https://img.shields.io/discord/760928671698649098.svg)](https://discord.gg/498KVdSKWR)

[![DOCS](https://img.shields.io/badge/Documentation-see%20docs-green?style=flat-square&logo=appveyor)](https://github.com/GDGVIT/envoy) 
[![UI ](https://img.shields.io/badge/User%20Interface-Link%20to%20UI-orange?style=flat-square&logo=appveyor)](https://env-sharing-platform.vercel.app)

## Overview

The Environment Sharing Platform is a secure web application that enables development teams to safely manage, store, and share environment variables without exposing sensitive credentials through insecure channels like Slack or email. Built with Next.js and MongoDB, it provides an encrypted, centralized vault for all your environment variables.

### How it's organized

```
Organization          owners, admins and members
└ Team                each member is an Editor or a Viewer
  └ Project           one app or service
    └ Environment     development, staging, production, … (each with its own variables)
```

| Role | Can do |
| --- | --- |
| **Org owner** | Everything, plus delete the org, transfer ownership, require two-factor, reset a member's 2FA |
| **Org admin** | Create teams, invite people, change roles, edit every project, view the audit log |
| **Org member** | See only the teams they're on |
| **Team editor** | Read and change variables, create projects and environments in that team |
| **Team viewer** | Read variables only |

## Features
- [x] **Organizations, teams and projects** - Org owners and admins create teams and decide who can edit and who can only read
- [x] **Multiple environments per project** - development, staging and production out of the box; add your own
- [x] **Sign in with Google** - Accounts are created with Google; people can add a password in Account settings for email sign-in
- [x] **Passkeys and authenticator apps** - Optional second step at sign-in (Touch ID, Face ID, Windows Hello, a password manager, or 6-digit codes), with one-time backup codes. Owners can require it for their organization
- [x] **Values stay hidden until you confirm** - People with two-factor confirm with a passkey or code before secret values are sent to the browser; the unlock lasts 10 minutes and lives on the server
- [x] **Restricted projects** - Limit a project to selected team members; move projects between teams
- [x] **Invitations** - 10-character invite codes (also shareable as a link) that expire and can be limited to a number of uses. Envoy doesn't send email.
- [x] **Audit log** - Owners and admins see every change to members, teams, projects and variables (key names only, never values)
- [x] **Personal API tokens** - Fetch variables from the CLI or CI; tokens follow the user's current access
- [x] **Encrypted at rest** - AES-256-GCM, decrypted only for people with access
- [x] **Safe concurrent editing** - Saves are versioned, so two editors can't silently overwrite each other
- [x] **Temporary links** - Share a .env once without an account; links expire within 24 hours and are deleted. Environments are never public.
- [x] **Monochrome UI** - shadcn/ui, dark and light themes, ⌘K command menu, keyboard shortcuts, responsive down to mobile
- [x] **Rate Limiting** - Built-in rate limiting to prevent abuse and ensure system stability
- [ ] **NodeJS and Python SDK** - Fetch environment variables directly from the terminal

<br>

## Tech Stack

### Frontend
- **Next.js 15** (App Router) and **TypeScript 5**
- **shadcn/ui** (Radix primitives) with **Tailwind CSS 4**, monochrome theme tokens in `src/app/globals.css`
- **Geist Sans / Geist Mono** fonts, **Lucide** icons, **cmdk** command menu, **sonner** toasts
- **SWR** for client data fetching, **next-themes** for dark/light

### Backend
- **Next.js route handlers** under `src/app/api`
- **MongoDB** with **Mongoose**
- **NextAuth.js** (Google + email/password) with an optional passkey or TOTP second factor

### Security
- **SimpleWebAuthn** for passkeys (only public keys stored, single-use challenges)
- **otpauth** + **qrcode** for TOTP enrollment and verification (replay-protected, rate-limited)
- **bcryptjs** for password hashing; backup codes and API tokens are stored as SHA-256 hashes
- **Node `crypto` AES-256-GCM** for values at rest (`crypto-js` only to read legacy values)
- **zod** request validation, **rate-limiter-flexible** rate limiting

## Running

### Prerequisites
- Node.js 20.12 or newer
- MongoDB database
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/GDGVIT/envoy.git
cd envoy/web-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the `web-app` directory with the following variables:
```bash
# Database
NEXT_MONGO_URI=your_mongodb_connection_string

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

#Google oAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Encryption (server only; use a long random value and keep it backed up)
ENCRYPTION_SECRET=your_long_random_encryption_key

#Others
NEXT_PUBLIC_APP_NAME=your_app_name
```

`ENCRYPTION_SECRET` is used only by server-side code and must stay the same for as long as encrypted data needs to be read: it encrypts variable values, temporary links and authenticator-app secrets. Changing it makes that data unreadable (nothing is deleted; restoring the old value fixes it), so keep it backed up.

Optional: `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` pin passkeys to one domain (e.g. `envoy.example.com` and `https://envoy.example.com`). Without them, passkeys belong to whichever domain they were created on.

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production

Build and start the production server:
```bash
npm run build
npm start
```

### Linting and type checks

```bash
npm run lint
npm run typecheck
```

## CLI & API access

1. In the app, open **Account → API tokens** and create a token.
2. Fetch an environment (every project page has a **Use from CLI** button with the exact URL):

```bash
export ENVOY_TOKEN=envoy_pat_…

# write a .env file
curl -fsS -H "Authorization: Bearer $ENVOY_TOKEN" \
  "https://your-envoy-host/api/v1/<org>/<team>/<project>/<environment>?format=dotenv" > .env

# or get JSON: { "vars": { "KEY": "value" }, "version": 3, … }
curl -fsS -H "Authorization: Bearer $ENVOY_TOKEN" \
  "https://your-envoy-host/api/v1/<org>/<team>/<project>/<environment>"
```

Tokens act with the owner's *current* access: removing someone from a team (or the org) immediately cuts off their tokens too. Revoke a token from the same page.

### Pagination

List endpoints (organizations, members, team projects and members, invite links, API tokens, audit log) return one page at a time:

- `?limit=` sets the page size: default 50, at most 100.
- Each response includes `nextCursor`. Pass it back as `?cursor=` to get the next page; it is `null` on the last page.
- Cursors are opaque and stay stable when items are added or removed between requests.
- Some lists also return `total`. Org members accept `?q=` to search by name or email.

## Breaking changes from the workspaces/groups version

Envoy used to organize variables as Workspaces → Groups. Existing data has been moved to Organizations → Teams → Projects → Environments.
- Group tokens no longer work. `GET /api/env/get` returns `410 Gone`; use personal API tokens and `/api/v1/…`.
- Nothing can be made public. Use invite links, or temporary links (at most 24 hours) for one-off sharing.
- Invitations are 10-character codes (`XXXXX-XXXXX`), also usable as an `/invite/<code>` link. Envoy doesn't send email invites.

## Project Structure

```
web-app/
├── src/
│   ├── app/
│   │   ├── (auth)/                 # login, signup, 2FA setup/verify, onboarding, invite links
│   │   ├── (app)/                  # signed-in app: /o/[org]/…, /account
│   │   ├── share/                  # temporary links (expire within 24h)
│   │   └── api/                    # route handlers (orgs, teams, projects, envs, invites, tokens, 2fa, v1)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── app/                    # app shell, env editor, command menu
│   │   └── landing/                # marketing page
│   ├── lib/                        # auth, authorization, audit, totp, validation, dotenv
│   ├── models/                     # Mongoose schemas
│   └── utils/                      # encryption, rate limiting, db connection
└── public/
```

## Contributors

<table style>
	<tr align="center">
		<td>
		Chirayu Sahu
		<p align="center">
			<img src = "https://avatars.githubusercontent.com/u/81841434?v=4" width="150" height="150" alt="Chirayu Sahu">
		</p>
			<p align="center">
				<a href = "https://github.com/ChirayuSahu">
					<img src = "http://www.iconninja.com/files/241/825/211/round-collaboration-social-github-code-circle-network-icon.svg" width="36" height = "36" alt="GitHub"/>
				</a>
				<a href = "https://www.linkedin.com/in/chirayusahu">
					<img src = "http://www.iconninja.com/files/863/607/751/network-linkedin-social-connection-circular-circle-media-icon.svg" width="36" height="36" alt="LinkedIn"/>
				</a>
			</p>
			<p>Frontend / Backend</p>
		</td>
		<td>
		Humaidh
		<p align="center">
			<img src = "https://media.licdn.com/dms/image/v2/D4D03AQFmAoy4PEoWXw/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1711743457657?e=1757548800&v=beta&t=8VSDF1dhaLC9naTbhrexTnI5p4Ci6EBA_KIDp6yzOpE" width="150" height="150" alt="Chirayu Sahu">
		</p>
			<p align="center">
				<a href = "https://github.com/EvilPedia">
					<img src = "http://www.iconninja.com/files/241/825/211/round-collaboration-social-github-code-circle-network-icon.svg" width="36" height = "36" alt="GitHub"/>
				</a>
				<a href = "https://www.linkedin.com/in/humaidh-ahmed-927134272">
					<img src = "http://www.iconninja.com/files/863/607/751/network-linkedin-social-connection-circular-circle-media-icon.svg" width="36" height="36" alt="LinkedIn"/>
				</a>
			</p>
			<p>Security</p>
		</td>
	</tr>
</table>

<p align="center">
	Made with ❤ by <a href="https://dscvit.com">GDG VIT</a>
</p>
