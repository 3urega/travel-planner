You are building the frontend for a serious AI-native product.

This is not a generic AI wrapper.
This is not a chatbot skin.
This is not a landing page toy.

You are building a premium product experience for an **Autonomous Travel Operator (ATO)**:
an AI-powered travel planning and execution workspace where the user collaborates with a system that plans, simulates, ranks, pauses for user decisions, and continues execution.

The frontend must feel:
- premium
- calm
- operational
- intelligent
- trustable
- investor-demo quality

The result should feel like a blend of:
- Linear
- Vercel dashboard
- Airbnb / Booking clarity
- Notion / Arc polish

It must NOT feel like:
- a chatbot UI
- a hackathon AI app
- a generic SaaS admin template
- a flashy AI gimmick
- a “Dribbble concept” with no real product structure

---

# PRODUCT CONTEXT

The backend already follows an ATO / graph-based architecture.

Conceptually, the system supports:
- user goal
- plan generation
- search steps
- option ranking
- user selection checkpoints
- simulation
- approval
- execution
- audit trail
- versioning / branching

The frontend should visually reflect this model.

The user should feel:
> “I’m not chatting with AI. I’m operating a travel decision system.”

---

# PRIMARY GOAL

Build **one world-class page** in Next.js:
## `ATO Workspace`

This should be the core MVP product surface.

Do NOT spread effort across multiple weak pages.

The goal is to produce a frontend that already looks:
> “This could actually launch.”

---

# TECH STACK REQUIREMENTS

Use:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

Use modular React components and production-quality structure.

Do NOT dump everything into one giant file.

---

# VERY IMPORTANT PRODUCT RULE

## This is NOT a chat-first UI.

Do not build:
- a central conversation transcript
- message bubbles as the main product
- a typical “user message / assistant message” layout

Instead, build:
- a decision workspace
- stage-based interaction
- option cards
- summary surfaces
- system state panels
- selection-driven interaction

The center of the experience must be:
> structured decisions, not conversation history.

---

# VISUAL DIRECTION

## Overall feel
Dark premium interface with subtle contrast and elegant depth.

Use:
- deep charcoal / slate / zinc backgrounds
- soft glass / matte surfaces where useful
- subtle borders
- rounded corners
- elegant shadows
- spacious layout
- strong typography hierarchy
- high-end SaaS polish

Avoid:
- excessive gradients
- loud neon colors
- overdecorated “AI” aesthetics
- visual noise
- overuse of glassmorphism

---

# STRICT DESIGN PRINCIPLES

## 1) Surface hierarchy
Not every card should feel equally important.

Use at least 3 levels of visual emphasis:

### Level 1 — Hero / active decision surfaces
Examples:
- current stage
- flights selection
- hotel selection

These should feel most prominent.

### Level 2 — Supporting intelligence panels
Examples:
- simulation
- rationale
- selected details
- approval summary

### Level 3 — Utility / metadata panels
Examples:
- progress
- audit trail
- graph state
- versions

If everything looks equally loud, the product feels amateur.

---

## 2) Layout hierarchy
The UI should have strong visual rhythm.

Some areas should feel:
- primary
- decision-heavy
- premium

Other areas should feel:
- supportive
- calm
- contextual

Avoid flat “dashboard tile soup”.

---

## 3) Product feeling
This must feel:
- expensive
- deliberate
- productized
- calm and sharp

The user should immediately think:
> “This is much more than a chatbot.”

---

# MAIN PAGE LAYOUT

Build a **3-column desktop-first layout**.

## Layout structure

┌────────────────────────────────────────────────────────────────────┐
│ Top Header                                                        │
├───────────────┬──────────────────────────────┬─────────────────────┤
│ Left Sidebar  │ Center Workspace             │ Right Inspector      │
└───────────────┴──────────────────────────────┴─────────────────────┘

Use a max-width layout centered on screen.
The design should feel premium and spacious.

---

# PAGE SECTIONS

# 1) TOP HEADER

Build a sticky / semi-sticky premium header.

### Include:
- trip title
  - example: `Paris Christmas Escape`
- route
  - Barcelona → Paris
- dates
  - Dec 23 – Dec 27
- traveler count
- trip status badge
  - `Planning`
  - `Waiting for selection`
  - `Ready for approval`
- actions:
  - Save
  - Share
  - New Version

This header should feel polished and product-grade.

---

# 2) LEFT SIDEBAR — TRIP CONTEXT

This sidebar answers:
> “What trip are we building?”

It should feel stable, calm, and useful.

### Include these sections:

## A. Goal Summary Card
Show:
- origin
- destination
- dates
- travelers
- one-line trip summary

## B. Preferences Card
This must be interactive and premium.

Include controls for:
- budget (input or slider)
- comfort vs price slider
- preferred departure time
- hotel area preference
- direct flights only toggle

These controls should feel elegant and not too form-heavy.

