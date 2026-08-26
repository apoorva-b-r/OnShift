# Setu Account Aggregator (AA) Consent Flow Tester

A minimal, isolated full-stack sandbox app to test Setu's Account Aggregator (AA) consent workflow for gig-worker income verification.

## Folder Structure

```
setu-aa-test/
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── README.md
└── public/
    ├── index.html
    └── consent-callback.html
```

## Setup & Running

1. Navigate to the isolated folder:
   ```bash
   cd setu-aa-test
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your credentials in `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your Setu sandbox credentials:
   - `SETU_CLIENT_ID`
   - `SETU_CLIENT_SECRET`
   - `SETU_AA_ID` (default: `setu-aa`)
   - `SETU_FIU_ID`
   - `SETU_BASE_URL` (default: `https://fiu-sandbox.setu.co`)
   - `PORT` (default: `4000`)

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser:
   [http://localhost:4000](http://localhost:4000)

## Workflow

1. Enter a mobile number (e.g. `9999999999`) on `http://localhost:4000` and click **Link Bank Account**.
2. The app calls `POST /api/create-consent`, which reaches out to Setu's `/consents` endpoint with underwriting purpose code `103`, 3-month periodic fetch range, and `redirectUrl`.
3. The app redirects to Setu's Anumati consent approval portal (`https://anumati.setu.co/{consentHandle}?redirect_url=...`).
4. Upon completing or rejecting consent on Anumati, Setu redirects back to `http://localhost:4000/consent-callback.html`.
5. The callback page displays returned query parameters and lets you check the real-time consent status via `GET /api/consent-status/:consentHandle`.

## Deletion / Cleanup

This test app is completely self-contained. To clean it up completely when you are done, simply delete the `setu-aa-test` folder:
```bash
rm -rf setu-aa-test
```
