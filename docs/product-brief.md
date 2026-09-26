# Product brief

## 1. Product vision
A modern web platform (and eventually a mobile app) focused on tourism and accommodation in the Maldives. Similar in concept to Airbnb/Booking.com but designed specifically around the Maldives tourism market. The initial focus is accommodation booking. In future the platform should expand into airport transfers, speedboats, domestic flights, excursions, activities, restaurants, experiences and complete Maldives travel planning.

The platform connects: travelers/tourists; guesthouses; hotels; resorts; villas; apartments/homestays where legally permitted; local tour/activity providers; transfer providers; platform administrators.

Long-term vision: "One platform where a tourist can discover, compare and book their entire Maldives trip."

## 2. Do not just copy Airbnb
Use Airbnb and Booking.com as UX inspiration only. Do not copy their branding, design, text or proprietary functionality. Create an original brand identity and interface that feels premium, modern, tropical, trustworthy, simple, international and Maldives-focused, without becoming cartoonish or overusing palm-tree/beach imagery.

## 3. Travelers
International and local travelers should be able to: search destinations and islands; search by dates and number of guests; filter accommodation; view property details; compare properties; see photos, amenities and reviews; check availability and pricing; book; make payments; receive booking confirmations; communicate with property owners; manage bookings; cancel according to cancellation policies; leave reviews.

## 4. Property owners / hosts
A separate host dashboard where hosts can: register their business; create a property; upload property photos and videos; add a description; select property type and island; add exact/general location; add room types, number of rooms, room photos and occupancy; set prices and seasonal prices; set availability and block dates; create special offers; define cancellation policies and check-in/check-out; add amenities and house rules; manage reservations; view guest information; message guests; view earnings and booking history; manage staff/users; receive notifications. It must be simple enough for a small Maldivian guesthouse owner without technical knowledge.

## 5. Property types
Guesthouse, hotel, resort, boutique hotel, villa, apartment, private room, entire property, homestay. New types must be addable later.

## 6. Maldives location structure
Hierarchy: Country → Atoll → Island → Property (e.g. Maldives → Kaafu Atoll → Thulusdhoo → Example Guesthouse). Tourists can search by atoll, island, property, beach, surf location, diving location and tourist area. The location database must scale to all relevant Maldivian islands. Do not hard-code only a few islands.

## 7. Search experience
The homepage lets users search immediately: "Where are you going?", check-in, check-out, guests, search. Example searches: Thulusdhoo, Maafushi, Dhigurah, Ukulhas, Rasdhoo, Fulidhoo, Himmafushi, Addu City. Results show: image, name, island, rating, number of reviews, property type, short description, amenities, price per night, total estimated price, availability, special offer if any.

## 8. Search filters
Price range. Property type (guesthouse, hotel, resort, villa, apartment). Amenities (Wi-Fi, air conditioning, breakfast, restaurant, swimming pool, beach access, private beach, spa, gym, laundry, airport transfer, bicycle rental, water sports, diving, surfing, family rooms). Guest rating. Location. Beach access. Meal plan (room only, breakfast, half board, full board, all inclusive). Cancellation (free cancellation, non-refundable).

## 9. Property page
Header: name, location, rating, reviews, share, save/favorite. Large photo gallery (multiple images). Property information: description, type, island, distance from beach and harbour, facilities, amenities. Rooms shown separately (e.g. "Deluxe Double Room: 1 king bed, 2 guests, air conditioning, Wi-Fi, breakfast included, $120/night, available, Book"). Policies: check-in, check-out, cancellation, children, extra beds, pets, smoking. Reviews with rating, text, date and guest name/profile. Location: map, island, nearby attractions. Eventually transfer information: airport → island, transfer type, duration, price, availability.

## 10. Booking system
A reservation contains: booking ID, guest ID, property ID, room ID, check-in and check-out dates, number of guests and rooms, base price, taxes, service fees, discounts, total price, currency, payment status, booking status, cancellation status, special requests, created date. Statuses: pending, confirmed, payment pending, cancelled, completed, no-show. Prevent double booking. Check availability before confirming.

## 11. Pricing
Per-night, weekend and seasonal pricing; special offers; discounts; minimum and maximum stay; extra guest and extra bed charges; taxes; platform fees. The architecture must allow other pricing models later.

## 12. Currency
Support USD, MVR, EUR, GBP, INR, and other major currencies later. Users choose a display currency. The database keeps the actual transaction currency separately from the display currency. Never convert and overwrite the original booking amount.

## 13. Payments
Modular, with a payment abstraction layer so providers can be added later. Possible methods: international cards, local payment methods, bank transfer, other gateways. Record payment ID, booking ID, amount, currency, provider, status, transaction reference and date. Never store raw card numbers or sensitive payment information.

## 14. Host commission
Revenue comes primarily from booking commissions (e.g. $500 booking, 10% commission, $50 platform revenue, $450 host payout). The commission percentage must be configurable from the admin dashboard. Do NOT hard-code 10%. Admins can set different rates where needed.

## 15. Admin dashboard
Users (travelers, hosts, admins, staff). Properties (approve, reject, suspend, edit, view documents, verify hosts). Bookings (view, search, filter, cancel, resolve disputes). Payments (transactions, platform revenue, host payouts, refunds, status). Reviews (monitor, remove inappropriate, handle reports). Locations (atolls, islands, tourist locations). Content (homepage banners, featured properties, promotions, destination pages). Settings (commission, taxes, currency, cancellation rules, platform fees, notifications).

## 16. Host verification
Trust is essential. Hosts go through verification: business/property name, owner/manager information, contact details, registration/licence information where applicable, identification/document verification where legally appropriate, bank/payout details. Admin manually approves properties before they become publicly bookable. Show a "Verified" indicator where appropriate.

