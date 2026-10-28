# Queen Valley Apartment Planner

A private, static PWA for the Euphoria Queen Valley payment plan. It is designed to be hosted on GitHub Pages and installed to an iPhone Home Screen.

## What it does

- Seeds the exact quarterly installment schedule from 5 Jan 2027 through 5 Oct 2036.
- Uses EGP 60,414 for installments 1–39 and EGP 60,451 for installment 40.
- Includes EGP 50,000 garage payments each October from 2027–2031.
- Includes the EGP 268,510 maintenance deposit due 4 Apr 2030.
- Tracks the available balance of the CIB account from which signed cheques will clear.
- Shows the next payment bundle, recommended protected amount, shortfall and days remaining.
- Uses the initial planning assumptions: EGP 80,700 salary, 9% raise from Jan 2027, EGP 12,000 rent, EGP 10,000 emergency saving target.
- Uses the phased apartment-saving plan discussed with Michael.
- Lets payments be marked paid after they actually clear.
- Stores data in browser localStorage only.
- Exports a JSON backup.
- Exports an Apple Calendar `.ics` file with monthly saving reminders and 10-day / 3-day / 1-day payment alerts.
- Works offline after first load.

## Recommended bank structure

1. Keep the existing account from which the signed Euphoria cheques were issued as a dedicated cheque-clearing/property account.
2. Open a second CIB account for everyday spending.
3. Keep apartment savings in the cheque-clearing account rather than moving them out and relying on a later transfer back.
4. Do not treat the protected amount as spendable until the cheque/payment has actually cleared.

This avoids dependence on external transfer limits and reduces the risk of forgetting to return money before a cheque is presented.

## Deploy to GitHub Pages

1. Create a new GitHub repository, for example `queen-valley-planner`.
2. Upload all files in this folder to the repository root.
3. In GitHub: **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Open the Pages URL on the iPhone.
7. In Safari, tap **Share → Add to Home Screen**.

The app will then open like a standalone iPhone app.

## Important limitation

GitHub Pages is static hosting. A static PWA cannot reliably wake itself at a future time to send a scheduled notification without a push backend. The app therefore uses Apple Calendar export for device-level reminders. Separate ChatGPT automations can also provide reminder redundancy.

## Privacy

Do not add account numbers, card numbers, passwords, OTPs, or CIB credentials to this app. It does not need them.
