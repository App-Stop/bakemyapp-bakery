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
| Customers | Integrated with `/customers` and `/customers/:id`: server search, sorting, paging, balances and customer details. |
| Promo & Discounts | Uses the new Pricing promo-code screens. Campaign emails, audience and open/click rates are outside the pricing API. |
| Analytics graphs, repeat rate and top sellers | No analytics/reporting endpoints exist. This screen remains a prototype. |
| Store Settings | Integrated with `/store`, `/store/logo`, `/hours`, `/order-settings`, `/notification-preferences` and `/me/change-password`. Login email is read-only; two-factor authentication is unavailable and hidden. |
| Marking a manually refunded order as resolved | Failed refunds can be listed and their Stripe reference viewed, but no endpoint acknowledges a manual refund or clears `refund_failed`. The owner must refund through Stripe. |

There is also a permissions mismatch in the guide: it says branch staff may name a rider, but the documented rider lookup (`GET /team`) requires `team:view`, which branch staff do not have. The Orders UI lets them dispatch without selecting a rider and does not call the forbidden Team endpoint. A branch-scoped rider lookup is needed to offer that picker to branch staff.

The implementation does not persist unsupported fields or show mock sales, stock, credentials, or timeline times within the three integrated modules.

## Verification

- `npm test`: API client regression tests for concurrent and late 401s, failed refresh, retry limits, validation errors, raw upload bodies, request methods, public-request isolation, money, permissions and query encoding.
- `npm run test:browser`: real React screens in headless Chrome/Edge against a local fixture backend, without live API writes. Covers login, menu/category creation, size ID preservation, add-on and branch assignments, photo upload/removal, add-on option pricing, branch creation/hours/pause, order detail/acceptance/conflict/dispatch/cash collection, polling/search, required cancellation reasons, failed-refund filters/payment references, and branch-staff access.
- `npm run lint` and `npm run build`.

For browser checks, Chrome/Edge must be installed, or `CHROME_PATH` must point to a compatible Chromium executable. The browser and fixture servers run locally; restricted environments may need permission for local debugging connections.

Live authenticated acceptance testing still requires actual tenant accounts and working CORS/cookie configuration. No credentials were supplied and no live bakery records were modified.

## Customers, Store Settings and Pricing update (24 November 2026)

The OpenAPI snapshot was refreshed from the live tenant Swagger document. Customers, Store Settings, Pricing Rules, Promo Codes and Quantity Discounts now use authenticated tenant endpoints. Managers do not request owner-only pricing, promo-code or order-settings resources. Quantity discounts use menu view/edit permissions. Store writes require both business and branding edit permissions.

Settings saves only changed sections, preserves mixed branch values until edited, reports partial failures, and retains failed drafts for retry. Money converts to whole minor units; radius is explicitly in kilometres. Hours replace a complete seven-day week on all active branches or the selected branch. Logos upload as the original binary with type, size and dimension validation, with palette suggestions sampled locally. Password changes replace the in-memory access token.

`npm run test:commerce` runs Chrome/Edge against a local API fixture, covering customer browsing/search/sort/paging, partial save recovery, hours, logo upload/removal, password changes, pricing rules, promo creation/edit/activation, quantity discounts, manager restrictions and responsive screenshots. `npm test` includes payload and currency-conversion regressions.

The API documents no response schemas for customer detail, promo-code or quantity-discount detail/list bodies. These screens follow the guide's named fields and conventional data arrays; the customer view also accepts a nested `stats` object. Live authenticated acceptance testing remains necessary to verify those undocumented response shapes. No tenant credentials were supplied and no live records were modified.

Loading placeholders use the shared `Skeleton` and `SkeletonRows` components, with shapes for tables, product lists, cards, metrics, settings and detail panels. Background polling retains existing data; skeletons are decorative, non-interactive and identified by accessible status labels. The shimmer respects `prefers-reduced-motion`. `npm run test:skeletons` checks session restoration and module loading against delayed local responses, including mobile sizing, background refresh and reduced motion.

## Account access and reporting update 26 November 2026

The first two work packages in [the tenant API roadmap](tenant-api-integration-roadmap.md) are implemented. The dashboard's existing navigation, card grids and responsive layout remain in place. New account screens share the existing Sign in layout, assets, colours and form components.

| Operation | Frontend behavior |
| --- | --- |
| `POST /auth/accept-invite` | `/accept-invite?token=...` accepts an optional name and a confirmed password, stores the returned session in memory and selects the existing role-appropriate landing view. |
| `POST /auth/forgot-password` | Sign in links to `/forgot-password`; success uses the same neutral message for every email address. |
| `POST /auth/reset-password` | `/reset-password?token=...` validates confirmation and submits the token/password, clears local session state after success, and returns to Sign in. |
| `GET /overview` | Live kitchen/customer/support counts and recent orders; the existing bestsellers card can switch to recent orders. |
| `GET /analytics` | Overview date selections and Analytics use bakery-local dates and integer-money conversions, with branch/grouping controls and selectable branch/fulfilment/payment/status/promo breakdowns. |
| `GET /audit-logs` | The existing owner timeline shows real actors, actions and changes; staff identity stays “Bake My App team.” Managers neither see the card nor request it. |
| `PATCH /me` | Your name in Account & Security saves through Save Changes and updates the sidebar immediately; failed edits remain available for retry. |