## 17. Reviews
After a completed stay, guests can review the property on cleanliness, location, staff, facilities, value and communication. The overall rating is calculated automatically. Hosts cannot delete legitimate reviews. Only guests with eligible completed bookings can review.

## 18. Messaging
Guest ↔ host messaging with text, booking-related messages, notifications, read/unread status and timestamps. Later: images, automated messages, translation, possibly WhatsApp. Keep communication on the platform so conversations can be referenced in disputes.

## 19. Notifications
Email and in-app now; SMS/WhatsApp later. Guest: booking request, confirmation, payment confirmation, cancellation, upcoming check-in, host message, review reminder. Host: new booking, payment received, cancellation, new message, upcoming guest, property approval/rejection. Admin: new host registration, new property submitted, verification required, reported review, dispute.

## 20. Transfers (future)
Show transfer options per booking (e.g. Velana International Airport → speedboat → Thulusdhoo): public ferry, speedboat, domestic flight, seaplane, private transfer. Transfer providers will get their own dashboard. Design so transfers can become another marketplace category.

## 21. Activities / experiences (future)
Scuba diving, snorkeling, surfing, fishing, dolphin cruises, whale shark trips, sandbank trips, sunset cruises, island hopping, water sports, local cooking. Providers list activity, location, duration, price, capacity, dates, photos, description, requirements and cancellation policy. Bookable separately or with accommodation.

## 22. Travel packages (future)
Combined bookings (e.g. "7-Day Maldives Adventure": 5 nights, airport transfer, snorkeling, dolphin cruise, island tour) with automatic package pricing.

## 23. Homepage
Premium and uncluttered, prioritising search and discovery: hero ("Find your Maldives."), search bar, popular islands, featured stays, destinations, guesthouses/hotels/resorts/villas, experiences, popular activities, travel guides, why book with us, host your property, footer.

## 24. Destination pages
SEO-friendly pages such as /destinations/thulusdhoo with: about the island, accommodation, things to do, surfing, diving, restaurants, transfers, weather later, map, FAQ.

## 25. Mobile-first
Mobile-first and responsive, fast, simple navigation, large touch targets, easy booking, optimised images. Desktop must still be excellent.

## 26. User accounts
Register with email, phone, Google or Apple. Profile: name, photo, country, phone, email, booking history, favorites, reviews, saved properties. Do not collect unnecessary personal information.

## 27. Favorites
Guests can save properties to compare later.

## 28. Host onboarding
Simple wizard: account → business information → property information → location → rooms → photos → amenities → pricing → policies → submit for verification. After submission: "Your property is under review." Admin approves.

## 29. Security
Secure authentication, password hashing, role-based access control, input validation, rate limiting, secure API endpoints, protection against common web attacks, secure payment handling, audit logs for admin actions, proper session management. Roles: TRAVELER, HOST, ADMIN, SUPER_ADMIN.

## 30. Database
Relational, with entities such as users, properties, property images, rooms, room images, amenities, property amenities, locations, atolls, islands, availability, pricing, bookings, booking guests, payments, payouts, reviews, messages, notifications, favorites, host profiles, verification documents, cancellation policies, promotions, activities, activity bookings, transfers, transfer bookings. Must allow expansion without rebuilding.

## 31. SEO
Unique SEO-friendly property pages (e.g. /property/example-guesthouse-thulusdhoo) and destination pages. Proper titles, meta descriptions, structured data, clean URLs, sitemap, robots.txt, optimised images, fast loading, destination content.

## 32. Performance
Designed for thousands of properties and many users: image optimisation, lazy loading, caching, database indexing, pagination, CDN, API optimisation. Never load thousands of properties at once.

## 33. Maps
Eventually an interactive map on property pages and for exploring geographically. Show approximate locations where privacy requires. Do not expose sensitive information.

## 34. Business model
Initially accommodation booking commission. Later: activity and transfer commission, featured listings, advertising, premium host accounts, travel packages, other tourism services. Commission must be configurable.

## 35. MVP
Traveler: registration/login, search, filters, property pages, room availability, booking, modular payment placeholder, booking confirmation, user dashboard, favorites, reviews. Host: registration, property creation, room management, photos, pricing, availability, booking management, basic earnings dashboard. Admin: user management, host approval, property approval, booking management, basic payment/commission management, island/location management. Build the foundation so transfers and activities can be added later.

## 36. Development approach
Act as a senior product engineer and architect. Before large amounts of code: understand requirements, identify missing decisions, propose architecture, schema, application structure and API structure, identify security and scalability concerns, break work into milestones, then implement. No giant files; clean modular architecture; reusable components; business logic separate from UI; database logic separate from presentation.

## 37. Product principle
A marketplace from day one, with three experiences that must work together. Traveler: discover → compare → book → pay → travel → review. Host: register → list → manage → receive booking → host guest → receive payout. Admin: verify → monitor → manage → resolve → analyse.

## 38. Future expansion
Accommodation, transfers, activities, restaurants, car/bicycle rental, travel packages, airport services, tour guides, local experiences, travel insurance, flights, multi-island itineraries, loyalty/rewards, referrals, affiliates, corporate travel.

## 39. Brand positioning
A Maldives-focused travel marketplace, not "another hotel booking website". For travelers: "discover and book authentic Maldives stays and experiences in one place." For local businesses: "reach travelers from around the world and manage bookings through one platform."

## 40. Working rules
Wait for confirmation before making major architectural changes. Prioritise a functional MVP over unnecessary features. Make the interface polished and production-oriented, not a generic developer demo.