## C. Progress / Stages Card
Show a vertical list of stages with statuses:
- Flights
- Hotel
- Simulation
- Approval
- Execution

Each stage should have one of:
- completed
- active
- waiting
- locked

This should visually reinforce the execution flow.

## D. Versions / Sessions Card
Show a small version history:
- v1 Original
- v2 Cheaper hotels
- v3 Direct flights only

This should hint at branching / graph versions.

---

# 3) CENTER WORKSPACE — CORE PRODUCT SURFACE

This is the most important part of the app.

The center should feel like:
> “the mission control canvas of the trip”

Do NOT turn this into a dashboard soup.
Do NOT turn this into a chat transcript.

Build it as a sequence of **high-quality planning stages**.

---

## A. Workspace Hero / Current Stage Card

At the top of the center workspace, build a beautiful hero card that tells the user what the system is doing now.

Example content:
- “We’re currently selecting your outbound flight”
- “The system has shortlisted the strongest options based on timing, comfort, and cost.”

Also include:
- current stage badge
- subtle “waiting for your decision” state
- maybe a tiny progress indicator

This should feel cinematic, premium, and calm.

---

## B. Active Decision Stage 01 — Flights

Create a section:
## `Choose your outbound flight`

Show **3 premium flight option cards**.

Each flight card must include:
- airline name
- departure time
- arrival time
- duration
- stops / direct info
- price
- recommendation tag if relevant:
  - Cheapest
  - Best value
  - Fastest
  - Most comfortable

Each card must feel alive and premium.

### Card actions:
- Select
- Compare
- Save

One option should be visually recommended.
One option can be selected by default.

### Important:
Selecting a flight should visibly update system state.

This must NOT feel like static content.

---

## C. Active Decision Stage 02 — Hotels

Create a section:
## `Choose your hotel`

Show **3 premium hotel option cards**.

Each hotel card should include:
- thumbnail / image placeholder
- hotel name
- neighborhood
- vibe / distance label
- nightly or total price
- recommendation tags:
  - Best location
  - Best value
  - Most comfortable

### Card actions:
- Select
- Compare
- Show similar

One hotel should be recommended.
One hotel can be selected by default.

The cards should feel like a high-end travel product, not plain database cards.

---

## D. Simulation / Intelligence Summary

Create a premium section:
## `Trip simulation`

This should summarize the currently selected combination of:
- flight
- hotel

Include:
- total estimated cost
- comfort score
- travel friction score
- readiness / confidence
- maybe timeline readiness

This section should feel like:
> “the system thinking with the user”

Use beautiful metric blocks, chips, bars, and elegant summaries.

This should be one of the strongest “wow” moments on the page.

---

## E. Approval / Next Actions Section

Create a lower CTA section that makes the workflow feel actionable.

Include buttons such as:
- Approve current itinerary
- Refine options
- Ask the agent to improve this plan

This should feel like the system is ready to continue once the user decides.

---

# 4) RIGHT INSPECTOR — AGENT / DETAILS / STATE PANEL

This panel answers:
> “Why is the system doing this, and what is selected?”

This should feel like a premium inspector, not a noisy side rail.

Include the following blocks:

---

## A. Selected Item Panel
Show details for the currently selected flight or hotel.

If flight selected:
- airline
- times
- comfort notes
- short rationale

If hotel selected:
- neighborhood
- check-in fit
- price
- short fit summary

This panel should update as selections change.

---

## B. Agent Activity Panel
Very important.

Build a small operational feed titled:
## `Agent activity`

Examples:
- Searching outbound flights…
- Ranking hotel options…
- Recalculating trip budget…
- Waiting for your selection…

This should feel alive and operational.

Use subtle animated status dots.

---

## C. Decision Rationale Panel
Build a panel:
## `Why this was recommended`

Examples:
- “This flight offers the best balance between price and arrival time.”
- “This hotel keeps the itinerary within budget while improving check-in timing.”
- “A direct morning flight would increase total cost by ~€38.”

This panel is a major product differentiator.
It should make the system feel intelligent and trustworthy.

---

## D. Audit / Graph State Panel
Build a compact traceability panel showing system events like:
- goal_created
- flight_search_completed
- flight_ranking_completed
- waiting_user_selection

This should visually reinforce:
> “this system has real state and execution”

Keep it elegant and compact.

---

# INTERACTION REQUIREMENTS

This page should not be a static mock.

Use local mock state to make it feel like a real product.

### Required interactions:
- selecting a flight
- selecting a hotel
- updating selected state visually
- updating simulation summary when selections change
- updating inspector content when selections change
- changing preferences (budget / comfort etc.)
- visually reflecting stage status

No backend hookup is required if it hurts quality.
A polished local-state MVP is preferred over a rushed backend integration.

---

# MOTION / POLISH REQUIREMENTS

Use Framer Motion with restraint and taste.

Good motion:
- section fade/slide in
- card hover lift
- selected card transitions
- inspector content transitions
- animated status indicators
- layout animations where useful

