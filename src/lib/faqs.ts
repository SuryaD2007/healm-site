/**
 * The home page's questions (src/components/Faq.astro) and their FAQPage structured data. Each answer is
 * already in the terms (terms.html), the privacy policy (privacy.html) or the support page; when one of
 * those changes, change the answer here too. No medical claims: Healm does not diagnose, treat or cure.
 */
export const faqs = [
  {
    q: 'Is Healm a doctor?',
    a: 'No. Healm gives health information based on what you tell it and what Apple Health records. It doesn’t diagnose, treat, or prescribe, and it isn’t a substitute for a clinician. In an emergency, call 911.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your health file lives on your iPhone, protected by iOS file encryption and Healm’s Face ID lock. It isn’t synced to iCloud or copied to Healm’s server. When you ask something, only what that one answer needs goes to the AI model, with your permission, and Healm keeps none of it.',
  },
  {
    q: 'What does it cost?',
    a: 'Healm is free to use in this version. If that changes, you’ll be told in the app before you’re asked to pay for anything.',
  },
  {
    q: 'Who is it for?',
    a: 'Adults in the United States with an iPhone who want to understand their own health: their numbers, their skin, their habits. You need to be 18 or older.',
  },
  {
    q: 'What does a scan look at?',
    a: 'The face scan reads your skin, area by area. The hair scan takes three photos: your hairline, the top of your head, and your part. The body scan reads your posture, and measurements once you add your height. Results describe what a photo looks like. They’re not a diagnosis.',
  },
  {
    q: 'Can I delete my data?',
    a: 'Yes, any time. In Healm, open You, then Settings. Export everything gives you a zip of your file. Delete everything removes your account from Healm’s server and everything from your phone.',
  },
  {
    q: 'When can I get it?',
    a: 'Healm is coming to the App Store. Join the waitlist and you’ll hear the day it lands.',
  },
] as const;
