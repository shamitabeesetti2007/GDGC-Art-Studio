# Design and implementation notes

## 1. Application architecture

Hauser&Wirth uses a lightweight client-server architecture.

- **Frontend:** `index.html`, CSS, and vanilla JavaScript provide the user interface.
- **API client:** `assets/js/api.js` acts as the frontend's HTTP service boundary.
- **Frontend integration:** `assets/js/integration.js` connects the application views and navigation to API-backed data.
- **Backend:** Express serves the frontend and handles API requests.
- **Database:** SQLite stores users, paintings, orders, bookings, pottery requests, and related status history.

The frontend sends requests to the backend instead of treating browser-side data as the source of truth. The backend validates requests, checks permissions, and performs database operations.

The API base URL is provided through the server's `/api/config.js` configuration endpoint. `FRONTEND_API_URL` is public configuration, not a secret.

## 2. Login, authentication, and roles

### Customer authentication

Customers register through the signup endpoint and authenticate through the login endpoint. Passwords are hashed using `bcryptjs`; the original plaintext password is not stored in the database.

After successful login, the server issues a JWT in an HTTP-only cookie. This prevents frontend JavaScript from directly reading the cookie. The browser sends the cookie with applicable requests, allowing the server to identify the authenticated user.

The application supports session restoration and logout.

### Customer and administrator roles

Customers can browse paintings, purchase available paintings, view their own orders, request wall-painting services, and submit pottery requests.

The studio administrator has additional permissions to manage paintings and customer requests.

Administrator accounts are initialized through the seed process using credentials supplied through environment variables. Public customer signup does not create administrator accounts.

Authorization is enforced on the server. Frontend route guards improve navigation but are not a security boundary. Protected backend operations must authenticate the user and check the relevant role and ownership.

## 3. Database choice and data integrity

### Why SQLite?

SQLite keeps local development and evaluation simple because the database is stored locally and does not require a separately managed database server. It supports transactions, constraints, indexes, and relational data integrity.

The application uses `better-sqlite3` to access SQLite. Foreign-key enforcement and write-ahead logging (WAL) are enabled in the database configuration.

### Main data relationships

- **Users:** Customer and administrator accounts, including role and password hash.
- **Paintings:** Artwork details and listed prices.
- **Orders:** The customer, painting, purchase-time price snapshot, and order status.
- **Wall bookings:** Customer, date, wall size, address, rate, total price, and booking status.
- **Pottery requests:** Customer request details, quantity, glaze, required date, and status.
- **Events:** Status-change history, including the affected entity and actor.

Orders reference the relevant customer and painting. Bookings and pottery requests reference their customer. Foreign-key constraints help prevent invalid relationships.

### Price snapshots

An order stores the painting's price at the time the order is placed. A booking similarly stores the applicable rate and calculated total.

This preserves historical transaction values if the displayed price or service rate changes later. Prices are determined by the server rather than trusted from client-submitted totals.

## 4. Preventing a painting from being sold twice

This is an important data-integrity rule in Art Editorial.

### The problem: a race condition

Suppose two customers try to purchase the same painting at almost the same time.

If the application only checks whether the painting is available before inserting an order, both requests could pass the check before either order is created. This is a race condition.

A frontend-only check cannot reliably prevent it because requests can arrive concurrently and clients cannot be trusted to enforce business rules.

### The solution: a partial unique index

The orders table uses a partial unique index on `painting_id` for orders whose status is `placed`.

Conceptually, the rule is:

```sql
CREATE UNIQUE INDEX ...
ON orders(painting_id)
WHERE status = 'placed';
```

The exact index name and definition should be read from the actual database schema.

The index enforces the rule at the database level: only one placed order can reference a given painting. Cancelled orders are excluded from the index, so a cancelled purchase releases the painting for another customer.

### Purchase flow

1. The customer clicks **Buy**.
2. The frontend sends a `POST` request to `/api/paintings/:id/orders`.
3. The backend authenticates the user and validates the request.
4. The purchase operation writes the order using the server's painting price.
5. The database's unique index ensures that no second active purchase for the same painting can be committed.
6. If the purchase succeeds, the order is saved.
7. If a competing purchase has already claimed the painting, the uniqueness constraint rejects the conflicting insert. The backend maps the conflict to HTTP `409 Conflict` and a user-friendly message.

The transaction ensures that the relevant database changes succeed or fail together. The unique index provides the critical protection against double-selling; a transaction alone does not replace that constraint.

### Why this design?

The database is the final authority on whether the painting can be sold. Even if requests arrive at the same time, the uniqueness constraint protects the invariant.

Painting availability is derived from placed orders rather than maintained as a separate, independently mutable sold flag. This reduces the risk of the painting's availability becoming inconsistent with its order history.

## 5. Preventing double-booking

Wall-painting bookings use a similar database-level approach.

A partial unique index on the booking date covers bookings in the `requested` or `confirmed` states. This prevents two active bookings from holding the same date.

Declined and cancelled bookings no longer hold the date. If a competing booking violates the constraint, the backend returns HTTP `409 Conflict` with a clear message.

Booking dates, wall dimensions, and prices are validated on the server. The server computes the total from the wall size and configured rate.

## 6. Status changes and history

Orders, bookings, and pottery requests have defined status transitions. For example, an order can move from `placed` to `cancelled`.

Status changes and their corresponding event-history records are written transactionally so that the status and its history remain consistent.

The event records can support a timeline of changes and help explain how a request moved through the system.

## 7. Validation and authorization

The backend enforces business rules rather than relying only on frontend form validation.

Examples include:

- Customers can access only their own orders and requests.
- Administrator-only operations reject customer accounts.
- Only eligible paintings can be edited or purchased.
- Booking dates and wall dimensions must fall within the configured limits.
- Pottery selections, quantities, and required dates are validated.
- Request updates and cancellations depend on the current status.

Invalid requests should return an appropriate client error rather than silently changing data.

## 8. Completed functionality, limitations, and next steps

### Implemented

The project includes customer authentication, role-protected studio management, an API-backed painting gallery, painting orders, wall-painting bookings, pottery requests, SQLite persistence, and database-level protection against double-selling and double-booking.

The frontend also includes loading, error, unavailable, and empty states.

### Deliberately not integrated

Online payment processing is not integrated. Creating an order records the purchase in the application but does not charge the customer.

The project uses SQLite for local evaluation rather than a separately hosted production database. A `seedData.zip` archive was not available in the checkout, so the existing seed module is used as the source for initial data.

### Future improvements

- Add and run explicit concurrency tests that send simultaneous purchase requests for the same painting.
- Expand automated tests for authorization, status transitions, and validation boundaries.
- Add payment integration with appropriate payment-provider verification if required.
- Add production deployment configuration, monitoring, database backup and retention policies, and managed secret storage.

## 9. Key design takeaway

Art Editorial separates responsibilities across the frontend, backend, and database. The frontend provides the user experience, the backend enforces authentication and business rules, and SQLite protects critical data-integrity constraints.

For the buy-painting feature, the partial unique index is the key safeguard: it prevents two active orders from claiming the same painting even when customers submit competing requests.
