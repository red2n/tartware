/**
 * DEV DOC
 * Module: locales/en.ts
 * Purpose: English string table for document templates.
 * Ownership: document-service
 *
 * Keys are namespaced by the section they appear in. Every template is checked
 * against every registered locale at boot (see `locales/index.ts`), so a key
 * added here without a translation elsewhere fails the service start rather
 * than printing a raw key on a guest's folio.
 */
export const en: Record<string, string> = {
  "doc.folio.title": "Guest Folio",

  "folio.number": "Folio number",
  "folio.status": "Status",
  "folio.type": "Type",
  "folio.opened": "Opened",
  "folio.closed": "Closed",
  "folio.reference": "Reference",

  "guest.section": "Guest",
  "guest.name": "Name",
  "guest.address": "Address",
  "guest.email": "Email",
  "guest.phone": "Telephone",
  "guest.tax_id": "Tax ID",

  "company.section": "Billed to",

  "stay.section": "Stay",
  "stay.confirmation": "Confirmation",
  "stay.room": "Room",
  "stay.room_type": "Room type",
  "stay.rate_plan": "Rate plan",
  "stay.arrival": "Arrival",
  "stay.departure": "Departure",
  "stay.nights": "Nights",
  "stay.adults": "Adults",
  "stay.children": "Children",

  "charges.section": "Charges",
  "charges.date": "Date",
  "charges.description": "Description",
  "charges.room": "Room",
  "charges.quantity": "Qty",
  "charges.amount": "Amount",
  "charges.empty": "No charges posted.",

  "payments.section": "Payments and credits",
  "payments.date": "Date",
  "payments.method": "Method",
  "payments.reference": "Reference",
  "payments.amount": "Amount",
  "payments.empty": "No payments recorded.",

  "taxes.section": "Tax summary",
  "taxes.code": "Code",
  "taxes.label": "Description",
  "taxes.rate": "Rate",
  "taxes.amount": "Amount",

  "totals.charges": "Total charges",
  "totals.payments": "Total payments",
  "totals.credits": "Total credits",
  "totals.balance": "Balance due",

  "footer.generated": "Generated",
  "footer.signature": "Guest signature",
  "footer.thanks": "Thank you for staying with us.",
};
