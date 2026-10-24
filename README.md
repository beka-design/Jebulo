# JEBULO (ጀቡሎ) - Ethiopian Digital Product Marketplace

> **"Everything Digital. One Marketplace."**  
> *ጀቡሎ - የኢትዮጵያ ዲጂታል ምርቶች መገበያያ*

JEBULO is a production-minded, responsive full-stack digital product marketplace built specifically for Ethiopia. It empowers independent creators to sell digital products, e-books, online courses, software, graphic design assets, business spreadsheets, music/audio, architectural CAD/BIM models, and creative resources. Customers purchase securely in Ethiopian Birr (ETB), downloads are protected, and the marketplace retains a configurable **12% commission** on completed sales.

---

## 1. Core Architecture & Tech Stack

- **Frontend**:
  - React 18 + TypeScript + Vite 6
  - Tailwind CSS with Ethiopic font integration (`Noto Sans Ethiopic` & `Inter`)
  - React Router DOM v6
  - Firebase Web SDK (v10)
  - Custom English/Amharic localization context (`en.ts` / `am.ts`) with zero paid external dependencies
- **Backend & Cloud Infrastructure**:
  - Firebase Authentication (Email/Password, custom claims for roles: `buyer`, `creator`, `admin`)
  - Cloud Firestore (Multi-collection scalable structure with strict role-based `firestore.rules`)
  - Cloud Functions for Firebase (Chapa checkout initialization, webhook handling with HMAC verification, server-side transaction verification, and short-lived signed URLs for protected downloads)
  - Firebase Storage (`public/` for previews and `protected/` for paid downloadable packages)
  - Cloudinary integration for public preview transformations and thumbnails
  - Firebase Hosting
