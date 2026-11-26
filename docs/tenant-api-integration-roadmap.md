# Tenant API integration roadmap

Reviewed on 26 November 2026 against the supplied tenant integration guide, the [live tenant Swagger reference](https://api.dev.bakemyapp.appstopworkforce.com/docs/tenant/), and frontend source at commit `7b2c611`.

The original audit identified account activation and recovery, real Overview and Analytics data, rider deliveries, loyalty management, and customer support as the largest gaps.

**Implementation update on 26 November 2026:** work packages 1, 2, 4, 5 and 6 are implemented in the workspace. Setup/checklist progress and Plan details, Support FAQs/requests/live chats, Loyalty rules/rewards, and confirmed customer wallet credits are connected alongside the earlier account and reporting work. Current source coverage is **105 of 116 tenant operations**: the remaining **six implementation operations are the rider Deliveries workspace**, and five unused Business/Branding operations have equivalent functionality through Store Settings. Guide-only menu/branch extensions still require backend contract confirmation. The categories and counts below preserve the original audit snapshot. See [implementation details and verification](tenant-integration-implementation.md#setup-support-and-loyalty-update-26-november-2026).

All endpoint paths below are relative to `/v1/tenant`. An operation means one HTTP method and path. “Integrated” means a reachable frontend flow makes the request; it does not mean every response field has a screen or that the integration has passed live authenticated acceptance testing.

## Original audit coverage summary

The live Swagger contains **116 tenant operations**, plus two public operations. Its method and path inventory matches `docs/tenant-openapi.json`.

| Status | Tenant operations | Meaning |
| --- | ---: | --- |
| Called by existing frontend flows | 79 | Includes partially surfaced APIs such as Plan and notification preferences. |
| Category 1 — existing screens | 5 | Three existing data panels can be connected; two existing screens need new controls. |
| Category 2 — missing screens or sections | 27 | A new user flow, workspace, or settings section must be built. |
| Unused alternatives with equivalent functionality integrated | 5 | Business and Branding operations covered through Store Settings; no additional integration is necessary. |
| **Total** | **116** | **32 unused operations need implementation work.** |

The two requested categories describe the missing **feature surface**, not just whether any parent page exists. For example, the Overview page exists, but there is no setup checklist on it. Conversely, Customers already has a customer detail view where a wallet credit action can be added.

## Category 1 Endpoints with existing screens

### Existing panels that can be connected

| Feature and current frontend | Unused operation | Implementation work | Access |
| --- | --- | --- | --- |
| **Overview** — dashboard cards, bestsellers and operational summaries exist, but values and products are hardcoded. Time range buttons only change selection state. | `GET /overview` | Populate today's orders, sales, average order, comparisons, active orders, customer counts, seven-day series, top products and recent orders. Add supported support counters. Replace sample values and currency formatting. | Owner and manager |
| **Analytics** — a complete chart and metrics layout exists, backed by `ANALYTICS_DATA` fixtures. | `GET /analytics` | Connect `from`, `to`, optional `branchId`, and `groupBy`; map totals, series, customer mix, fulfilment, payment methods, branches, bestsellers, busiest hours and promo performance. Add loading, empty and error states. | Owner and manager |
| **Overview operational audit timeline** — existing card contains four invented events. | `GET /audit-logs` | Show a small page of real events, actor names, timestamps and readable changes. Hide the card and skip the request without `audit:view`. A full searchable log can be added later using the same operation. | Owner only |

Evidence: [Overview, navigation and timeline](../src/dashboard/DashboardScreen.jsx), [Analytics fixtures and chart](../src/dashboard/analytics/AnalyticsView.jsx).

**Overview needs a deliberate metric mapping.** `/overview` has fixed today and seven-day aggregates, with no date range parameters. Use `/analytics` for the Overview's `7d`, `30d`, `6mo` and `1y` selections, or simplify the controls and label the fixed periods. Neither response documents category sales share or fleet health. Remove those sample widgets, replace them with supported breakdowns, or agree an additional backend contract. The overview bestsellers contain name, quantity and sales, rather than the sample product price and stock columns.

**Analytics has a maximum range of 366 days.** The existing `LIFETIME` tab cannot be connected directly; remove or redesign it unless the backend adds support. Build `1Y` dates within the inclusive day limit. Treat comparisons with a `null` baseline as unavailable, use the bakery time zone for analytics dates, and respect the documented 30 requests per minute limit. The response does not directly provide the prototype's “Busiest Day” or a defined “Repeat Order Rate”; rename these to supported metrics or agree a precise derivation. `busiestHours` supports a busiest-hour metric.

Audit filters, if expanded beyond the card, are `action`, `entityType`, `entityId`, `from`, `to`, `page` and `limit`. Audit date filters use Karachi days. Team member detail already shows that person's `recentActivity`; this does not integrate the separate bakery-wide audit endpoint.

### Existing screens that need additional controls

| Feature and current frontend | Unused operation | Additional UI and behavior |
| --- | --- | --- |
| **My account name** — Settings has Account & Security with email and password; the sidebar shows the current name. | `PATCH /me` | Add a name field and Save action, submit `{ name }`, and update the session user so the sidebar changes immediately. Name editing also exists through Team's `PATCH /team/{memberId}` for permitted users; the dedicated self-service endpoint remains unused. This is a small account-settings extension. |
| **Credit a customer's wallet** — Customers list and detail already display wallet and points balances, but provide no credit action. | `POST /loyalty/customers/{customerId}/wallet-credit` | Add an owner-only amount and reason dialog to customer detail. Send integer minor units and explain that the customer sees the reason. Confirm the amount before submitting and refresh balances afterward. Handle `422 wallet_unavailable`; enabling the wallet depends on Category 2 loyalty settings. |

Evidence: [Account & Security](../src/dashboard/settings/SettingsView.jsx), [Customer list and detail](../src/dashboard/customers/CustomersView.jsx), [Team name editing](../src/dashboard/team/TeamForms.jsx), [session state](../src/dashboard/TenantSession.jsx).

**Category 1 total: 5 unused operations.** The profile and wallet rows require new controls, so they are not simply data-binding tasks.

## Category 2 Endpoints requiring new screens

### Account activation and password recovery

| Screen to build | Unused operation | Required behavior |
| --- | --- | --- |
| **Accept invitation** at `/accept-invite?token=...` | `POST /auth/accept-invite` | Name, password and confirmation; submit the email-link token. Store the returned access token in memory and enter the correct owner, manager, branch staff or rider workspace. Handle invalid, expired and already-used links. |
| **Forgot password**, linked from Sign in | `POST /auth/forgot-password` | Email form followed by the same neutral success message for every address. |
| **Reset password** at `/reset-password?token=...` | `POST /auth/reset-password` | Read the token from the URL, validate password and confirmation, handle invalid or expired tokens, and return to sign-in after success. |

These public authentication screens must be selected before the authenticated dashboard gate. `App.jsx` currently always renders `TenantSession`, and the only unauthenticated view is Sign in; merely opening an invitation or reset URL does not select a dedicated flow. Call these endpoints with `authenticated: false`, as login already does, so a bad link or public authentication error cannot trigger a tenant session refresh.

Evidence: [App entry](../src/App.jsx), [session gate](../src/dashboard/TenantSession.jsx), [Sign in](../src/dashboard/SignInPage.jsx), [router](../src/router.js).

### Setup and rider operations

| Screen or section to build | Unused operations | Required behavior |
| --- | --- | --- |
| **Setup checklist and onboarding banner** on Overview | `GET /setup` | Show progress and available steps; hide unavailable steps. Map the server's suggested routes to this app's actual navigation. Link business and branding to Settings and other steps to Branches, Menu, Payments and Team. Show the onboarding banner from `user.tenant.status`. Refresh completion after relevant saves. |
| **Rider delivery workspace** with Available, Mine and Done lists, summary badges and delivery detail | `GET /deliveries`; `GET /deliveries/summary`; `GET /deliveries/{deliveryId}` | Rider-only mobile layout scoped by the server to the rider's branch. Display customer name, call action, address, delivery instructions, items and prominent `amountDue`. Refresh active lists and badges every 15–30 seconds while visible. |
| **Rider pickup, completion and release dialogs** in that workspace | `POST /deliveries/{deliveryId}/pickup`; `POST /deliveries/{deliveryId}/delivered`; `POST /deliveries/{deliveryId}/release` | Take a job, confirm handover and cash collection, or return it with the required reason. Handle another rider claiming the job with 404/409 and reload. A card order with `amountDue: 0` requires no cash collection. |

There is no checklist UI, despite Settings already allowing an unchanged store to be confirmed. The guide's later Payments section says all checklist steps now exist, so use the current server's `available`, `progress` and `complete` rather than perpetuating the guide's earlier temporary completion workaround.

Riders currently receive a message saying to use a separate Deliveries portal; this repository has no such portal. Extend the session gate and navigation to recognize `deliveries:manage`, and give riders their own workspace without requesting owner/manager APIs. Branch staff already have their Orders workspace and do not need it rebuilt.

### Loyalty and support

| Screen or section to build | Unused operations | Required behavior and access |
| --- | --- | --- |
| **Loyalty rules** | `GET /loyalty`; `PATCH /loyalty` | Owner-only wallet and points enablement, points per major currency unit, point value in minor units, and streak bonus. Both features start off. This enables the Category 1 customer wallet credit flow. |
| **Rewards management** | `GET /loyalty/rewards`; `POST /loyalty/rewards`; `PATCH /loyalty/rewards/{id}`; `DELETE /loyalty/rewards/{id}` | Owner-only reward list and editor for title, description, points cost, active state and display order, with deletion confirmation. |
| **FAQ management** | `GET /support/faqs`; `POST /support/faqs`; `PATCH /support/faqs/{id}`; `DELETE /support/faqs/{id}` | Owner/manager question and answer editor, enable/disable, ordering and deletion. These questions appear in the customer app. |
| **Support request inbox and detail** | `GET /support/tickets`; `GET /support/tickets/{id}`; `POST /support/tickets/{id}/reply` | Owner/manager paginated inbox filtered by status and type; show customer, order, message and optional image. A single reply closes the request; handle `422 ticket_closed` and remove the reply control for closed tickets. |
| **Customer chat inbox and conversation** | `GET /support/chats`; `GET /support/chats/{customerId}`; `POST /support/chats/{customerId}/messages`; `GET /support/chats/stream` | Owner/manager conversation list, `needsReply` indicators, message history, composer and live customer messages. Support incremental fetch with `after`, deduplicate messages, and reload on entry and stream disconnection. |

None of these feature screens or sidebar destinations exist. Customer balance displays and Overview sample content do not provide loyalty configuration or support workflows.

**Chat needs a streaming transport.** The shared API client always parses JSON and times out after 20 seconds; it cannot consume this server-sent event stream as written. Add an authenticated streaming request that shares token renewal and session-expiry behavior, handles `ready` and `message` events, and closes on navigation/logout. Browser `EventSource` cannot directly set the existing Bearer header, so use a fetch-based stream or confirm a supported alternative with the backend. Reload the list after a stream drop because the API documents event propagation within one server.

**Category 2 total: 27 unused operations** — authentication 3, setup 1, deliveries 6, loyalty rules and rewards 6, and support 11. Wallet credit is counted only in Category 1.

### Missing Plan screen using an already called endpoint

`GET /plan` is **partially integrated**, not an unused endpoint. Branches reads `usage.branches` to show capacity and disable Add Branch at the limit. There is no owner-facing Plan or Subscription section.

Build a read-only section showing plan name and description, price and interval, trial end, next renewal, subscription status, cancellation date, payment-problem warning and branch/team usage. Display a null price as Custom and a null branch limit as Unlimited. Plan or payment-card changes go through Bake My App staff; this API does not provide self-service subscription editing. This screen adds no new operation to the counts above.

Evidence: [Current branch-capacity integration](../src/dashboard/branches/BranchesView.jsx), [available dashboard destinations](../src/dashboard/DashboardScreen.jsx).

## Existing integrations to preserve

| Module | Called operations | Existing coverage |
| --- | ---: | --- |
| Session and identity | 7 | Login, refresh, logout, profile read, password change, branding read and colour presets. |
| Branches and plan | 8 | Branch list/detail/create/edit/deactivate, hours, pause/resume and plan-capacity lookup. |
| Menu | 23 | Category CRUD and ordering; products, sizes, add-ons, branch availability and photos; add-on groups and options. |
| Orders | 4 | List, summary, detail and status changes, including branch staff restrictions and dispatch rider selection for permitted users. |
| Payments | 5 | Payment methods and Stripe key save/remove/test. |
| Team | 9 | Members, roles, invitation list/send/revoke, member edits, session revocation and unlock. Invitation acceptance is the missing counterpart. |
| Pricing and discounts | 11 | Pricing rules, promo codes and quantity discounts. |
| Customers | 2 | Directory and detailed customer read. |
| Store Settings | 10 | Combined store read/save/logo, global hours, order settings and personal notification preferences. Password change is counted under identity. |
| **Total** | **79** | Source-level request coverage. |

### Unused alternative operations that do not need duplicate screens

| Unused operation | Existing equivalent |
| --- | --- |
| `GET /business` | `GET /store` returns the business fields used by Settings. |
| `PATCH /business` | `PATCH /store` saves those fields. |
| `PATCH /branding` | `PATCH /store` saves brand colour, app name and currency symbol. |
| `POST /branding/logo` | `POST /store/logo` uploads the logo. |
| `DELETE /branding/logo` | `DELETE /store/logo` removes it. |

The guide explicitly keeps both API families available. Continue using the combined Store Settings APIs; these five absent direct calls are not five missing product features. `GET /branding` itself is already called by the session.

### Partial behavior behind already integrated APIs

- **Notifications:** `GET` and `PATCH /notification-preferences` load and save all six switches, but Orders does not read those preferences or play a new-order chime. Wire supported in-panel alerts to the saved per-user preferences. Daily/weekly summary and low-stock emails are explicitly not implemented by the backend; the saved switches do not activate those services.
- **Branch and order reporting:** existing screens already calculate sales and performance from paginated Orders data and use Orders summary. They are not wholly unintegrated. Consider using `/analytics` for owner/manager aggregates once metrics are agreed, while retaining the branch staff flow: branch staff cannot call Analytics. Current collected-revenue calculations and the API's non-cancelled-sales definition differ, so keep labels and calculations consistent.
- **Plan:** branch capacity is connected; the missing subscription display is described in Category 2.

## Guide and Swagger differences requiring backend confirmation

The guide's section 13b describes capabilities that the live Swagger does not fully specify. Do not invent request contracts or treat these as confirmed missing Swagger operations.

| Capability mentioned in the guide | Frontend state | Contract issue and next action |
| --- | --- | --- |
| Category icon upload: `POST /menu/categories/{categoryId}/icon` | Category forms have no upload control. Category icons are chosen locally from defaults or stored preferences. | No such path exists in live Swagger. Confirm deployment, supported file types, payload and response before extending the category editor. |
| Product suggestions: `/menu/products/{productId}/suggestions` | No suggestion picker exists. | No such path or methods exist in Swagger. Agree read/write methods, ordering and eligible products before building a section in the product editor. |
| Product allergens, calories, per-product preparation time and `compareAtPrice` | Core product editing works; preparation time is displayed read-only and the other fields have no controls. | The guide says these fields are supported, but Swagger's product write examples and response definitions omit them; PATCH documents only the core fields. Obtain the actual field names, validation and response shapes. Extend existing product forms once confirmed. |
| Branch coordinates, individual delivery radius and delivery options such as Express | Basic branch settings work; Settings already saves a shared delivery radius. No coordinate or delivery-option controls exist. | Swagger documents the shared radius through `/order-settings`, but does not fully describe these additional per-branch fields. Confirm the Branch POST/PATCH contracts before extending BranchForm. |
| Branch staff selecting a dispatch rider | Owner/manager rider selection works through `GET /team`; branch staff cannot use that lookup. | The guide permits rider assignment, but Team requires permissions branch staff do not have. Agree an authorized branch-scoped rider lookup. Keep dispatch without selection available meanwhile. |

The guide's statement that “everything” is built describes backend delivery and does not establish frontend completion. The earlier implementation notes also predate some APIs: Overview and Analytics now have live endpoints, and Team already has a frontend.

Two-factor authentication, inventory counts, campaign email delivery and manual-refund acknowledgement are not documented tenant operations to integrate. Login email remains read-only. A full audit-log page with filters is a useful later extension of the existing timeline, not a second missing endpoint.

## Recommended implementation sequence

| Order | Work package | Completion criteria |
| --- | --- | --- |
| **1 — Account access** | Accept invitation, forgot password and reset password; add public route handling and the Sign in recovery link. | An invited owner/manager/branch staff member can activate and enter the correct existing workspace. A rider can activate and retain a valid session pending its workspace. Expired links and password reset are handled end to end. |
| **2 — Replace sample reporting** | Overview and Analytics; owner audit timeline; self-service name editing; supported alert preferences. | Reports load backend values with correct dates, units, comparisons and permissions. No sample financial figures or audit events remain in live views. Unsupported lifetime/category/fleet widgets are resolved explicitly. |
| **3 — Rider operations** | Rider session routing, delivery lists and detail, badges, pickup/delivered/release flows. | A rider sees only its branch's jobs, can complete or release one, sees the correct cash amount and handles competing claims. Other roles continue using Orders. Prioritize this before rollout wherever riders are part of the launch. |
| **4 — Bakery setup and subscription visibility** | Checklist/banner and the read-only Plan section. | Steps link to actual screens, refresh after saves and reflect server completion. Owners can see subscription status and payment warnings. |
| **5 — Customer support** | FAQ editor, ticket inbox/reply, then chat with authenticated streaming. | Owners/managers manage help content, close requests through one reply and receive live customer messages with recovery after disconnection. Overview counters link into these screens. |
| **6 — Loyalty** | Rules and rewards first, then the customer wallet credit dialog. | Owner can enable and configure loyalty, manage rewards and credit a customer with a visible reason; balances refresh and disabled-wallet errors are handled. |
| **Contract track** | Resolve guide-only menu/branch capabilities and the branch-staff rider lookup in parallel with the packages above. | Confirmed API contracts become scoped additions to existing forms; absent or undeployed APIs stay out of frontend completion estimates. |

For every package, reuse the existing in-memory access token, single-flight refresh, credentialed requests, permission checks, field-error rendering, raw-image upload handling and integer-money conversions. Add focused fixture/browser coverage for each new user journey, then perform live acceptance with owner, manager, branch staff and rider accounts as applicable. Do not retry a wallet credit automatically after an uncertain network result without a backend idempotency contract.

## Scope and verification

This is a source and API-contract audit. The live Swagger page and its embedded OpenAPI document were retrieved, all 32 unused implementation operations and five unused alternatives were checked against the live method/path inventory, and existing calls were traced through the session, screen components and shared wrappers. No live tenant data was changed. Authenticated behavior and response shapes that Swagger leaves unspecified still need acceptance testing.

Public `GET /v1/assets/{assetId}` is consumed through returned logo/photo URLs in image elements; it needs no management screen. Public `GET /v1/app/config` belongs to customer-app startup, not a required tenant-panel integration. A future customer-app preview could consume it, but it is excluded from this tenant implementation backlog.

Source references: [supplied integration guide](../../../Downloads/tenant-integration.md), [live tenant API reference](https://api.dev.bakemyapp.appstopworkforce.com/docs/tenant/), [repository OpenAPI snapshot](tenant-openapi.json), and [previous integration notes](tenant-integration-implementation.md). Frontend evidence is linked beside each feature above.
