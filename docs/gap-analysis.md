# AlphaQuant — Business Model vs. Implementation Gap Analysis

> Compares [docs/BMC.pdf](BMC.pdf) ("AlphaQuant – Business Model Canvas 2.0: Từ Sợ đến Hiểu") against the current codebase, cross-referenced with [docs/architecture.md](architecture.md) and [docs/roadmap.md](roadmap.md). No code was modified to produce this document — findings are based on reading the repository and re-verifying specific claims (disclaimer text, payment/persona/leaderboard/RAG code) directly against source.

## Methodology & status definitions

Each Business Model Canvas (BMC) block is checked against what the code actually does today.

| Status | Meaning |
|---|---|
| ✅ **Implemented** | The BMC commitment is functionally present and working end-to-end. |
| 🟡 **Partial** | Some version exists but falls materially short of what the BMC describes (e.g. static instead of AI-personalized, client-side-only instead of enforced, demo data instead of live). |
| ❌ **Missing** | No code exists for this BMC commitment. |
| ⚪ **N/A to codebase** | The BMC item is an organizational/GTM/partnership activity with no direct software surface (noted for completeness, not scored). |

**Priority** — `P0` blocks revenue or creates legal/trust risk if shipped as-is; `P1` core to the stated value proposition; `P2` important but not launch-blocking; `P3` nice-to-have / can wait for scale.

**Technical Complexity** uses the same T-shirt sizing as `docs/roadmap.md` (`XS`/`S`/`M`/`L`) plus `XL` for items too large for a single roadmap milestone and requiring their own multi-milestone workstream.

---

## At-a-glance summary

| BMC Block | Item | Status | Priority | Complexity |
|---|---|---|---|---|
| Customer Segments | Sinh viên 18–22 (primary) | 🟡 Partial | P1 | M |
| Customer Segments | HSTHPT 15–17 + parental consent flow | ❌ Missing | P1 | M |
| Value Proposition | AI-personalized curriculum in expert-approved framework | 🟡 Partial | **P0** | **XL** |
| Value Proposition | AI Tutor — contextual explanations | ✅ Implemented (core) | P0 | — |
| Value Proposition | AI Tutor — RAG grounding | ❌ Missing | **P0** | L |
| Value Proposition | AI Tutor — Response Validation | ❌ Missing | **P0** | S (roadmap M13) |
| Value Proposition | AI Tutor — Input/Output Moderation Filter | ❌ Missing | **P0** | M |
| Value Proposition | Paper Trading on real data, virtual money | 🟡 Partial | P1 | M |
| Channels | Web-app | ✅ Implemented | — | — |
| Channels | Short-form content (TikTok/Reels) support | ❌ Missing (no in-app hooks) | P3 | S |
| Channels | School clubs (CLB) | ⚪ N/A to codebase | — | — |
| Customer Relationships | AI difficulty adaptation (Beginner→Advanced) | 🟡 Partial | P1 | M |
| Customer Relationships | Gamification / leaderboard | 🟡 Partial | P2 | M |
| Customer Relationships | Cross-school Paper Trading | ❌ Missing | P2 | L |
| Revenue Streams | Subscription (Free → 79.000đ/tháng Premium) | ❌ Missing | **P0** | L (roadmap M18 = foundation only) |
| Revenue Streams | B2B/sponsorship (workshops, CTCK/e-wallet contests) | ❌ Missing | P2 | L |
| Key Resources | RAG + Prompt Engineering + Response Validation | 🟡 Partial (prompt only) | P0 | L |
| Key Resources | Curated curriculum templates (5–10, persona/risk-tagged) | ❌ Missing | P0 | L |
| Key Resources | Guardrails + fixed on-screen legal disclaimer | 🟡 Partial (disclaimer only) | P0 | M |
| Key Resources | Real-time/historical market data & analytics engine | 🟡 Partial | P1 | M |
| Key Activities | Expert curriculum review workflow | ❌ Missing | P1 | L |
| Key Activities | Hallucination monitoring/control | ❌ Missing | P0 | M |
| Key Partners | CTCK / e-wallet integrations | ❌ Missing | P2 | L |
| Cost Structure | Documented, reproducible infra | 🟡 Partial | P2 | S |

---

