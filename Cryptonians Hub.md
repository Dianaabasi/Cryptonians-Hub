# **Project Documentation: Cryptonians Hub**

## **1\. Project Identity & Theme**

* **App Name:** Cryptonians  
* **Target Audience:** Web3 enthusiasts, traders, Jobbers.  
* **Visual Direction:** Dual-theme support (**Light & Dark Mode**). High-contrast UI with clear typography.

---

## **2\. Information Architecture (App Structure)**

### **A. Onboarding Flow (3-Page Membership)**

1. **Identity:** Account creation (Email/Password).  
2. **Persona:** Profile setup (Username, Bio, Profile Picture).  
3. **Web3 Links:** Wallet address input (Publicly viewable/copyable) and niche interest selection.

### **B. Navigation (Bottom Tab Bar)**

* **Home (Global Feed):** A curated stream of general posts \+ posts from all niches the user has joined.  
* **Communities (Niches):** Discovery page for niches (Trading, Jobs, Airdrops, etc.).  
* **Education:** Repository for approved learning materials.  
* **Messages:** List of 1-on-1 private chats.  
* **Profile/Settings:** Personal dashboard and app preferences.

---

## **3\. Detailed Functional Modules**

### **I. The Social Engine (Feed Logic)**

* **Global Feed:**  
  * Shows all "General" community posts.  
  * **Dynamic Injection:** Automatically includes posts from specific Niches if the user is a member of that niche.  
* **Niche-Specific Feeds:**  
  * Each niche has its own dedicated feed for specialized discussions.  
  * **Job Niche (Specialized):** \* **Job Postings:** Highlighted cards created only by **Admins/Mods**.  
    * **Discussions:** Standard posts, comments, and chats created by **Members**.

### **II. Community & Niches**

* **Group Dynamics:** Each niche contains a **General Group Chat** and an **Announcement Channel** (Admin/Mod only).  
* **Join Request:** Users must "Join" a niche to see its content in their Global Feed and participate in its chats.  
* **Bounties & Opportunities:** Featured sections within the Airdrop and Job niches for high-value tasks posted by staff.

### **III. User Management & Moderation**

* **Public Profiles:** Display PFP, Bio, and a "Copy Wallet Address" button.  
* **Staff Tools:**  
  * **Moderators:** Can approve/reject Education uploads, hide posts via the **Report System**, and **Suspend** users.  
  * **Admins:** Can **Delete** users, assign Mod roles, and create Job/Bounty postings.

---

## **4\. Technical Specifications for UI/UX**

### **UI Components to Design**

| Component | Description |
| :---- | :---- |
| **Theme Toggle** | A switch in Settings for Light/Dark mode. |
| **Post Card** | Must handle text, images, and a "Niche Tag" (e.g., *Posted in \#Trading*). |
| **Job Card** | A distinct UI style for Job Postings to differentiate them from regular posts. |
| **Wallet Widget** | A clean UI element on the profile showing a truncated wallet address with a copy icon. |
| **Approval Queue** | A dashboard view for Mods to review pending PDFs/Links. |

### **Must-Have Interactions**

* **Deep Linking:** Notifications for "New Job Opportunity" should land the user directly on the Job Niche feed.  
* **Report System:** A simple flag icon on every post/comment.  
* **Real-time Indicators:** Typing indicators in chats and emoji reaction animations on Community Updates.

---

## **5\. Backend Logic (Supabase Focus)**

* **Database:** \* posts table with a niche\_id (nullable for global posts).  
  * memberships table to track which niches a user has joined (used to filter the Global Feed).  
  * jobs table specifically for staff-created opportunities.  
* **Storage:** Secure buckets for PDFs (Education) and Images (Posts/Profiles).  
* **Auth:** Role-based access control (RBAC) to restrict "Job Creation" and "User Suspension" to specific IDs.

