# Tenant module integration

Implemented against the tenant integration guide supplied with this task and the live [tenant API reference](https://api.dev.bakemyapp.appstopworkforce.com/docs/tenant/), retrieved on 2026-11-23. `tenant-openapi.json` is a snapshot of the Swagger schema used for the integration; the live reference remains authoritative.

Stripe examples in the snapshot use `YOUR_STRIPE_SECRET_KEY` and `YOUR_STRIPE_PUBLISHABLE_KEY` placeholders. Preserve these placeholders when updating the snapshot; do not copy credential-shaped examples from Swagger into the repository.

## Running the panel

1. Copy `.env.example` to `.env.local` and set `VITE_API_URL` to the backend origin, without `/v1/tenant`.
2. Run `npm run dev` and open `http://localhost:5174/`. The root URL and legacy `/app` URL open sign-in directly; `/?dashboard` remains compatible.
3. Sign in with an existing bakery owner, manager, or branch-staff account. No credentials are bundled.

The backend must allow the panel origin in `TENANT_CORS_ORIGINS`. For localhost calling the remote dev API, the guide requires `ADMIN_COOKIE_SAME_SITE=none` so the refresh cookie can cross sites. Browser third-party-cookie settings also apply.

Tenant data now comes from the API. Old mock orders and browser-stored menu/branch data are not used or silently uploaded. The onboarding setup page has been removed; authenticated users enter the dashboard directly. Other modules retain their existing behavior.

## Implemented endpoint coverage

All paths below are relative to `/v1/tenant`.

| Feature | Endpoint(s) | UI connection |
| --- | --- | --- |
| Session | `POST /auth/login`, `/auth/refresh`, `/auth/logout`; `GET /me` | Dashboard sign-in, reload restore, shared refresh, permissions, user/branch header, sign-out |
| Currency | `GET /branding` | Bakery currency symbol for Menu and Branches; Orders use their own saved symbol |
| Branch list | `GET /branches` | Active/inactive/all tabs and name/area/city search; actual server open/closed/paused state |
| Branch detail | `GET /branches/:id` | Load current details/hours before editing |
| Branch changes | `POST /branches`, `PATCH /branches/:id` | Required address/city; delivery/pickup; fees, minimum order and preparation time; changed fields only; reactivate |
| Branch removal | `DELETE /branches/:id` | Confirmed switch-off; retained history and inactive tab |
| Pause | `POST /branches/:id/pause` | Confirmed pause and resume, separate from open/closed hours and activation |
| Hours | `PUT /branches/:id/hours` | Whole week; closed-day payloads omit times; copy Monday to all days/weekdays; opens automatically after branch creation |
| Plan capacity | `GET /plan` | Owner's branch usage and capacity; managers rely on branch API's plan-limit validation |
| Branch queue | `GET /orders/summary?branchId=…` | Per-card active order count; View orders carries the branch filter |
| Categories | `GET /menu/categories`, `GET /menu/categories/:id`, `POST /menu/categories`, `PATCH /menu/categories/:id`, `DELETE /menu/categories/:id` | Lists, counts, name/description editor, switch-off/reactivation |
| Category order | `PUT /menu/categories/order` | Drag categories to reorder; send the complete visible category ID order |
| Products | `GET /menu/products`, `GET /menu/products/:id`, `POST /menu/products`, `PATCH /menu/products/:id`, `DELETE /menu/products/:id` | Server paging; category/search/status/branch filters; create/edit/move products; switch-off/reactivation; sizes show a “From” price |
| Product order | `PUT /menu/products/order` | Move-up buttons on the first unfiltered page; submitted IDs move first, with omitted products following as documented |
| Sizes | `PUT /menu/products/:id/sizes` | Named size prices, retained existing IDs, add/remove sizes, conversion back to a single price |
| Product extras | `PUT /menu/products/:id/addon-sets` | Choose reusable active add-on groups |
| Product branches | `PUT /menu/products/:id/branches` | Selling-branch checkboxes converted to `unavailableBranchIds`, as required by the API |
| Product photo | `POST`, `DELETE /menu/products/:id/photo` | Validated PNG/JPEG/WebP raw binary upload and confirmed removal; no multipart/JSON upload |
| Add-on groups | `GET /menu/addon-sets`, `GET /menu/addon-sets/:id`, `POST /menu/addon-sets`, `PATCH /menu/addon-sets/:id`, `DELETE /menu/addon-sets/:id` | Group list/editor, required/maximum picks, switch-off/reactivation |
| Add-on options | `PUT /menu/addon-sets/:id/options` | Replacement list preserving IDs, extra prices, available/sold-out flags, addition/removal |
| Orders board | `GET /orders`, `GET /orders/summary` | Status counts, active/history/completed/cancelled/all views, search, branch, fulfilment, payment method/status, date range, sort and server pagination |
| Order detail | `GET /orders/:id` | Customer/address/instructions, order and line notes, sizes/extras, saved prices, payment reference, cancellation reason and server event timeline |
| Order changes | `POST /orders/:id/status` | Exactly the server's `nextStatuses`; acceptance time, cancellation reason, preparation, ready, dispatch, complete; cash collection wording |
| Rider selection | `GET /team?role=rider&branchId=…&status=active` | Paginated branch-rider picker for owners/managers dispatching an order |
| Refunds | `GET /orders/summary`, `GET /orders?paymentStatus=refund_failed` | Refunds-needed badge/filter and manual Stripe refund instructions/reference |

The board, summary, open detail, and branch queue counts refresh every 20 seconds while visible. Background tabs pause polling and refresh when visible again. A 403 or 429 stops automatic polling for that resource; a manual refresh or changed filter can retry. Order conflicts (409 or a 422 on `status`) explain that the order changed and reload current data.

Access tokens stay in memory. Requests include credentials and bearer tokens, concurrent 401s share one refresh request, and a failed refresh returns the user to sign-in. Branch staff only see Orders, with no branch filter or calls to forbidden Menu, Branches, Branding, Plan, or Team routes. Riders are directed to their separate deliveries portal; creating that portal is outside these three modules.

Money inputs convert major units to integer minor units, and displays divide by 100. The client preserves API messages, displays nested validation errors next to their fields and in the error summary, and keeps forms open on failed saves. Separate product and add-on sections save independently.

## UI features without a matching documented API

These are gaps in the current guide/Swagger, not invented frontend endpoints.

| Existing UI feature | API limitation / handling |
| --- | --- |
| Menu category icon picker | Categories have no `icon` field or icon endpoint. The API-backed category editor offers supported name/description fields. |
| Per-product preparation time | Products have no preparation-time field. Preparation time is configured on each branch with `prepTimeMinutes`. |
| Global product “In Stock / Sold Out” | No global product stock quantity or stock-state endpoint exists. Product activation and per-branch availability are supported and shown with their actual meanings. Add-on options separately support `isAvailable`. |
| Branch code / auto-generated code | Branches have no `code` field or generation endpoint. |
| Branch employee username/password | Branch endpoints cannot create or reveal credentials. Staff accounts use Team email invitations and roles/branch assignments, not a shared branch password. A Team management UI is outside this task. |
| Branch sales, performance percentage, fleet health and fulfilment metrics | No branch analytics endpoint exists. Active order counts use the documented Orders summary. |
| Dashboard overview revenue, bestsellers, category share and trend comparisons | No analytics/aggregate reporting endpoints exist in this reference. Existing overview data remains a prototype. |
| Customers list, customer statistics and loyalty points | No tenant customer-management or loyalty endpoints exist. This screen remains a prototype. |
| Promo & Discounts / campaign creation, audience, open/click rates | No campaign, coupon or promotional reporting endpoints exist. This screen remains a prototype. |
| Analytics graphs, repeat rate and top sellers | No analytics/reporting endpoints exist. This screen remains a prototype. |
| Settings delivery radius, tax configuration, notification preferences, email change and two-factor authentication | No matching tenant configuration endpoints exist. Some other Settings fields have Business/Branding/Me/Branch equivalents, but the Settings module was outside the requested scope and remains unchanged. |
| Marking a manually refunded order as resolved | Failed refunds can be listed and their Stripe reference viewed, but no endpoint acknowledges a manual refund or clears `refund_failed`. The owner must refund through Stripe. |

There is also a permissions mismatch in the guide: it says branch staff may name a rider, but the documented rider lookup (`GET /team`) requires `team:view`, which branch staff do not have. The Orders UI lets them dispatch without selecting a rider and does not call the forbidden Team endpoint. A branch-scoped rider lookup is needed to offer that picker to branch staff.

The implementation does not persist unsupported fields or show mock sales, stock, credentials, or timeline times within the three integrated modules.

## Verification

- `npm test`: API client regression tests for concurrent and late 401s, failed refresh, retry limits, validation errors, raw upload bodies, request methods, public-request isolation, money, permissions and query encoding.
- `npm run test:browser`: real React screens in headless Chrome/Edge against a local fixture backend, without live API writes. Covers login, menu/category creation, size ID preservation, add-on and branch assignments, photo upload/removal, add-on option pricing, branch creation/hours/pause, order detail/acceptance/conflict/dispatch/cash collection, polling/search, required cancellation reasons, failed-refund filters/payment references, and branch-staff access.
- `npm run lint` and `npm run build`.

For browser checks, Chrome/Edge must be installed, or `CHROME_PATH` must point to a compatible Chromium executable. The browser and fixture servers run locally; restricted environments may need permission for local debugging connections.

Live authenticated acceptance testing still requires actual tenant accounts and working CORS/cookie configuration. No credentials were supplied and no live bakery records were modified.
