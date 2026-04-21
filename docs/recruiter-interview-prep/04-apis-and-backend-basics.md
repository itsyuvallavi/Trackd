# APIs and backend basics (recruiter-level)

Goal: you can describe **what happens when someone uses your app** without sounding lost. No exam depth required.

---

## The big picture: client, server, database

1. **Client** — Browser or mobile app the **user** sees.
2. **Server** — Programs that run **on a machine in the cloud** (or a platform like Vercel) answering requests.
3. **Database** — Long-term **storage** (Postgres).

**Simple story:**

> “When the user clicks ‘Save,’ the **client** sends a **request** to the **server**, the **server** checks **who they are**, validates the data, **writes to Postgres** through **Prisma**, and sends back **success or an error message**.”

---

## What an API is (restaurant analogy)

- **API** = the **menu + rules** for how another program may ask your system for work.
- You do not need to show the kitchen — you expose **allowed orders** (endpoints) and **responses**.

**Say:**

> “An **API** is the **contract** between parts of a system — my **web app** talking to my **server**, or my server talking to **Stripe**, **email**, or an **AI** provider.”

---

## HTTP in one breath

Browsers and servers mostly speak **HTTP**:

- **GET** — “Give me this resource” (read).
- **POST** — “Create something” or “do an action” (write / side effects).
- **PUT/PATCH** — “Update something.”
- **DELETE** — “Remove something.”

**Say:** “Under the hood it is **HTTP requests** with **JSON** payloads for modern web apps.”

---

## REST API (what people usually mean)

**REST** is a **style**, not one single standard. People usually mean:

- **URLs** like `/jobs` or `/jobs/123`
- **JSON** bodies
- **Status codes** — 200 OK, 400 bad input, 401 not logged in, 404 not found, 500 server error

**Say:**

> “When I say **REST API**, I mean **predictable HTTP endpoints** returning **JSON** — what most **SPAs** and **mobile apps** consume.”

---

## “How do you create an API?” (conceptual steps)

You do **not** need to list frameworks. Recruiters often want **process**:

1. **Decide the resource** — Example: “Job application.”
2. **Define operations** — Create, list, update status, delete/archive.
3. **Define input rules** — Required fields, formats (often with a validator like **Zod** in TypeScript).
4. **Authenticate** — Only the right user can touch their rows.
5. **Implement handler** — Function that runs on the server for each route.
6. **Talk to the database** — Insert/update/select rows (with **Prisma** or SQL).
7. **Return a clear response** — JSON + correct status code; errors that do not leak secrets.

**Say:**

> “I start from the **data model** and **user actions**, then expose **endpoints** or **server actions** with **validation** and **auth checks**, then persist to **Postgres** and return **JSON**.”

---

## Authentication vs authorization (sound smart in 10 seconds)

- **Authentication (authn)** — **Who are you?** (login)
- **Authorization (authz)** — **What are you allowed to do?** (permissions)

**Say:** “I wire **login** through **Supabase auth**, then every data query is **scoped to that user**.”

---

## What “backend” means in interviews

Usually any combination of:

- **APIs** and business rules
- **Databases** and migrations
- **Integrations** (email, payments, CRMs)
- **Background work** (cron, queues — you may only have light exposure; that is fine)

**Say:** “My **backend** work is **server-side TypeScript**, **database schema**, **APIs**, and **integrations**.”

---

## What “full stack” means

You work across **UI** and **server/data** — not that you are world-class at every specialty on day one.

**Say:** “**Full stack** for me means I can ship a **feature vertically** — UI, server logic, and **persistence**.”

---

## Node.js + Postgres + Prisma (tie it together)

- **Node.js** runs your **server code**.
- **Postgres** **stores** structured data.
- **Prisma** helps your **TypeScript** query and migrate **Postgres** safely.

**One sentence:**

> “**Node** runs the server, **Postgres** stores the data, and **Prisma** is the **typed database layer** between them.”

---

## If they ask “GraphQL?” or “gRPC?”

Only if it comes up:

> “Most of my work is **REST/HTTP JSON** and **Next.js server patterns**; I have not shipped **GraphQL** to production, but I understand it is another way to expose **APIs** with a **single endpoint** and flexible queries.”

Skip if not relevant.

---

## If they ask “microservices?”

> “My recent apps are **modular monoliths** — clear boundaries in code, one deployable app. I have not split a production system into many microservices, but I understand the tradeoff: **independence vs operational complexity**.”

Adjust if you have microservice experience.