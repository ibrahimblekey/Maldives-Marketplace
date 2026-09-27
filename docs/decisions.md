# Decisions so far

- **Payments:** guests pay at the property. The platform bills each host a monthly commission statement. Online payment (Bank of Maldives "BML Connect" gateway, redirect/hosted-page method so we never handle card data) may be added later, behind the existing payment abstraction layer.
- **Commission:** must be configurable by admins, never hard-coded. A platform default rate plus an optional custom rate per host. Each booking keeps the rate in effect when it was made; later changes never alter past bookings.
- **Listing approval:** every new listing needs admin approval. After approval, hosts may change prices, room counts, amenities and policies immediately; changes to name, description or photos go back to admin review while the approved version stays live.
- **Minimum photos per listing:** 5.
- **Photo storage:** Vercel Blob.
- **Host verification (to be built):** before a host's first listing can go live, require their Ministry of Tourism operating licence or permit number and certificate, business registration, TGST registration certificate, owner ID and a phone number verified by SMS code. Admin reviews the documents and checks that the licence's business name and island match the listing. Show a "Verified host" badge only after approval.
- **Verification documents:** sensitive. Store privately, visible to admins only, never at a public link, and deletable when no longer needed.
- **Anti-scam:** add a "Report this listing" button, admin ability to suspend a host immediately, and a clear notice telling guests never to pay deposits outside the platform.
- **Owner:** not a software engineer and does not use a terminal. Always give click-by-click instructions for anything the owner must do, and explain decisions in plain language.

<!--
New decisions are added below, newest last, each with its date:
- **Topic (YYYY-MM-DD):** the decision, in plain language.
-->
- **Booking confirmation (2026-09-25):** instant booking. A booking is confirmed immediately; hosts don't approve each request.
- **Commission rate (2026-09-25):** 10% for now. Still has to become admin-configurable (see "Commission" above).
- **Email notifications (2026-09-26):** sent through Resend. Until a domain is verified in Resend, emails only reach the owner's own address.
- **Business model (2026-09-26):** undecided between commission and subscription. Commission billing stays as built until the owner decides; the anti-scam work goes ahead meanwhile.
- **Taxes (2026-09-27):** replaced on 2026-09-27, see "Tax rules" below. Until the tax breakdown was built, hosts enter prices that already include T-GST, green tax and any service charge, guests pay exactly the price shown, and the site says "taxes included" wherever a price is shown.
- **Online payment (2026-09-27):** postponed. Guests keep paying at the property until a payment gateway (e.g. BML Connect) is arranged.
- **Tax rules (2026-09-27):** at licensed tourist properties, every guest pays room price + the property's service charge (configurable, e.g. 10%) + T-GST 17% calculated on room + service charge. Visitors additionally pay green tax per person per night ($6 or $12, set per property; children under 2 exempt). Maldivians and residents pay everything except green tax. Private rentals (locals-only listings) have no T-GST or green tax; the host's price is final. The T-GST rate, green tax rates and service charge are configurable from admin. Guests see a full price breakdown before booking, and the breakdown is stored with each booking.
- **Tax rules, details (2026-09-27):**
  - At booking, the guest enters how many guests are Maldivian citizens or residents and how many are children under 2; green tax is charged on everyone else.
  - The host chooses "Licensed tourist property" or "Private rental (Maldivians & residents only)" when creating a listing, and the admin checks it at approval; it's locked once the listing is live. Private rentals show a "Maldivians & residents only" label, and guests must confirm everyone is Maldivian or resident.
  - Service charge: admin sets a default (10%); each tourist property can set its own, including 0%.
  - Green tax tier ($6 or $12): the host picks it and the admin can correct it. The amounts are set in admin Settings.
  - Licensed tourist properties price in USD only (green tax is in USD); private rentals may use any currency.
  - Commission is charged on the room price only, not on service charge or taxes.
  - Search shows "from USD X / night + service charge & taxes" without dates, and with dates the total incl. service charge and T-GST, with green tax per visitor noted separately. The booking page shows the exact breakdown.
  - The default commission rate is now set in admin Settings (10%). Per-host rates wait for the business-model decision.
- **Commission visibility (2026-09-27):** commission is private between the host and the platform. Travelers never see it; they only see the room price, service charge and taxes. Hosts see it in their booking emails, bookings and monthly statements.
- **Host verification, details (2026-09-27):**
  - Listings of hosts who aren't verified are hidden from travelers, including listings that were already live. Admins may approve a listing before its host is verified; it stays hidden until the host is.
  - Until an SMS provider is set up, the admin confirms the host's phone number by calling them and ticking "Phone confirmed by call" when approving. Twilio will be added later for SMS codes.
  - Once a host submits for verification, and after they're verified, they can't change their business name or phone number themselves (contact support). An admin can remove a host's verification (e.g. an expired licence), which hides their listings until they're approved again.
- **Verification document retention (2026-09-27):** rejected or replaced files are deleted straight away. Approved documents are kept while the host is active, and an admin can delete them anytime with one click.
