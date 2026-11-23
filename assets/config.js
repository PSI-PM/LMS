/*
  PSI PM website settings. Edit this one file; no other file needs to change.
  Anything left empty ("") is hidden from the site or replaced with a safe default.
*/
window.PSI = {
  // Shown in the footer and on the Contact page; used by the contact form. Leave phone empty to hide it.
  phone: "",
  email: "info@psipm.com",
  address: "141 Traction Street #2298, Greenville, SC 29611",

  // Tuition shown on the site. The amount actually charged is the Stripe price you attach in Supabase
  // (STRIPE_PRICE_PMP, STRIPE_PRICE_CAPM, STRIPE_PRICE_CPMAI), so keep each pair matching.
  // Leave a price empty to show [PRICE] on its page until you set it.
  prices: {
    pmp: "$1,995", capm: "$1,495", cpmai: "$2,295", practical: "$1,095",
    // PDU courses (self-paced, sold one at a time)
    "pdu-wbs": "$79", "pdu-business-analysis": "$149", "pdu-evm": "$79", "pdu-network": "$79", "pdu-ccpm": "$149",
    // Self-paced courses that sit under Certification Courses
    "toc": "$149", "adv-scrum": "$389", "psm": "$349"
  },

  // Class dates students can choose at checkout, one list per course. Leave a list empty to hide the
  // choice. Write each one exactly as you want it to appear, for example "Nov 9-13, 2026 (8:00 AM to 5:00 PM ET)".
  classDates: {
    // Open-enrollment classes, in date order. Add a class by adding a line; remove a class once it has started.
    pmp: ["Jan 11-15, 2027", "Mar 8-12, 2027", "May 10-14, 2027", "Jul 12-16, 2027", "Sep 13-17, 2027", "Nov 15-19, 2027"],   // D27-PMP-001, D27-PMP-002, D27-PMP-003, D27-PMP-004, D27-PMP-005, D27-PMP-006
    capm: ["Feb 8-11, 2027", "Apr 26-29, 2027", "Jun 7-10, 2027", "Aug 16-19, 2027", "Oct 18-21, 2027", "Dec 6-9, 2027"],   // D27-CAPM-001, D27-CAPM-002, D27-CAPM-003, D27-CAPM-004, D27-CAPM-005, D27-CAPM-006
    cpmai: [],   // no dates yet
    practical: ["Mar 16-18, 2027", "May 4-6, 2027", "Jul 27-29, 2027", "Nov 9-11, 2027"]   // D27-PPM-001, D27-PPM-002, D27-PPM-003, D27-PPM-004
  },

  // Where students sign in.
  lmsUrl: "https://psi-pm.github.io/LMS/",
  lmsPrograms: {
    capm: "https://psi-pm.github.io/LMS/capm/",
    pmp: "https://psi-pm.github.io/LMS/pmp/",
    cpmai: "https://psi-pm.github.io/LMS/cpmai/",
    practical: "https://psi-pm.github.io/LMS/practical/"
  },

  // Your Supabase project. The key is the publishable (anon) key, which is safe in a public site.
  // It is only needed if you leave "Verify JWT" on for the two public functions.
  supabaseUrl: "https://kxpjubgxqnsursqdpezc.supabase.co",
  supabaseKey: ""
};
