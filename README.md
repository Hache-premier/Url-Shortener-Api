# 🔗 URL Shortener API

> A RESTful URL Shortener API built with Node.js, Express, and PostgreSQL that converts long URLs into short links, redirects visitors to their destinations, tracks clicks, and provides paginated click history and CSV exports.

---

## 📌 Problem Statement

Long URLs can be inconvenient to share, manage, and track. A URL shortening service provides a simple way to generate compact links while preserving the original destination.

This project demonstrates how to build a backend API that manages short links, handles HTTP redirects, records visitor activity, and stores data reliably using PostgreSQL.

The project also focuses on request validation, database transactions, keyset pagination, automated testing, API documentation, and deployment.

---

## 🎯 Project Goals

- Build a RESTful API using Node.js and Express.
- Create short links using generated or custom codes.
- Implement HTTP redirects and link expiration.
- Store short links and click records in PostgreSQL.
- Track clicks using atomic counter updates and database transactions.
- Implement keyset pagination for click history.
- Export click records as streamed CSV files.
- Validate incoming requests using Zod.
- Prevent SQL injection through parameterized database queries.
- Document API endpoints using OpenAPI and Swagger UI.
- Write automated integration tests using Node.js's built-in test runner.
- Practice backend development, database management, and API testing.

---

## 🛠 Tech Stack

**Backend**

- Node.js
- Express 5
- JavaScript (ES Modules)

**Database**

- PostgreSQL
- `pg` PostgreSQL client and connection pooling

**Validation and Documentation**

- Zod
- OpenAPI 3
- Swagger UI Express

**Testing and Deployment**

- Node.js built-in test runner (`node:test`)
- GitHub Actions
- Super-Linter

**Development Tools**

- Git and GitHub
- VS Code
- npm
- curl

---

## 🖥 Features

- Create short links from valid HTTP and HTTPS URLs.
- Generate short codes automatically.
- Support custom short codes.
- Reject duplicate codes and invalid input.
- Redirect visitors using HTTP `302 Found`.
- Support optional link expiration.
- Return HTTP `410 Gone` for expired links.
- Return link metadata, including click counts.
- Record click timestamps, referrers, and user-agent information.
- Increment click counters atomically within database transactions.
- Retrieve click history using keyset pagination.
- Export click history as streamed CSV.
- Delete short links and their associated click records.
- Validate requests at the API boundary using Zod.
- Use parameterized SQL queries for database operations.
- Check application and database connectivity through a health endpoint.
- Provide interactive API documentation with Swagger UI.
- Support local PostgreSQL database setup and sample data seeding.
- Run the API directly using Node.js.
- Automate integration tests and code-quality checks through GitHub Actions.

---

## 🗺 API Endpoints

| Method   | Endpoint                  | Description                        |
| -------- | ------------------------- | ---------------------------------- |
| `GET`    | `/health`                 | Check API and database health      |
| `POST`   | `/links`                  | Create a short link                |
| `GET`    | `/:code`                  | Redirect to the original URL       |
| `GET`    | `/links/:code`            | Retrieve link metadata             |
| `GET`    | `/links/:code/clicks`     | Retrieve paginated click history   |
| `GET`    | `/links/:code/clicks.csv` | Export click history as CSV        |
| `DELETE` | `/links/:code`            | Delete a short link                |
| `GET`    | `/docs`                   | Open interactive API documentation |

### Example: Create a Short Link

**Request**

```http
POST /links
Content-Type: application/json
```

**Request body**

```json
{
  "target_url": "https://example.com/articles",
  "code": "my-article",
  "expires_at": "2030-01-01T12:00:00Z"
}
```

The `code` and `expires_at` fields are optional. When a custom code is not supplied, the API generates one automatically.

**Example using curl**

```bash
curl -i -X POST http://localhost:3000/links \
  -H "Content-Type: application/json" \
  -d '{"target_url":"https://example.com/articles","code":"my-article"}'
```

**Possible responses**

- `201 Created` — short link created successfully.
- `400 Bad Request` — invalid request data.
- `409 Conflict` — the requested code already exists.

### Example: Redirect to a Destination

```bash
curl -i http://localhost:3000/my-article
```

A valid link returns `302 Found` with a `Location` header containing the destination URL.

An unknown code returns `404 Not Found`, while an expired link returns `410 Gone`.

### Example: Retrieve Link Metadata

```bash
curl -i http://localhost:3000/links/my-article
```

The response includes the code, target URL, creation timestamp, expiry timestamp, and click count.

### Example: Retrieve Click History

```bash
curl -i "http://localhost:3000/links/my-article/clicks?limit=20"
```

The API returns the click records and a `next_cursor` value when another page is available. Pass that cursor using the `after` query parameter to retrieve the next page.

The supported page size is between 1 and 100 records.

### Example: Export Click History

```bash
curl -sS \
  -o clicks.csv \
  http://localhost:3000/links/my-article/clicks.csv
```

The endpoint streams click data as CSV. Fields are escaped, including protection against spreadsheet formula injection.

### Example: Delete a Short Link

```bash
curl -i -X DELETE http://localhost:3000/links/my-article
```

A successful deletion returns `204 No Content`. The associated click records are removed through the database's foreign-key cascade.

---

## 🗄 Database Design

The application uses two PostgreSQL tables.

**`links`**

Stores:

- Link ID and unique short code.
- Original destination URL.
- Creation and optional expiry timestamps.
- Total click count.

**`clicks`**

Stores:

- Click ID and associated link ID.
- Click timestamp.
- HTTP referrer.
- User-agent information.

### Data Integrity and Performance

- Unique constraints prevent duplicate short codes.
- A check constraint prevents negative click counts.
- Foreign-key cascading removes clicks when their link is deleted.
- An index supports click-history queries ordered by timestamp and ID.
- Parameterized SQL queries protect database operations from SQL injection.
- Click-count updates and click-record insertion are performed in one transaction.
- Keyset pagination avoids relying on offset-based pagination for click history.

---

## 📸 Screenshots

The following screenshots demonstrate the interactive API documentation using Swagger UI.

![URL Shortener API documentation](docs/images/swagger-ui.png)

![URL Shortener API documentation](docs/images/swagger-ui-1.png)

![URL Shortener API documentation](docs/images/swagger-ui-2.png)

![URL Shortener API documentation](docs/images/swagger-ui-3.png)

![URL Shortener API documentation](docs/images/swagger-ui-4.png)

![URL Shortener API documentation](docs/images/swagger-ui-5.png)

---

## ⚙️ Installation and Setup

### 📥 Clone the Repository

```bash
git clone https://github.com/Hache-premier/Url-Shortener-Api.git

cd Url-Shortener-Api
```

### 📦 Install Dependencies

Make sure Node.js 22 or newer, npm, and PostgreSQL are installed for local development.

Install the project dependencies:

```bash
npm ci
```

### 🐘 Install PostgreSQL on Ubuntu

If PostgreSQL is not already installed, run:

```bash
sudo apt update

sudo apt install postgresql postgresql-contrib
```

Start and enable the PostgreSQL service:

```bash
sudo systemctl enable --now postgresql
```

Verify that PostgreSQL is running:

```bash
sudo systemctl status postgresql
```

### 🔐 Configure the Database

Open the PostgreSQL administrative shell:

```bash
sudo -u postgres psql
```

Create the application role and database:

```sql
CREATE ROLE url_shortener_app
WITH LOGIN PASSWORD 'your_local_database_password';

CREATE DATABASE url_shortener
OWNER url_shortener_app;
```

Exit PostgreSQL:

```sql
\q
``
```