- **Payment Gateway**:
  - **Chapa** (Ethiopia's premier payment gateway supporting Telebirr, CBE Birr, Awash Birr, and Visa/Mastercard debit/credit cards in ETB)

---

## 2. Platform Roles & Workflows

### A. Buyer
- Browse all categories dynamically managed in Firestore.
- Real-time search, price filters, category pills, and sorting.
- Add products to favorites.
- Checkout in ETB via Chapa.
- Instant access to verified downloads in **My Library** (`/library`).
- Download files through temporary, server-authorized access sessions.
- Submit ratings and reviews (restricted to verified purchasers).
- Report questionable products.
- Switch seamlessly between English and Amharic.

### B. Creator / Seller
- Apply to sell on JEBULO via the **Become a Seller** portal (`/become-seller`).
- Enter payout details: Telebirr mobile number, CBE account number, or Awash Bank account.
- Sign intellectual property & copyright warranty declaration.
- Access the **Creator Studio** (`/creator`):
  - Upload digital product packages (ZIP/PDF up to 250MB) to private protected storage.
  - Upload public cover images and previews.
  - Set product details, license terms (Personal, Commercial, Extended), and price in ETB.
  - Submit drafts for administrator review.
- Financial Tracking:
  - Real-time Gross Sales vs 12% Platform Commission vs 88% Net Earnings.
  - Request manual payouts (minimum threshold: 500 ETB) to Telebirr or CBE.

### C. Administrator
- Access protected **Admin Portal** (`/admin`):
  - **Product Review**: Approve, reject with creator feedback, or suspend products.
  - **Creator Applications**: Review applicants and approve/reject with feedback.
  - **Dynamic Categories**: Add, edit, reorder, and organize categories in Firestore without touching frontend code.
  - **Orders & Transactions**: Inspect all transactions, Chapa references, and buyer details.
  - **Manual Creator Payouts**: Review payout requests, record manual bank/Telebirr transfers with external transaction references, and atomically update ledgers.
  - **Policy Reports**: Investigate copyright infringement or fraud claims.
  - **Settings**: Adjust the 12% platform commission rate and minimum payout threshold.
  - **Audit Logs**: Immutable log of administrative operations.

---

## 3. Financial Ledger & 12% Commission

JEBULO uses a double-entry auditable ledger in Firestore:
- `orders`: Immutable order records with pricing snapshots, applied commission rate (12%), and status.
- `purchases`: Entitlement records granting customer download access upon verified payment.
- `creatorLedger`: Auditable credit and debit entries for each sale, commission deduction, and payout.
- `creatorBalances`: Summarized balances (`totalGrossSalesEtb`, `totalCommissionEtb`, `totalNetEarningsEtb`, `availableBalanceEtb`, `pendingPayoutEtb`, `totalPaidOutEtb`).
- `payoutRequests` & `payouts`: Track the lifecycle of creator payouts (`REQUESTED` -> `UNDER_REVIEW` -> `PAID`).

---

## 4. Environment Variables (`.env`)

See `.env.example` for the complete template:

```env
# Firebase Web Client Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Emulator Flags (set true for local emulator testing)
VITE_USE_FIREBASE_EMULATOR=false
VITE_EMULATOR_AUTH_URL=http://localhost:9099
VITE_EMULATOR_FIRESTORE_HOST=localhost
VITE_EMULATOR_FIRESTORE_PORT=8080
VITE_EMULATOR_FUNCTIONS_HOST=localhost
VITE_EMULATOR_FUNCTIONS_PORT=5001
VITE_EMULATOR_STORAGE_HOST=localhost
VITE_EMULATOR_STORAGE_PORT=9199

# Cloudinary Public Assets (Optional)
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=jebulo_public_uploads

# Backend Functions Configuration (Set in Cloud Functions or functions/.env)
# CHAPA_SECRET_KEY=CHASECK_TEST-xxxxxxxxxxxxxxxxxxxx
# CHAPA_PUBLIC_KEY=CHAPUBK_TEST-xxxxxxxxxxxxxxxxxxxx
# CHAPA_WEBHOOK_SECRET=your_webhook_signature
# MARKETPLACE_COMMISSION_RATE=0.12
```

---

## 5. Development & Testing

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm test
```
The Vitest automated test suite verifies:
- 12% commission calculation and 2-decimal rounding.
- Minimum payout threshold (500 ETB).
- Dynamic category models.
- English and Amharic translation dictionary parity.
- Protected storage security (no private bucket paths exposed in public payloads).

### Run Local Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

---

## 6. Chapa Payment Integration: Test vs Production Mode

### Test Mode (Sandbox Simulator)
In local development and testing, JEBULO includes a built-in Chapa Checkout Simulator (`/checkout/simulator?tx_ref=...`) allowing instant simulation of:
1. Successful Telebirr/CBE payment: triggers verified callback, writes entitlement to Firestore, calculates 12% commission, credits creator ledger, and unlocks download.
2. Declined/Cancelled payment: marks order failed and prevents entitlement generation.

### Production Mode with Live Chapa Account
1. Register and verify your business on [Chapa.co](https://chapa.co).
2. Obtain live API credentials: `CHASECK_LIVE-...` and `CHAPUBK_LIVE-...`.
3. Set secret in Firebase Functions:
   ```bash
   firebase functions:secrets:set CHAPA_SECRET_KEY
   firebase functions:secrets:set CHAPA_WEBHOOK_SECRET
   ```
4. Deploy Cloud Functions:
   ```bash
   firebase deploy --only functions
   ```
5. Register the webhook endpoint in your Chapa Merchant Dashboard:
   `https://<region>-<project-id>.cloudfunctions.net/chapaWebhook`

---

## 7. Security & File Delivery Rules

- **Firestore Rules (`firestore.rules`)**:
  - Enforces role-based permissions: Buyers cannot approve orders or forge paid status.
  - Creators can only edit their own products when in `DRAFT` or `PENDING_REVIEW` status.
  - Balances and financial ledger entries are read-only for creators and can only be written by Cloud Functions or administrators.
- **Storage Rules (`storage.rules`)**:
  - `public/**` is readable by all users for image previews.
  - `protected/**` blocks direct client read access entirely. Paid files can only be accessed via short-lived signed URLs generated by Cloud Functions upon entitlement verification.

---

## 8. Operating Costs & Free Tier Expectations

- **Firebase Hosting**: Free up to 10 GB storage and 360 MB/day transfer.
- **Cloud Firestore**: Free allowance of 50,000 reads, 20,000 writes, 20,000 deletes daily.
- **Firebase Authentication**: Free for up to 50,000 monthly active users.
- **Cloud Functions**: Deployment requires Firebase Blaze (pay-as-you-go), but the free monthly allowance covers 2 million invocations.
- **Chapa Fees**: Standard payment processing fee applies per transaction (typically ~2.5% to 3.5% depending on merchant agreement). Platform retains 12% commission from which fees are covered.

---

## 9. License

Proprietary © 2026 JEBULO. All Rights Reserved.
