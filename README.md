# Cryptonians Hub

<p align="center">
  <img src="./assets/images/logo_black.png" width="120" alt="Cryptonians Hub Logo" />
</p>

<p align="center">
  <strong>A mobile-first community app for crypto enthusiasts — built with Expo, React Native & Supabase.</strong>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.1.0-blueviolet?style=flat-square" />
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2054-000020?style=flat-square&logo=expo" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.81-61DAFB?style=flat-square&logo=react" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase" />
</p>

---

## Overview

**Cryptonians Hub** is a full-featured social community platform designed around the crypto space. It gives members a place to connect, share knowledge, participate in Niches (topic-based sub-communities), and consume curated educational content — all from a beautifully designed mobile app.

---

## Features

### 🏠 Home Feed

- Community-style post feed with text, images, and links
- Like, comment, and share posts
- Compose rich posts with image attachments

### 💬 Chats

- Direct and group messaging
- Real-time message delivery powered by Supabase
- Auto-refresh on screen focus with functional search across conversations

### 🌐 Niches

- Topic-driven sub-communities (e.g., DeFi, Trading, NFTs)
- Members can request to join; Admins/Mods approve or reject
- Immediate membership status updates after admin approval

### 📚 Education Hub

- Browse, upvote, and bookmark educational materials (PDFs, links, DOCX files)
- **Native Articles** — community members can write and publish long-form articles directly in-app with cover images
- Category and difficulty filtering (DeFi, Trading, Marketing, Dev, + custom tags)
- Admin review queue for content moderation
- Skeleton loading screens for smoother perceived performance

### 🔔 Notifications

- In-app notification feed for likes, comments, join requests, and system events
- Deep-linked — tapping a notification navigates directly to the related post or chat
- **Out-of-App Push Notifications** via Expo Push API + Supabase `pg_net`
- User-controlled push notification toggle in Settings

### ⚙️ Settings

- Dark / Light theme toggle
- Push notification opt-in/out
- Privacy & Security settings
- Support ticket system
- Legal pages (Terms of Service, Privacy Policy)
- App version display

---

## Tech Stack

| Layer                  | Technology                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| **Framework**          | [Expo](https://expo.dev) (SDK 54) with Expo Router v6                  |
| **UI**                 | React Native + [NativeWind](https://nativewind.dev) (Tailwind CSS)     |
| **Icons**              | [Lucide React Native](https://lucide.dev)                              |
| **State Management**   | [Zustand](https://zustand-demo.pmnd.rs)                                |
| **Backend & Auth**     | [Supabase](https://supabase.com) (PostgreSQL, Auth, Storage, Realtime) |
| **Push Notifications** | Expo Push API + Supabase `pg_net` extension                            |
| **File Storage**       | Supabase Storage (`education_files` bucket)                            |
| **Navigation**         | Expo Router (file-based routing)                                       |
| **HTTP (DB-side)**     | `pg_net` Postgres extension for outbound push calls                    |

---

## Project Structure

```
cryptonians/
├── app/
│   ├── (auth)/             # Login, Signup, OTP Verify screens
│   ├── (tabs)/             # Tab screens: Home, Chats, Niches, Education, Settings
│   ├── chat/               # Individual chat room screen
│   ├── education/          # Upload material, Create article, Viewer screens
│   ├── niche/              # Individual niche detail screen
│   ├── post/               # Individual post detail screen
│   ├── profile/            # User profile screen
│   ├── settings/           # Privacy & Security settings
│   ├── legal/              # Terms of Service, Privacy Policy
│   ├── support.tsx         # Support ticket system
│   ├── notifications.tsx   # Notification feed
│   └── _layout.tsx         # Root layout with auth + push notification wiring
├── components/
│   └── ui/                 # Shared UI components (Modals, AppModal, etc.)
├── constants/              # Color tokens, shared constants
├── lib/
│   ├── supabase.ts         # Supabase client configuration
│   └── pushNotifications.ts # Expo push token registration helper
├── stores/
│   ├── authStore.ts        # Auth & profile global state (Zustand)
│   └── themeStore.ts       # Dark/Light theme global state (Zustand)
└── assets/                 # Images, icons, splash screen
```

---

## User Roles

| Role       | Capabilities                                                                      |
| ---------- | --------------------------------------------------------------------------------- |
| **member** | Browse, post, chat, upvote, bookmark, join niches, write articles                 |
| **mod**    | All member permissions + Approve/reject education materials, manage niche members |
| **admin**  | All mod permissions + Full platform management, review queues, support tickets    |

---

## Push Notifications

Push notifications are dispatched server-side using a Supabase PostgreSQL trigger + the `pg_net` extension. When a new notification row is inserted, the trigger:

1. Checks if the recipient has `push_enabled = true`
2. Fetches their `expo_push_token`
3. Fires a POST request to the Expo Push API (`https://exp.host/--/api/v2/push/send`)

Users can toggle push notifications on/off from **Settings → Push Notifications**.

---

## License

This project is private and proprietary. All rights reserved © Cryptonians Hub.