Avoid:
- bouncing cards
- exaggerated spring motion
- gimmicky particles
- “AI magic” animation noise

The motion should feel:
- expensive
- refined
- calm

---

# TYPOGRAPHY REQUIREMENTS

Typography quality is a major signal.

Use strong hierarchy:
- large polished page title
- clear section headings
- subtle supporting labels
- strong emphasis on prices / times / scores

Avoid:
- too many tiny labels
- weak contrast on important information
- excessive all-caps
- flat visual hierarchy

---

# COLOR / ACCENT RULES

Use restrained color discipline.

Recommended:
- mostly neutrals
- one cool premium accent
- semantic success / warning colors only where useful

Good:
- white / zinc / slate / cool indigo
- emerald for success
- amber for warnings

Avoid:
- rainbow badge soup
- too many accent colors
- random gradients

---

# MICROCOPY RULES

Microcopy must feel calm, premium, and useful.

Do NOT use startup cringe or generic AI hype language.

Bad:
- “✨ Let AI plan your dream vacation!”
- “Adventure awaits!”

Good:
- “We’re currently selecting your outbound flight.”
- “This option gives you the best arrival time for hotel check-in.”
- “Waiting for your hotel selection to continue.”

Microcopy should feel:
- product-grade
- calm
- useful
- confident

---

# COMPONENT ARCHITECTURE REQUIREMENTS

Build clean, modular components.

Suggested structure:

- `ATOHeader`
- `ATOSidebar`
- `GoalSummaryCard`
- `PreferencesCard`
- `ProgressStagesCard`
- `VersionHistoryCard`
- `ATOWorkspace`
- `WorkspaceHero`
- `FlightOptionsSection`
- `FlightOptionCard`
- `HotelOptionsSection`
- `HotelOptionCard`
- `SimulationSummaryCard`
- `ApprovalActionsCard`
- `ATOInspector`
- `SelectedItemPanel`
- `AgentActivityPanel`
- `DecisionRationalePanel`
- `AuditTrailPanel`

Also create reusable UI primitives where useful:
- `SurfaceCard`
- `MetricPill`
- `StatusBadge`
- etc.

Keep code production-friendly and maintainable.

---

# REALISTIC MOCK DATA REQUIREMENTS

Use realistic mock travel data.

Example trip:
- Barcelona → Paris
- Dec 23 – Dec 27
- 2 travelers

Include realistic flight options:
- airline
- times
- duration
- price
- tags

Include realistic hotel options:
- names
- areas
- prices
- recommendation labels

Include realistic system activity, rationale, and audit events.

This should feel like a believable product demo, not placeholder lorem ipsum.

---

# RESPONSIVENESS

Desktop is the priority.

Design first for:
- 1440px+
- large laptop
- modern desktop app feel

Then provide reasonable responsive fallback for:
- tablet
- mobile

Do not sacrifice desktop quality to over-optimize mobile too early.

---

# CODE QUALITY RULES

Do not:
- put all UI in one file
- create unreadable giant components
- use poor naming
- leave dead code everywhere
- create ugly inline styling hacks

Do:
- type props well
- keep components focused
- make state readable
- keep styling intentional
- make the code feel like real production frontend

---

# REQUIRED POLISH DETAILS

Please include:
- sticky or semi-sticky header
- elegant section spacing
- premium button states
- subtle card hover feedback
- skeleton / shimmer placeholders if appropriate
- smooth transitions
- realistic chips / tags
- premium empty / helper states

These small details matter a lot.

---

# IMPORTANT ANTI-PATTERNS TO AVOID

Do NOT do any of the following:

- Do not create a chatbot transcript as the primary center UI
- Do not overuse gradients
- Do not make every card identical in weight
- Do not fill the page with tiny noisy widgets
- Do not create a generic admin dashboard
- Do not create a landing page instead of a product UI
- Do not compress all data into tiny unreadable cards
- Do not build a “hackathon AI travel assistant”

If something feels generic, simplify and elevate it.

---

# THREE REQUIRED “WOW” MOMENTS

The UI must contain at least 3 memorable moments:

## Moment 1
A premium workspace hero area that immediately makes the product feel serious.

## Moment 2
Selecting a flight or hotel visibly transforms the workspace and inspector.

## Moment 3
The simulation / intelligence summary feels genuinely “smart” and productized.

If the UI has no memorable moments, it is not good enough.

---

# IMPLEMENTATION GUIDANCE

Build the actual code for the page and components.

You may use local state and mock data to make the experience feel real.

Prioritize:
1. product feel
2. visual hierarchy
3. interaction quality
4. code quality

Over:
- adding too many extra features
- fake backend complexity
- generic dashboard patterns

---

# OUTPUT EXPECTATION

Produce a first version that already feels:
> “This startup could raise money with this demo.”

The result should not merely be “correct”.
It should feel:
- beautiful
- intentional
- premium
- coherent
- operational

Build the first version now.