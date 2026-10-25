# Hauser&Wirth API contract

All successful JSON responses use the shapes below. Failures use `{ "error": { "code": "…", "message": "…" } }`. API clients send cookies with credentials. Except for `GET /api/meta`, the routes below require an authenticated session. Admin-only and customer-only rules are enforced by the server.

## Authentication

| Method and path | Access | Request | Success |
|---|---|---|---|
| `POST /api/auth/signup` | Public; creates customers only | `{ "name": "…", "email": "…", "password": "…" }` | `201 { "user": { "id", "name", "email", "role" } }`; sets httpOnly cookie |
| `POST /api/auth/login` | Public | `{ "email": "…", "password": "…" }` | `200 { "user": { "id", "name", "email", "role" } }`; sets cookie |
| `POST /api/auth/logout` | Public | Empty | `200 { "message": "…" }`; clears cookie |
| `GET /api/auth/me` | Authenticated | Empty | `200 { "user": { "id", "name", "email", "role", "created_at" } }` |

Signup requires a non-empty name, valid email, and password of at least 8 characters. Duplicate email is `409 DUPLICATE_EMAIL`. Admin users are created only by the seed process.

## Metadata and paintings

| Method and path | Access | Request | Success |
|---|---|---|---|
| `GET /api/meta` | Public | — | `200 { "meta": { "wallPainting": { "ratePerSqft", "today", "minSqft", "maxSqft", "minDaysAhead", "maxDaysAhead", "cancelMinDaysAhead" }, "pottery": { "items", "glazes", "today", "minQuantity", "maxQuantity", "minDaysAhead" } } }` |
| `GET /api/paintings` | Authenticated | — | `200 { "paintings": [painting] }` |
| `GET /api/paintings/:id` | Authenticated | — | `200 { "painting": painting }` |
| `POST /api/paintings` | Admin | `{ "title", "artist", "description", "price", "image_url" }` | `201 { "painting": painting }` |
| `PATCH /api/paintings/:id` | Admin | Any subset of the create fields | `200 { "painting": painting }` |

A painting has `id`, `title`, `artist`, `description`, integer `price`, `image_url`, `available`, and `created_at`. `available` is derived from placed orders. Admin edits of unavailable paintings return `409 PAINTING_UNAVAILABLE`.

## Orders

| Method and path | Access | Request | Success |
|---|---|---|---|
| `POST /api/paintings/:id/orders` | Customer | Empty | `201 { "order": order }` |
| `GET /api/orders` | Customer (own records) or admin (all) | — | `200 { "orders": [order] }` |
| `PATCH /api/orders/:id/cancel` | Owning customer | Empty | `200 { "order": order }` |

Order fields include `id`, `painting_id`, `painting` (id/title/artist/image_url), `price` (price snapshot), `status` (`placed` or `cancelled`), `created_at`, and `cancelled_at`. Admin order responses also include `customer_id`, `customer_name`, and `customer_email`. A competing purchase returns `409 DOUBLE_SELL` with `Someone just bought this painting.` Only placed orders can be cancelled.

## Wall bookings

| Method and path | Access | Request | Success |
|---|---|---|---|
| `GET /api/bookings/taken-dates` | Authenticated | — | `200 { "takenDates": ["YYYY-MM-DD"] }` |
| `POST /api/bookings` | Customer | `{ "date": "YYYY-MM-DD", "wall_sqft": 10, "address": "…" }` | `201 { "booking": booking }` |
| `GET /api/bookings` | Customer (own records) or admin (all) | — | `200 { "bookings": [booking] }` |
| `PATCH /api/bookings/:id/confirm` | Admin | Empty | `200 { "booking": booking }` |
| `PATCH /api/bookings/:id/decline` | Admin | Empty | `200 { "booking": booking }` |
| `PATCH /api/bookings/:id/cancel` | Owning customer | Empty | `200 { "booking": booking }` |

Dates use the Asia/Kolkata calendar. A request must be 7–90 days ahead inclusive, area 10–500 sq ft inclusive, and address non-empty. The server calculates and stores `rate` and `total_price`. Booking fields include `id`, `customer_id`, optional admin-only `customer_name`, `date`, `wall_sqft`, `address`, `rate`, `total_price`, `status`, and `created_at`. Statuses: `requested`, `confirmed`, `declined`, `cancelled`. Only requested bookings can be confirmed/declined; customers can cancel requested or confirmed bookings at least 3 days ahead. A held-date collision returns `409 DOUBLE_BOOKING` with `That date was just booked.`

## Pottery requests

| Method and path | Access | Request | Success |
|---|---|---|---|
| `POST /api/pottery` | Customer | `{ "item", "glaze", "quantity", "needed_by": "YYYY-MM-DD" }` | `201 { "request": request }` |
| `GET /api/pottery` | Customer (own records) or admin (all) | — | `200 { "requests": [request] }` |
| `PATCH /api/pottery/:id` | Owning customer while requested | Any subset of create fields | `200 { "request": request }` |
| `PATCH /api/pottery/:id/accept` | Admin; requested only | Empty | `200 { "request": request }` |
| `PATCH /api/pottery/:id/decline` | Admin; requested only | Empty | `200 { "request": request }` |
| `PATCH /api/pottery/:id/cancel` | Owning customer; requested only | Empty | `200 { "request": request }` |

Item and glaze must match `/api/meta`; quantity is 1–12 and needed-by is at least 14 days ahead. Request fields are `id`, `customer_id`, optional admin-only `customer_name`, `item`, `glaze`, `quantity`, `needed_by`, `status`, `created_at`, and `updated_at`. Statuses: `requested`, `accepted`, `declined`, `cancelled`. No item prices are provided or inferred.

## Common failures

- `400 VALIDATION_ERROR` — invalid or missing fields.
- `401 UNAUTHENTICATED` / `INVALID_TOKEN` — sign in or renew the session.
- `403 FORBIDDEN` — role is not permitted.
- `404 NOT_FOUND` — resource is missing or not owned by the customer.
- `409` — uniqueness conflict or invalid state transition; the user-facing `message` should be shown as returned.
- `500 INTERNAL_ERROR` — unexpected error; no internal details are returned.
