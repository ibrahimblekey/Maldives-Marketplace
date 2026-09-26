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
- **Taxes (2026-09-27):** replaced on 2026-09-27, see "Tax rules" below. Until the tax breakdown is built, hosts enter prices that already include T-GST, green tax and any service charge, guests pay exactly the price shown, and the site says "taxes included" wherever a price is shown.
- **Online payment (2026-09-27):** postponed. Guests keep paying at the property until a payment gateway (e.g. BML Connect) is arranged.
- **Tax rules (2026-09-27):** at licensed tourist properties, every guest pays room price + the property's service charge (configurable, e.g. 10%) + T-GST 17% calculated on room + service charge. Visitors additionally pay green tax per person per night ($6 or $12, set per property; children under 2 exempt). Maldivians and residents pay everything except green tax. Private rentals (locals-only listings) have no T-GST or green tax; the host's price is final. The T-GST rate, green tax rates and service charge are configurable from admin. Guests see a full price breakdown before booking, and the breakdown is stored with each booking.