## 1. Implemented Features

Features that work end-to-end and functionally deliver on a BMC commitment.

### 1.1 Web-app channel
- **BMC commitment:** "Web-app AlphaQuant" (Kênh phân phối).
- **Evidence:** `frontend/index.html` + `frontend/app.js` (main dashboard), `frontend/Learn/` (learning module), `ai-tutor/` (AI chat) — all functional, deployed as static pages.
- **Note:** delivered as three loosely-coupled vanilla-JS apps rather than one cohesive web-app (see architecture.md §2, §8), which is a maintainability gap even though the channel itself exists.

### 1.2 AI Tutor — contextual explanation (core mechanic)
- **BMC commitment:** "AI Tutor giải thích thuật ngữ/dữ liệu theo ngữ cảnh."
- **Evidence:** `POST /api/ai/tutor` (`backend/routes/ai.js`) calls Google Gemini (`gemini-2.5-flash`) via `backend/services/geminiServices.js`, using a prompt (`backend/prompts/tutorPrompt.js`) that injects `stockContext` and `userLevel`. The chat UI (`ai-tutor/tutorPage.js`) round-trips real questions to real answers, seeded with the ticker the user was last viewing on the dashboard (`alphaquant_tutor_stock_context_v1` localStorage bridge).
- **Assessment:** this is the one place in the product where "AI" is real, not simulated (contrast with §2 below). It functionally satisfies the base value proposition, but is missing three of the four architectural components the BMC itself specifies as required (RAG, Response Validation, Moderation Filter — see §3.2–3.4).

### 1.3 Historical market data pipeline
- **BMC commitment (partial credit toward):** "Dữ liệu thị trường thời gian thực/lịch sử & Analytics Engine" (Key Resources).
- **Evidence:** `backend/update_stock.py`, scheduled daily via `.github/workflows/update-stock.yml`, pulls real OHLCV history (vnstock) for 8 tickers into Supabase `stock_prices`, consumed by the dashboard for candlestick/volume/price charts and real volatility/Sharpe/max-drawdown calculations.
- **Assessment:** the "lịch sử" (historical) half of this Key Resource is genuinely implemented with real data. See §2.4 for why it's scored Partial overall.

### 1.4 Learning content + basic gamification loop
- **BMC commitment (partial credit toward):** "Cộng đồng học tập, gamification/leaderboard" (Customer Relationships).
- **Evidence:** `frontend/Learn/app.js` — 7 lessons with quizzes, XP awards, level-ups, streaks, badges (`renderAchievements`), plus a Portfolio Sandbox and a practice exercise.
- **Assessment:** the gamification *mechanics* (XP/level/badges) are real and working. See §2.5 for the parts of this BMC line that are missing (leaderboard, cross-user visibility, cross-school competition).

### 1.5 On-screen legal disclaimer
- **BMC commitment (partial credit toward):** "Disclaimer pháp lý cố định trên giao diện" (Key Resources).
- **Evidence:** a persistent disclaimer renders in the dashboard sidebar on every tab (`frontend/index.html:302-304`, "⚠️ Dữ liệu mô phỏng cho mục đích demo. Không phải tư vấn đầu tư."), plus an additional disclaimer on the AI Analysis tab (`frontend/index.html:489`) and a hardcoded line in the legacy chatbot's canned response (`frontend/app.js:1379`).
- **Assessment:** this specific sub-item of the "Guardrails + Disclaimer" Key Resource is reasonably well covered — it's simple, but it is fixed on-screen as the BMC requires. The other half of that same BMC line (Moderation Filter) is entirely absent — see §3.4.

---

## 2. Partially Implemented Features (Gaps Against the BMC)

These exist in some form but fall materially short of the BMC's description. Ordered by priority.

