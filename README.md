# Hauser&Wirth

Hauser&Wirth is a static vanilla-JavaScript frontend served by an Express API. SQLite is the source of truth for customer, painting, order, booking, and pottery data. The browser uses an httpOnly JWT cookie and never stores credentials or tokens in web storage.

## Features

### Customer
- Register, log in, log out, and restore an authenticated session.
- Browse paintings and view availability.
- Purchase an available painting and view order history.
- Request a wall-painting booking.
- Submit and manage pottery requests, subject to their status.

### Studio administrator
- Access protected studio-management features.
- Add and edit available paintings.
- View and manage customer orders.
- Confirm or decline wall-painting bookings.
- Accept or decline pottery requests.

### Data integrity and security
- Passwords are hashed using bcrypt.
- Authentication uses JWTs stored in HTTP-only cookies.
- Server-side authorization protects restricted operations.
- SQLite partial unique indexes prevent double-selling paintings and double-booking dates.
- Transactions maintain consistency during relevant state changes.
- Prices are stored as snapshots when an order or booking is created.

Payments are not integrated; placing an order records a purchase request/order but does not process a payment.

## Technology stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js and Express
- **Database:** SQLite using `better-sqlite3`
- **Authentication:** JWT cookies and `bcryptjs`
- **Testing:** Node.js built-in test runner

## Prerequisites

- Node.js 20 or newer
- npm
- Git

Depending on your operating system, `better-sqlite3` may require a prebuilt binary or local build tools.

## Installation and setup

### 1. Clone the repository

```bash
git clone <YOUR_PUBLIC_REPOSITORY_URL>
cd gdgc-art-studio
```

Replace the repository URL with your actual GitHub repository URL. If your repository has a different name, use that name in the `cd` command.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`.

On Windows Command Prompt:

```cmd
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Edit `.env` and set your own values for:

- `JWT_SECRET`: a long, randomly generated secret.
- `ADMIN_EMAIL`: the email for your studio administrator.
- `ADMIN_PASSWORD`: a strong administrator password.

Keep `.env` private. Never commit it to GitHub. The `.env.example` file contains placeholders and should be committed.

Keep the other configuration values from `.env.example` unless your environment requires changes. `FRONTEND_URL` must match the browser origin configured for the application. `FRONTEND_API_URL` can remain empty for the included same-origin setup.

### 4. Initialize the database

```bash
npm run seed
```

This initializes the configured administrator account and inserts the initial painting data when the paintings table is empty. Seed data for pottery options and the wall-painting rate is maintained in `server/seed/index.js`.

The seed command is not a database reset: it does not replace existing records or reset existing account passwords.

### 5. Start the application

```bash
npm run dev
```

Open the local URL printed by the server, or the configured local frontend URL if the application does not print one.

### 6. Run tests

Stop the development server if necessary, then run:

```bash
npm test
```

## Available commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run seed` | Initialize the admin and initial seed data |
| `npm run dev` | Start the development server with Nodemon |
| `npm start` | Start the server directly |
| `npm test` | Run automated tests |

## Testing the application

1. Register a customer account and log in.
2. Browse the gallery and open an available painting.
3. Place an order and verify that it appears in the order history.
4. Try buying the same painting again and verify that it cannot be sold twice.
5. Cancel an eligible order and verify that the painting becomes available again.
6. Submit a wall-painting booking and a pottery request.
7. Log in using the administrator credentials configured in `.env`.
8. Test the available studio-management actions.

The application must be seeded before testing the gallery. If the gallery is empty, check that `npm run seed` completed successfully and inspect the `/api/paintings` request in the browser's Network panel.

## Project documentation

- [`API.md`](./API.md) — API endpoints, request rules, roles, and response behavior.
- [`DESIGN.md`](./DESIGN.md) — Architecture, database decisions, concurrency protection, and implementation scope.
- [`.env.example`](./.env.example) — Environment-variable template.

## Security notes

- Never commit `.env`, real credentials, JWT secrets, or private customer data.
- Do not use example secrets in production.
- Production deployment requires HTTPS, secure secret management, appropriate cookie/CORS configuration, and a database backup and retention strategy.

## Limitations and future improvements

- Online payment processing is not integrated.
- Production deployment and operational hardening remain separate from local development.
- Additional concurrency tests, monitoring, and deployment automation would improve reliability.

