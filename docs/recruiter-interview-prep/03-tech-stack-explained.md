# Tech stack explained (plain language)

Each item: **what it is**, **what job it does**, **how you can say it in an interview**.

---

## TypeScript (TS)

**What it is:** JavaScript with **types** — extra rules checked before your code runs so fewer silly bugs reach production.

**Its job:** Lets teams build **larger apps safely**; same ecosystem as JavaScript.

**Say:** “I write **TypeScript** day to day — it catches mistakes early and makes **refactoring** less scary.”

---

## JavaScript (JS)

**What it is:** The language that runs in **browsers** and, with **Node.js**, on **servers**.

**Say:** “Most of my work is **TypeScript**, which compiles down to **JavaScript** for the browser and server.”

---

## Node.js

**What it is:** A **runtime** — a program that runs JavaScript **outside the browser**, usually on a server.

**Its job:** Handles **web requests**, **file I/O**, **talking to databases**, **calling other APIs** — good for networked apps.

**Say:** “**Node** is how I run **JavaScript/TypeScript on the server** — typical for **APIs** and **Next.js** server code.”

**Not worth over-explaining to a recruiter:** event loop, single-threaded details — only if they are technical.

---

## React

**What it is:** A **UI library** for building interactive web interfaces out of **components** (reusable pieces).

**Say:** “**React** is how I build the **interactive front end** — components, state, forms, tables.”

---

## Next.js

**What it is:** A **framework** on top of React for **web applications** — routing, server rendering, API routes / server actions, deployment story (often **Vercel**).

**Its job:** One codebase for **pages**, **server logic**, and sometimes **background-ish** endpoints.

**Say:** “**Next.js** is my main **full-stack web framework** — React for UI, plus **server-side** features for **data and APIs**.”

---

## Tailwind CSS

**What it is:** A **CSS utility** system — you style with small class names instead of writing large custom CSS files for everything.

**Say:** “**Tailwind** speeds up **UI polish** and keeps styling **consistent**.”

---

## shadcn/ui (and similar)

**What it is:** A pattern people use with Tailwind — **pre-built accessible components** (buttons, dialogs) you copy into your project and own.

**Say:** “I use **shadcn-style** components for **accessible UI** without reinventing basics.”

---

## PostgreSQL (Postgres)

**What it is:** A **relational database** — stores data in **tables** with **rows** and **columns**, related by **keys**; queried with **SQL**.

**Its job:** Durable, structured storage — users, jobs, permissions, audit-style records.

**Say:** “Data lives in **Postgres** — reliable, relational storage for anything that must not disappear when the browser closes.”

---

## Prisma

**What it is:** An **ORM** (Object–Relational Mapper) and **toolkit** for TypeScript/JavaScript that talks to databases like Postgres.

**What Prisma is used for (in practice):**

1. **Schema** — You define tables and relations in a `schema` file Prisma understands.
2. **Migrations** — Controlled **changes** to the database structure over time (add a column, new table).
3. **Queries in code** — Type-safe functions like “create job,” “list jobs for this user,” instead of hand-writing every SQL string in app code.

**Say:** “**Prisma** is how my **TypeScript** code talks to **Postgres** in a **type-safe** way, and how I manage **schema changes** cleanly.”

**Analogy:** Postgres is the **filing cabinet**. Prisma is the **labeled drawers and forms** that help you put papers in the right place without losing consistency.

---

## Supabase

**What it is:** A **hosted platform** often described as “open-source Firebase-style” — commonly **Postgres + auth + storage + APIs** with client libraries.

**Its job:** Faster path to **auth** and **database** for apps; you still think in tables and security rules.

**Say:** “I use **Supabase** for **authentication** and **database hosting** tied to **Postgres** — it speeds up the parts every app needs.”

---

## REST API

**What it is:** A common style of **HTTP API** — URLs represent **resources**, verbs like GET/POST mean **read/write**, responses are often **JSON**.

**Say:** “When I say **REST**, I mean **standard web APIs** — the front end or another service calls **HTTP endpoints** and gets **JSON** back.”

See `04-apis-and-backend-basics.md` for a longer picture.

---

## Firebase

**What it is:** Google’s **Backend-as-a-Service** — auth, database (often NoSQL), hosting, etc., with SDKs.

**Say:** “I’ve integrated **Firebase** on mobile and web projects where the client needed **fast backend primitives**.”

---

## Flutter / Dart

**What it is:** **Flutter** is Google’s **cross-platform UI toolkit**; **Dart** is the language you write Flutter apps in.

**Say:** “**Flutter** lets one codebase ship **iOS and Android**; I’m currently focused on **production maintenance** there.”

---

## Git / GitHub

**What it is:** **Version control** — history of code changes, branches, collaboration.

**Say:** “I work in **Git** daily — branches, reviews, incremental releases.”

---

## Vercel / Netlify

**What they are:** **Hosting and deployment** platforms for frontend/full-stack apps (especially Next.js on Vercel).

**Say:** “I deploy **Next.js** apps to **Vercel** — push to git, preview URLs, production deploys.”

---

## LLM / “AI APIs” (high level)

**What it is:** You send **text** (and sometimes files) to a provider; it returns **generated text**; you pay per usage and must handle **errors** and **privacy**.

**Say:** “I integrate **LLM providers** for product features, with **guardrails** — not blindly piping user data.”

---

## How your stack fits together (one paragraph you can say)

> “The **browser** runs **React**. **Next.js** runs on the **server** with **Node** to handle pages and server logic. **Prisma** is the layer between my **TypeScript** code and **Postgres**. **Supabase** provides **auth** and hosts that **Postgres** in practice. External services talk over **HTTP** using **REST-style APIs** — for example **AI** providers or other integrations.”

Tweak if your setup differs slightly; honesty matters more than perfect diagram.