### 2.1 AI-personalized curriculum within an expert-approved framework
- **BMC commitment:** "Lộ trình AI cá nhân hóa theo hành vi, trong khung nội dung do chuyên gia ĐH Ngoại Thương xây dựng và kiểm duyệt knowledge base/lộ trình mẫu & kiểm duyệt" — listed **first** under Giá trị cung cấp, i.e. the flagship differentiator.
- **What exists:** `frontend/Learn/app.js` has a fixed `LESSONS` array (7 hardcoded concepts) delivered in a fixed order to every user. `POST /api/ai/tutor` accepts a `userLevel` field that only nudges response tone/length in a single chat reply — it does not reorder, select, or adapt the curriculum itself.
- **What's missing:** no behavior tracking, no adaptive sequencing algorithm, no persona/risk tagging on content, and — critically — no workflow through which a Đại học Ngoại Thương subject-matter expert authors or approves the curriculum. The "khung nội dung do chuyên gia xây dựng và kiểm duyệt" (expert-built-and-approved framework) that the entire personalization engine is supposed to operate *inside of* does not exist as a system; it's just a hardcoded array a developer wrote.
- **Priority:** **P0** — this is the named flagship value proposition; everything else in the BMC (trust story, premium pricing justification, differentiation from generic finance content) depends on it existing.
- **Business impact:** without this, AlphaQuant is a static 7-lesson course plus a chatbot — functionally similar to free YouTube/TikTok finance content, undermining the willingness-to-pay assumption behind the ₫79.000/month subscription and the "được chuyên gia đứng sau" (backed by experts) trust claim in the BMC's own tagline.
- **Technical complexity:** **XL.** This is not a single roadmap milestone — it requires (a) a content model with persona/risk tags, (b) an admin/CMS workflow for expert authoring and monthly review (a Key Activity the BMC calls out explicitly), (c) behavior-tracking instrumentation, and (d) an adaptive-sequencing service. Recommend treating this as its own dedicated roadmap phase with 4–6 sub-milestones, not a single item.

### 2.2 AI Tutor — real-time & historical data depth
- **BMC commitment:** "Dữ liệu thị trường thời gian thực/lịch sử & Analytics Engine."
- **What exists:** daily-batch historical sync (real data) into Supabase; client-side computation of volatility, Sharpe ratio, and max drawdown from that real data (architecture.md §2.1, §10).
- **What's missing:** nothing is "thời gian thực" (real-time/intraday) — the freshest price data is up to ~24 hours old given the daily cron cadence; **Beta is not computed from real data at all** — it's a seeded-random value in a fixed range presented next to genuinely computed metrics (architecture.md §11.8, roadmap M7); "Analytics Engine" is a handful of client-side formulas, not a server-side engine with any deeper risk modeling (no correlation matrices, no scenario analysis, no factor exposure).
- **Priority:** P1.
- **Business impact:** a fabricated Beta shown alongside real metrics is a correctness/trust risk specific to a platform whose stated purpose is teaching people to read *real* risk data — this is the same finding as architecture.md §11.8.
- **Technical complexity:** M (roadmap M7 already scopes the Beta fix; a true real-time feed and a server-side analytics engine would each be additional, larger efforts beyond M7).