Public invitation/recovery routes skip session restoration and explicitly omit Bearer authentication. Password validation messages remain attached to their fields; missing, expired and used links have recovery guidance. A successful invitation or password reset removes the email token from the URL. The invitation response provides the user for role routing, so activation does not depend on a second successful profile request.

Existing `GET /store`, `GET /branches`, and `GET`/`PATCH /notification-preferences` support these flows. Orders uses the saved new-order and status-update preferences; its chime becomes available after a user gesture. No extra alert requests are made for branch staff. Notification email delivery remains subject to the backend limitations described above.

Reporting uses supported measures in the original card positions: active orders/customer totals replace sample fleet/velocity metrics, and branch sales replace undocumented category share. The LIFETIME pill stays in its existing position but is disabled with an explanation of the 366-day limit. Bestsellers show a dash for current price and availability because the reporting contract does not return them. Date selections keep older responses from being presented as the newly selected period. Rate-limit failures require a manual retry, and empty reports render without sample values.

`npm run test:accounts-reporting` runs account and reporting journeys in Chrome/Edge against local fixtures, including public route isolation, missing/expired links, confirmation/field errors, activation for all four roles, session restore, live metrics, audit privacy, dates and filters, rate limits, empty reports, profile save/retry and desktop/mobile screenshots. `npm test` includes calendar boundaries, chart scaling, audit rendering and public API isolation. The existing sign-in, commerce and full module browser regressions also pass. Live authenticated acceptance with real tenant accounts remains necessary; no live tenant records were changed.

## Setup support and loyalty update 26 November 2026

Roadmap packages 4, 5 and 6 add Bakery setup, Your plan, Support and Loyalty destinations using the existing dashboard layout, cards, form controls and modal style. These packages connect 19 previously unused tenant operations and expand the existing Plan integration.

| Feature | Operations relative to `/v1/tenant` | Behavior |
| --- | --- | --- |
| Setup | `GET /setup` | Shared progress on Overview and a dedicated checklist; hides unavailable steps, identifies optional steps and links to the existing feature screens. Refreshes after successful business/branding/branch/menu/payment/team saves, when entering or leaving setup/overview, and on manual refresh. The onboarding banner distinguishes completed setup from bakery activation. |
| Plan | `GET /plan` | Owner-only subscription price in its billing currency, status, trial/renewal/cancellation dates, payment warning, branch capacity and team usage. Custom pricing and unlimited capacity are supported. Plan changes remain with Bake My App staff. |
| FAQs | `GET`, `POST /support/faqs`; `PATCH`, `DELETE /support/faqs/{id}` | Owner/manager question editor, app visibility, display position and confirmed deletion. Failed edits retain their drafts. |
| Requests | `GET /support/tickets`; `GET /support/tickets/{id}`; `POST /support/tickets/{id}/reply` | Paged inbox with status/type filters, customer/order context and optional picture; one reply closes a request. Closed-request conflicts reload current details and remove the reply form. |
| Chats | `GET /support/chats`; `GET /support/chats/{customerId}`; `POST /support/chats/{customerId}/messages`; `GET /support/chats/stream` | Owner/manager conversation inbox, needs-reply indicators, paged history via `after`, message composer, deduplication and live customer messages. Overview counters link directly to the relevant Support tab. |
| Loyalty rules | `GET`, `PATCH /loyalty` | Owner-only wallet/points enablement, earning rate, per-point wallet value and streak bonus; changed fields only, with minor-unit conversion. |
| Rewards | `GET`, `POST /loyalty/rewards`; `PATCH`, `DELETE /loyalty/rewards/{id}` | Owner-only reward list, create/edit, visibility, points cost, display position and confirmed deletion. |
| Wallet credit | `POST /loyalty/customers/{customerId}/wallet-credit` | Owner-only customer-detail action checks wallet availability, reviews the amount and customer-visible reason before submitting, then reloads customer and directory balances. Uncertain network/server outcomes disable resubmission and direct the owner to check the balance/activity log. |

The chat stream uses authenticated fetch with credentials and the existing shared refresh queue. Its handshake has the normal request timeout; an established stream is not stopped by the JSON client's 20-second timeout. Stream parsing supports split UTF-8/CRLF frames, comments and multiline events. The client reloads the inbox and catches up the selected conversation on ready/message/disconnection, reconnects after network failures, pauses in background tabs, and aborts on navigation/logout. A 401 can refresh once; terminal 401/403/429 responses stop automatic reconnects. Manual refresh/reconnect remains available.

Managers can use setup and Support but do not request owner-only Plan/Loyalty APIs or see wallet-credit controls. Branch staff keep their Orders-only navigation and do not request any new protected feature area. Rider deliveries remain the separate, unimplemented roadmap package 3.

`npm run test:engagement` exercises the new React screens in a real local browser: setup routing/completion, subscription states, loyalty conversions, reward/FAQ CRUD, wallet review/success/uncertain outcomes, request replies/conflicts, chat history and live messages, stream authentication, connections lasting beyond 20 seconds, rate-limit recovery, cleanup, role restrictions and mobile screenshots. Unit tests cover money/rule validation, navigation, stream parsing, message merging and shared token renewal.

The live Swagger was checked before implementation. It still leaves FAQ, ticket, reward and chat success response bodies largely unspecified; those views follow the guide's named fields and accept direct arrays or named collection wrappers. Live authenticated acceptance is needed to confirm those response bodies, production streaming/CORS behavior and email delivery. No live tenant data was changed.
