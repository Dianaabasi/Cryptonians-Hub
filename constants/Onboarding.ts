export interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "1",
    title: "Welcome to Cryptonians",
    description:
      "Your all-in-one Web3 community hub. Connect with traders, developers, and crypto enthusiasts from around the world.",
    icon: "globe",
  },
  {
    id: "2",
    title: "Learn, Share & Grow",
    description:
      "Access curated education materials, share knowledge in niche communities, and stay updated with the latest opportunities in the space.",
    icon: "book-open",
  },
  {
    id: "3",
    title: "Join the Community",
    description:
      "Become a Cryptonian today. Chat with members, discover airdrops, find jobs, and build your Web3 career.",
    icon: "users",
  },
];