### 2.3 Paper Trading on real data, virtual money
- **BMC commitment:** "Paper Trading - dữ liệu thật, tiền ảo, không rủi ro thật."
- **What exists:** `frontend/Learn/app.js`'s Portfolio Sandbox (`handleTrade`) implements virtual-cash buy/sell (starting ₫100,000,000) — the "tiền ảo, không rủi ro thật" half is genuinely delivered.
- **What's missing:** the Sandbox operates against a small hardcoded `STOCKS` array (5 tickers) rather than the live-synced `stock_prices` feed the main dashboard uses (which itself only surfaces 3 of the 8 synced tickers) — so the "dữ liệu thật" (real data) half is not verifiably true, and the sidebar disclaimer literally tells users the data is simulated. There is also no trade history, no P&L tracking over time, and no reconciliation against actual historical prices for backtesting realism.
- **Priority:** P1.
- **Business impact:** Paper Trading is a named, differentiating value prop for a risk-free learning experience; if the "real data" half is not actually true, the feature doesn't deliver its stated safety/realism promise and risks user confusion between demo and live data.
- **Technical complexity:** M — wire the Sandbox to the same backend-mediated price source proposed in roadmap M8, extend it to the full synced ticker universe, add trade history/P&L persistence (overlaps with roadmap M12's user-state persistence work).

### 2.4 AI difficulty adaptation (Beginner → Advanced)
- **BMC commitment:** "Đồng hành cá nhân hóa (AI điều chỉnh độ khó Beginner→Advanced)" (Customer Relationships).
- **What exists:** the AI Tutor prompt accepts and honors a `userLevel` parameter (`backend/prompts/tutorPrompt.js`), so individual chat answers are tailored in complexity.
- **What's missing:** this adaptation is scoped to a single chat response, not to the overall learning relationship — the Learn module's lesson content and ordering do not change based on demonstrated skill, quiz performance, or declared level.
- **Priority:** P1 (feeds directly into §2.1).
- **Business impact:** users at different skill levels get the same fixed course; retention risk for both very-beginner users (overwhelmed) and more advanced users (bored/churned).
- **Technical complexity:** M, assuming the curriculum content model from §2.1 exists first; trivial-to-moderate on top of that foundation.

### 2.5 Gamification / leaderboard
- **BMC commitment:** "Cộng đồng học tập, gamification/leaderboard Paper Trading giữa các trường" (Customer Relationships).
- **What exists:** per-user XP/level/streak/badges (§1.4), entirely local.
- **What's missing:** (a) no leaderboard of any kind exists; (b) all gamification state lives only in `localStorage` (`alphaquant_learning_state_v1`), so it isn't visible to anyone but the user themself, let alone comparable across a school or nationally; (c) the dashboard's "Community" tab is a static, non-interactive mockup with hardcoded example posts (architecture.md §2.1) — no real community backend exists at all; (d) there is no concept of a "school"/organization entity anywhere in the schema, which the cross-school competition idea depends on.
- **Priority:** P2.
- **Business impact:** cross-school competitive Paper Trading is called out specifically in the BMC as a relationship/retention mechanic (likely tied to the CLB/school channel go-to-market) — without server-side gamification state and a school entity model, this GTM motion has no product to support it.
- **Technical complexity:** M for server-persisted, user-visible leaderboards (builds on roadmap M12); **L** if a full school/organization/cross-school competition model is required.

---

## 3. Missing Features

No code exists for these BMC commitments today.

### 3.1 Subscription revenue (Free trial → ₫79.000/month Premium)
- **BMC commitment:** "Subscription: Free 1-2 tháng → Premium 79.000đ/tháng" (Dòng doanh thu) — the primary revenue stream.
- **Evidence of absence:** no payment gateway integration, no pricing-tier data model, no trial-period countdown logic anywhere in the codebase. The only "premium" concept that exists is `ai-tutor/premiumAccess.js`'s client-side flag check, which is cosmetic, unauthenticated, and trivially bypassed from devtools (architecture.md §6.2), and it is **not connected to any payment event** — there is nothing in the system that could currently tell you whether a given user has ever paid for anything.
- **Priority:** **P0.**
- **Business impact:** this is the company's stated primary revenue stream, and it is currently 0% implemented — every day without it is unmonetized. It also blocks validating willingness-to-pay, one of the riskiest assumptions in the BMC.
- **Technical complexity:** **L.** `docs/roadmap.md` M18 scopes a Stripe-based foundation (schema + checkout-session stub) but explicitly stops short of a full flow; note the BMC's own partner list (MoMo, ZaloPay) suggests a Vietnamese payment gateway (VNPay/MoMo/ZaloPay) may be the more market-appropriate choice than Stripe, which would change M18's implementation but not its scope. Full delivery (trial countdown, dunning/renewal, tier enforcement wired to §2.1/§3.4) is realistically several additional milestones beyond M18.

### 3.2 RAG (retrieval-augmented generation) for the AI Tutor
- **BMC commitment:** "Core AI Architecture: RAG (truy xuất tài liệu đã được chuyên gia kiểm duyệt)" (Key Resources) — explicitly the *first* listed component of the AI architecture.
- **Evidence of absence:** `backend/services/geminiServices.js` calls Gemini directly with a hand-written system prompt and no retrieval step; there is no vector store, no document index, and no "chuyên gia kiểm duyệt" (expert-vetted) knowledge base anywhere in the repo for the model to retrieve from.
- **Priority:** **P0.**
- **Business impact:** every AI Tutor answer today is generated from the model's general knowledge alone, ungrounded in any AlphaQuant/expert-approved source of truth. This directly contradicts the BMC's safety architecture and is the root cause of the unmanaged hallucination risk the BMC's own Key Activities list ("Phát triển & kiểm soát Hallucination của AI Tutor") calls out as necessary work.
- **Technical complexity:** **L** — requires a document ingestion/curation pipeline (tied to the expert-review workflow in §2.1), an embedding/vector-store choice, and a retrieval step inserted into `backend/services/geminiServices.js` before prompt construction.

### 3.3 Response Validation (code-level output check)
- **BMC commitment:** "Response Validation (kiểm tra nội dung trước khi trả lời người dùng)" — the third listed Core AI Architecture component.
- **Evidence of absence:** `backend/prompts/tutorPrompt.js` *instructs* the model not to give buy/sell/hold recommendations, but nothing in `backend/routes/ai.js` inspects the model's actual output before it's returned to the user — the Gemini response is passed straight through (architecture.md §9).
- **Priority:** **P0.**
- **Business impact:** the gap between "the README/BMC says responses are validated" and "no code validates anything" is a direct compliance/trust exposure for a product whose core promise is that AI *cannot* give investment recommendations.
- **Technical complexity:** S — already scoped concretely as `docs/roadmap.md` M13 ("AI response validation/guardrail layer"), the smallest of the three missing AI-architecture components to close.

### 3.4 Guardrails / Input & Output Moderation Filter
- **BMC commitment:** "Guardrails lớp ngoài (Input/Output Moderation Filter)" (Key Resources).
- **Evidence of absence:** no separate moderation layer exists on either the inbound question (`backend/routes/ai.js` only checks length/type, not content) or the outbound answer (see §3.3) — no profanity/abuse/prompt-injection filtering, no PII scrubbing.
- **Priority:** **P0** (bundled with §3.3 as one safety initiative in practice, but scored separately since the BMC lists it as a distinct component).
- **Business impact:** without input moderation, the tutor endpoint is exposed to prompt-injection and abusive-input risk with no defense beyond Gemini's own built-in behavior; without output moderation, nothing catches an inappropriate response before a (potentially underage, per the HSTHPT 15–17 segment) user sees it.
- **Technical complexity:** M — a superset of roadmap M13; recommend implementing input and output moderation as one combined milestone alongside M13's response validator.

### 3.5 Curated curriculum templates (5–10, persona/risk-tagged, expert-approved)
- **BMC commitment:** "Bộ lộ trình mẫu (5–10 template) do chuyên gia định nghĩa & duyệt theo persona/mức rủi ro" (Key Resources), and the matching Key Activity "Chuyên gia định nghĩa & duyệt bộ lộ trình mẫu theo persona/rủi ro."
- **Evidence of absence:** the single hardcoded `LESSONS` array in `frontend/Learn/app.js` has no persona or risk-level tagging, no versioning, and — since there is no admin/CMS surface anywhere in the codebase (confirmed in architecture.md §8, §12) — no mechanism by which a Đại học Ngoại Thương expert could define, review, or approve a template even if the content model supported it.
- **Priority:** **P0** (this is the content substrate that §2.1's personalization engine depends on).
- **Business impact:** same as §2.1 — without this, the "backed by experts" trust claim is not verifiable or operational; it's an assertion, not a system.
- **Technical complexity:** L — content model + a minimal expert-facing review/approval tool (could reasonably extend `docs/roadmap.md` M16's admin-MVP direction rather than building a separate system from scratch).

### 3.6 Monthly expert review workflow / hallucination-escalation loop
- **BMC commitment:** "Chuyên gia review định kỳ (hàng tháng) hoặc khi AI đề xuất lệch khung" and "Phát triển & kiểm soát Hallucination của AI Tutor" (Key Activities).
- **Evidence of absence:** nothing in the codebase logs, flags, or surfaces AI Tutor responses for expert review; there is no concept of "AI đề xuất lệch khung" (AI recommendation deviating from the approved framework) detection at all, since there is no framework (§2.1, §3.5) for a response to deviate *from* in the first place.
- **Priority:** P1 (elevated to P0-adjacent once §3.2–§3.5 exist, since review tooling is only useful after there's a framework and validator producing signal to review).
- **Business impact:** this is the mechanism the BMC relies on to "giữ tín nhiệm mà vẫn scale được" (maintain trust while scaling) — without it, quality/safety oversight is entirely manual and ad hoc, which doesn't scale past a handful of users.
- **Technical complexity:** M, once §3.3 (Response Validation) exists to produce the flagged-response log this workflow would consume; a review-queue admin view is a natural extension of roadmap M16.

### 3.7 CTCK / e-wallet partner integrations
- **BMC commitment:** "CTCK/tổ chức tài chính: SSI, TCBS, VNDirect" and "Ví điện tử: MoMo, ZaloPay" (Đối tác chính), feeding the B2B/sponsorship revenue stream ("Workshop, cuộc thi với CTCK & ví điện tử").
- **Evidence of absence:** the current market-data source is `vnstock` (a third-party aggregator/library), not a direct brokerage feed from any of the three named CTCK partners; no payment gateway of any kind (Stripe, VNPay, MoMo, ZaloPay) is integrated (see also §3.1).
- **Priority:** P2 (secondary revenue stream, not the primary one).
- **Business impact:** blocks the B2B/sponsorship revenue line and any co-branded workshop/contest GTM motion described in the BMC; also means the product's core data provenance story ("backed by SSI/TCBS/VNDirect") isn't technically true today.
- **Technical complexity:** L — each brokerage integration is its own API-integration effort with likely partnership/legal lead time exceeding the engineering work itself; e-wallet integration is bundled with §3.1's payment work.

### 3.8 Segment-aware onboarding & parental consent (HSTHPT 15–17)
- **BMC commitment:** "Phụ: HSTHPT 15–17t — đầu tư thật cần phụ huynh đồng ý; đăng ký/thanh toán có phụ huynh tham gia" (Phân khúc khách hàng).
- **Evidence of absence:** `backend/routes/auth.js` has one undifferentiated signup flow (`username`/`password`) with no age field, no role/segment distinction, and no parental-consent or co-registration mechanism of any kind.
- **Priority:** P1.
- **Business impact:** blocks legally/ethically onboarding the secondary customer segment as the BMC describes it (parent-involved registration and payment), and — combined with §3.1 having no billing at all — means neither named customer segment currently has a monetization path that matches how the BMC says they'd pay.
- **Technical complexity:** M — new profile fields, an age-gate at signup, and a parent co-consent/co-payment flow (the payment half depends on §3.1 existing first).

### 3.9 In-app support for short-form content channel (TikTok/Reels)
- **BMC commitment:** "Kênh nội dung ngắn (TikTok/Reels)" (Kênh phân phối).
- **Evidence of absence:** no shareable-content generation (e.g., a shareable "risk score" or "lesson completed" card), no social share buttons, no deep-link/UTM handling for campaign attribution anywhere in the frontend.
- **Priority:** P3.
- **Business impact:** minor — this channel can operate today purely as external content driving traffic to the web-app; the gap only matters for growth-loop efficiency (referral attribution, shareable moments), not core functionality.
- **Technical complexity:** S — share-card generation and basic UTM capture are both small, well-scoped additions.

---

## 4. Cross-cutting risk

Three findings recur across multiple BMC blocks and are worth calling out as a single systemic risk rather than nine separate ones:

1. **The entire "trust" architecture the BMC is built around — expert-approved content, RAG-grounded answers, validated/moderated output, a scalable expert-review loop — does not exist yet.** Today's AI Tutor is a capable but ungrounded, unvalidated LLM call. This is the single biggest gap between the business model and the product, spanning §2.1, §3.2, §3.3, §3.4, §3.5, and §3.6.
2. **The entire revenue model has no supporting code.** Subscription billing, trial periods, and B2B/sponsorship tooling are all at 0% (§3.1, §3.7) — the product currently has no way to generate revenue even if user demand existed today.
3. **Customer-segment differentiation is entirely absent**, which quietly blocks both revenue paths above from working correctly even once built — a single undifferentiated signup flow can't support "sinh viên tự trả" vs. "HSTHPT cần phụ huynh đồng ý và tham gia thanh toán" as two different registration/billing paths (§3.8).

Recommendation: treat "Trust/Safety AI architecture" and "Monetization" as the two next major roadmap phases after the security/data-integrity work already sequenced in `docs/roadmap.md`, since nearly every P0 item above rolls up into one of those two initiatives.
