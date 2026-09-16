# Owner-facing features

## 1. Landing page editing (a small CMS)

The public page for the studio's professional training trip contains almost no hard-coded copy.
Its content lives on the trip record in the CRM.

**Editing.** The trip screen has sections that mirror the page: hero, story, what's included,
syllabus, FAQ, lead form and popup. Images are uploaded to storage, and for each one the owner
chooses which part stays visible when it's cropped (top, centre or bottom).

**Draft → publish.**

```
edit ──► draft columns on the trip ──► [Publish] ──► snapshot in published_content ──► public page
                     │
                     └──► [Preview] ──► real page + one-time token ──► server builds the draft
```

- The public page can read **only** the published snapshot of the featured trip. It is the one
  anonymous read in the whole database.
- Preview shows the *real* page with draft content, so what she approves is what visitors will
  see.
- Publishing is explicit, so a half-finished edit never goes live.

**Tracking.** The page captures ad parameters (UTM values and the click ID) and sends them with
each lead. A Meta Pixel reports page views and conversions back to the ad account.

## 2. Lead tracking

**Capture.** The main form and a popup form both post to one intake Edge Function. It checks:
- the origin against an allowlist;
- a hidden honeypot field;
- the phone number, normalized to the local format;
- a rate limit of 8 submissions per 10 minutes per IP.

It then calls a single atomic database function, which:
1. finds the contact by phone (primary or secondary), then by email, or creates one;
2. fills in only the missing details, never overwriting what is already known;
3. tags the contact with the relevant business area;
4. upserts the lead for this trip, **merging** the new answers into the old ones and counting
   submissions;
5. records marketing consent, with its source and timestamp, if it was given;
6. logs the attempt for rate limiting.

**Pipeline.** *New → contacted → interested → waitlist → registered → paid*, or *not relevant*.
The leads table shows the source, the answers, how many times the lead submitted, and a consent
badge. Leads can be viewed per trip or across all trips.

## 3. Contacts by business area

Business areas (for example the studio, trips, suppliers) are rows, not hard-coded screens. Each
area page shows:
- its **contacts**, each with a *type* specific to that area (for example "instructor" for trips
  and "client" for the studio);
- its **external links** (booking pages, supplier sites, shared folders).

A contact can belong to several areas with a different role in each, so no one is duplicated.

## 4. Mailing list and campaigns

**Consent model.** One consent record per contact stores whether they are subscribed, where
consent came from, when it was given and, if they unsubscribed, when and why.

**Composing.** A campaign has a subject, an intro, an image, a call-to-action button and a closing
line. It is rendered into a right-to-left HTML email template.

**Audience.** The segment is defined by trip and/or lead status, and the screen shows an estimated
recipient count before sending. On the server, the audience is **always** intersected with
subscribed contacts. The client can't send anything that bypasses that.

**Sending.**
- A test send goes only to the signed-in user's own address.
- A real send creates one delivery row per recipient, with a personal unsubscribe link.
- The email provider's webhook reports *sent*, *delivered*, *opened* and *bounced* back to those
  rows.

## 5. Paid advertising (Meta)

- Campaigns, ad sets and ads are created from inside the CRM, together with tracked landing-page
  links.
- Everything is created **paused**. Activating is a separate, deliberate action.
- Insights, billing status and pixel setup are available from the same screen.
- All calls go through one server-side gateway:
  - the access token never reaches the browser;
  - the caller's identity is verified explicitly;
  - spending actions need an allowlisted user;
  - pausing is always allowed.

## 6. Trips and trainings

Each trip has dates, price, capacity, an instructor and a status (*draft → registration open →
waitlist → closed → completed*). The trip is also the landing page's content record and the
parent of its leads, so one object ties marketing, sales and operations together.

## 7. AI usage and costs

Every automated AI call writes one row to a shared log: provider, model, workflow, tokens, cost,
and whether the cost was reported by the provider, calculated from a price table, or not
available. The dashboard filters by date, provider, model and workflow, so the owner can see what
the automation actually costs her.

## 8. Access

- Email and password sign-in.
- Every table requires an **active profile**.
- Users can't raise their own privileges; a database trigger prevents it.
- Tables that hold secrets have row-level security enabled with **no** policies, so only
  dedicated server functions can reach them.
