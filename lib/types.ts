export type UserRole = "admin" | "mod" | "member";

export type Gender = "male" | "female";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  username: string;
  gender: Gender | null;
  country: string | null;
  phone_number: string | null;
  x_username: string | null;
  heard_from: string | null;
  referral_id: string | null;
  role_in_space: string | null;
  bio: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  role: UserRole;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface SignupFormData {
  // Step 1
  full_name: string;
  email: string;
  gender: Gender | "";
  country: string;
  // Step 2
  phone_number: string;
  x_username: string;
  heard_from: string;
  referral_id: string;
  // Step 3
  username: string;
  role_in_space: string;
  bio: string;
}

export const INITIAL_SIGNUP_DATA: SignupFormData = {
  full_name: "",
  email: "",
  gender: "",
  country: "",
  phone_number: "",
  x_username: "",
  heard_from: "",
  referral_id: "",
  username: "",
  role_in_space: "",
  bio: "",
};

export const HEARD_FROM_OPTIONS = [
  "Twitter/X",
  "Telegram",
  "Discord",
  "A Friend",
  "YouTube",
  "Google Search",
  "Other",
];
