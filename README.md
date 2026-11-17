# Invite Studio

Personalised event invitations, without paying for an event platform.

Upload a flyer and a guest list, and Invite Studio puts each guest's **name** and a
**unique QR code** on the flyer. Send it by WhatsApp or email, collect **RSVPs**, and check
guests in at the door by **scanning their QR code** with a phone.

## What it does

| Part | Who uses it | Where |
|---|---|---|
| Organiser dashboard | You (password) | `/` |
| RSVP page | Guests, from the link in their message | `/rsvp/<token>` |
| Ticket page | Guests who tap or scan their own QR code | `/t/<token>` |
| Door scanner | Door staff (6-digit event PIN) | `/checkin` |

- **Events.** Each event has its own flyer, guest list, message, settings and check-in PIN.
- **Guests.** Upload Excel or CSV (columns: `Name`, `WhatsApp Number` and/or `Email`,
  optional `Category`), or add guests one by one with a country-code picker. Numbers without a
  country code get the selected code, and duplicates are skipped.
- **Invites.** The flyer can be zoomed and positioned, with an optional watermark or pattern.
  Each guest gets an unguessable ticket link and a QR code. Long names shrink to fit.
- **Sending.** WhatsApp (and optionally Gmail, Outlook or the default mail app) opens with the
  personalised message, and the guest's flyer downloads so you can attach it. The guest is
  marked as sent and the next unsent guest is selected.
- **RSVP.** Guests tap Yes or No and confirm. Only the first answer counts (you can change it
  from the dashboard). Link previews in WhatsApp can't accidentally answer for a guest.
- **Check-in.** Staff scan with the phone camera or search by name or ticket code. Scanning
  the same code twice shows "Already checked in". Mistakes can be undone.
- **Live dashboard.** RSVP and check-in status refresh every 15 seconds. Filter the list
  (attending, no reply, checked in…) and export it to Excel.

## Run it on your computer

Needs Node.js 22.13 or newer.

```bash
npm install
```

Create a file called `.dev.vars` in this folder (it is ignored by git):

```
ADMIN_PASSWORD=choose-a-password
SESSION_SECRET=any-long-random-text
```

```bash
npm run dev
```

Open http://localhost:5173 and sign in with your password. Data is stored in a local
database under `.wrangler/`. Delete that folder to start fresh.

> The phone camera scanner only works on `https://` addresses (or `localhost`). On a
> deployed site this is automatic.

## Put it online (Cloudflare, free tier is enough for most events)

1. Create a free Cloudflare account, then sign in from this folder:

   ```bash
   npx wrangler login
   ```

2. Create the database and note the `database_id` it prints:

   ```bash
   npx wrangler d1 create invite-studio
   ```

3. Build with that database ID, then deploy:

   ```bash
   D1_DATABASE_ID=<the id from step 2> npm run build
   ```

   ```bash
   npx wrangler deploy
   ```

4. Set your organiser password and a session secret (you'll be prompted for each value):

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   ```

   ```bash
   npx wrangler secret put SESSION_SECRET
   ```

Wrangler prints your site address (`https://invite-studio.<you>.workers.dev`). A custom
domain can be added in the Cloudflare dashboard. The database tables are created
automatically on first use.

## Configuration

| Setting | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Organiser password. Required. |
| `SESSION_SECRET` | Signs login cookies. If missing, the password is used. Changing either signs everyone out. |
| `DB` | The D1 database binding. |

Security notes: logins and PIN attempts are limited to 10 per 15 minutes per network
address. Door staff can only check guests in for their event. They can't see contact
details or change the list. Create a new PIN from the dashboard at any time.

## Limits worth knowing

- **Sending is one guest at a time.** WhatsApp doesn't allow a website to attach an
  image to a message, so you attach the downloaded flyer and tap Send yourself. Fully
  automatic bulk sending needs the WhatsApp Business API (paid per message by Meta).
- **QR and name positions** are set for a portrait flyer with space in the lower middle
  (see `LAYOUT` in `lib/invite.ts`).
- **Uploaded custom QR codes** work with the door scanner only if the app can read the
  image. Unreadable ones are reported, and those guests can be found by name instead.

## Tests

```bash
npm test
```

Unit tests.

```bash
npm run dev
```

Then, in a second terminal, run the full browser walkthrough (needs Playwright and a fresh
database; screenshots go to `.e2e-output/`):

```bash
npm run test:e2e
```

## Code map

- `app/page.tsx`: login or dashboard. `app/studio.tsx`: the dashboard.
- `app/rsvp`, `app/t`, `app/checkin`: guest and door-staff pages.
- `app/api/**`: JSON API. `lib/server/`: database, auth and validation.
- `lib/invite.ts`: settings, message text and drawing the invitation image.
- `lib/country-codes.ts`: country codes and phone-number cleanup.
