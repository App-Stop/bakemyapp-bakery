# Bake My Panel

Standalone bakery owner panel extracted from bake-my-app. Includes store setup and the overview, menu, branches, orders, customers, promotions, analytics, and settings screens.

Run npm ci, copy .env.example to .env.local, then run npm run dev (port 5174). Use npm run build for production and npm run preview to serve the build. Deploy the project root with the included Vercel SPA rewrites.

The root URL and legacy /app URL both open setup; after Launch my Store the owner dashboard opens. Use /?dashboard for the existing dashboard shortcut. Home and privacy links use VITE_MARKETING_URL. Shop setup lead submission uses VITE_API_URL.

Menu, Branches and Orders now use the tenant API, with dashboard sign-in, in-memory bearer tokens, cookie-based session restoration and automatic refresh. Set VITE_API_URL to the backend origin and open /?dashboard to sign in. Existing onboarding and the other dashboard modules retain their prototype behavior. Old menu/branch browser data is not uploaded automatically.

Run npm test for API regression checks and npm run test:browser for local headless Chrome/Edge checks against mock responses. No live records are changed by these tests. See [the integration report](docs/tenant-integration-implementation.md) for endpoint coverage, environment requirements, unsupported UI features, and validation details.
