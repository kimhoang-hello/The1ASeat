# Ghế 1A Recommendation Engine — Backend Spec V1

## Purpose

Build a deterministic, explainable recommendation engine for Ghế 1A that answers:

> Given the user's current situation and goal, what is the most sensible next move?

The engine must **not** assume that opening a new credit card is always the right answer.

Possible outputs include:

- Open a specific card
- Earn more of a specific points currency
- Diversify into another points ecosystem
- Keep existing points flexible
- Do not transfer points yet
- Do not open a new card
- Focus on award availability instead
- Wait for a better offer

The core product philosophy is:

```text
What does the user want?
↓
What do they already have?
↓
What are they actually missing?
↓
What strategies can solve that gap?
↓
Is opening a card even the right strategy?
↓
If yes, which available product solves it best right now?
↓
Why?
```

Not:

```text
Which affiliate card has the highest score?
```

---

# 1. Core Architecture

```text
User Input
    ↓
User Profile
    ↓
Goal Normalizer
    ↓
Portfolio Analyzer
    ↓
Strategy Generator
    ↓
Needs Engine
    ↓
Product Eligibility / Suitability Filter
    ↓
Intent-specific Scoring
    ↓
Editorial Rules
    ↓
Recommendation Ranking
    ↓
Explanation Payload
    ↓
LLM
    ↓
User-facing Recommendation
```

The LLM only performs the final explanation step.

The LLM must never decide which product ranks first.

---

# 2. Recommended Stack

V1:

```text
Next.js
Supabase
PostgreSQL
TypeScript
Server-side recommendation engine
OpenAI API only for explanation
```

Do not add:

- Vector database
- Agent framework
- Graph database
- ML ranking
- AI-generated eligibility logic

The recommendation engine must be deterministic and testable.

---

# 3. Database Design

## 3.1 `products`

Master record for products.

```sql
products
--------
id uuid PRIMARY KEY
slug text UNIQUE
name text
issuer_id uuid
country char(2)
product_type enum
network enum
personal_or_business enum
points_program_id uuid nullable
annual_fee numeric
currency char(3)
is_active boolean
affiliate_available boolean
affiliate_url text nullable
official_url text
created_at timestamptz
updated_at timestamptz
```

`product_type`:

```text
credit_card
bank_account
brokerage
bill_payment
other
```

V1 recommendation scope is credit cards only, but do not make the schema credit-card-only.

---

## 3.2 `issuers`

```sql
issuers
-------
id uuid PRIMARY KEY
name text
country char(2)
official_url text
```

Examples:

```text
American Express
TD
CIBC
RBC
Scotiabank
BMO
```

---

## 3.3 `points_programs`

```sql
points_programs
---------------
id uuid PRIMARY KEY
slug text UNIQUE
name text
program_type text
transferable boolean
default_currency_value numeric nullable
```

Examples:

```text
amex_mr
aeroplan
avion
scene_plus
marriott_bonvoy
british_airways_avios
flying_blue
asia_miles
```

`default_currency_value` is only for relative calculations.

Do not present it as an absolute public CPP truth.

---

## 3.4 `transfer_paths`

```sql
transfer_paths
--------------
id uuid PRIMARY KEY
source_program_id uuid
destination_program_id uuid
ratio_from numeric
ratio_to numeric
effective_from date
effective_to date nullable
is_active boolean
source_url text
verified_at timestamptz
```

Examples:

```text
Amex MR → Aeroplan
Amex MR → Avios
Avion → Avios
Marriott → airline partner
```

V1 only needs one-hop transfers.

Do not implement multi-hop transfer optimization in V1.

---

## 3.5 `offers`

Product and offer must be separate entities.

```sql
offers
------
id uuid PRIMARY KEY
product_id uuid
name text
start_date date
end_date date nullable

bonus_currency_id uuid
headline_bonus numeric nullable

minimum_spend numeric nullable
minimum_spend_months numeric nullable

annual_fee_first_year numeric nullable
annual_fee_rebate numeric nullable

public_offer_value numeric nullable
ghe1a_offer_score numeric nullable

is_targeted boolean
is_public boolean
is_active boolean

source_url text
verified_at timestamptz
effective_from date
effective_to date nullable
```

---

## 3.6 `offer_components`

Do not model all welcome offers as one headline number.

```sql
offer_components
----------------
id uuid PRIMARY KEY
offer_id uuid
sequence integer

component_type text
points_amount numeric nullable
cash_amount numeric nullable

spend_requirement numeric nullable
spend_window_days integer nullable

condition_text text nullable
```

Example:

```text
10K on first purchase
40K after $3,000 / 3 months
10K after anniversary
```

The engine must distinguish:

```text
headline bonus
vs
realistically usable bonus
```

---

## 3.7 `earning_rates`

```sql
earning_rates
-------------
id uuid PRIMARY KEY
product_id uuid
category_id uuid
multiplier numeric
points_program_id uuid
cap_amount numeric nullable
cap_period text nullable
effective_from date
effective_to date nullable
```

Example categories:

```text
grocery
dining
gas
travel
air_canada
hotel
drugstore
recurring
foreign_currency
everything_else
```

---

## 3.8 `benefits`

```sql
benefits
--------
id uuid PRIMARY KEY
slug text UNIQUE
name text
category text
```

Examples:

```text
free_checked_bag
preferred_aeroplan_pricing
maple_leaf_lounge
airport_priority
no_fx_fee
travel_credit
hotel_status
companion_pass
nexus_credit
```

---

## 3.9 `product_benefits`

```sql
product_benefits
----------------
id uuid PRIMARY KEY
product_id uuid
benefit_id uuid

numeric_value numeric nullable
text_value text nullable

conditions jsonb nullable

effective_from date
effective_to date nullable
source_url text nullable
verified_at timestamptz
```

Benefits must be structured because value depends on card tier and user context.

Do not model "Aeroplan card" as one generic benefit.

---

## 3.10 `eligibility_rules`

Eligibility logic must be data-driven where practical.

```sql
eligibility_rules
-----------------
id uuid PRIMARY KEY
product_id uuid
rule_type text
operator text
value jsonb
severity text
effective_from date
effective_to date nullable
source_url text nullable
verified_at timestamptz
```

`severity`:

```text
hard
soft
unknown
```

Important:

Credit score must **not** be treated as a hard eligibility rule.

If included at all, it is informational metadata or a soft signal only.

---

# 4. User Data Model

## 4.1 `user_profiles`

```sql
user_profiles
-------------
id uuid PRIMARY KEY
country char(2)
province text nullable

annual_income_range text nullable

annual_fee_tolerance numeric nullable
business_cards_allowed boolean

created_at timestamptz
updated_at timestamptz
```

Prefer income ranges over exact income unless exact income is genuinely needed.

Example:

```text
<60K
60–80K
80–150K
150K+
Prefer not to say
```

---

## 4.2 `user_spend_profiles`

```sql
user_spend_profiles
-------------------
user_id uuid PRIMARY KEY

monthly_total numeric nullable

grocery numeric nullable
dining numeric nullable
gas numeric nullable
travel numeric nullable
recurring numeric nullable
other numeric nullable

minimum_spend_capacity_3m numeric nullable
```

`minimum_spend_capacity_3m` is especially important.

Monthly spend is not the same as how much spend a user can realistically redirect to a new card.

---

## 4.3 `user_cards`

```sql
user_cards
----------
id uuid PRIMARY KEY
user_id uuid
product_id uuid
opened_date date nullable
status text
```

Status:

```text
active
closed
previously_held
```

`previously_held` matters for future welcome-bonus eligibility logic.

---

## 4.4 `user_point_balances`

```sql
user_point_balances
-------------------
user_id uuid
program_id uuid
balance numeric
updated_at timestamptz
```

Do not store loyalty account numbers.

Only points balances are needed.

---

# 5. Goals

## 5.1 `goals`

```sql
goals
-----
id uuid PRIMARY KEY
user_id uuid
goal_type text
priority integer nullable
goal_data jsonb
created_at timestamptz
```

V1 supports:

```text
next_card
earn_points
diversify
trip
```

---

## 5.2 Trip goal structure

```json
{
  "origin": "YYZ",
  "destination_region": "JAPAN",
  "destination_airport": "TYO",
  "cabin": "business",
  "passengers": 2,
  "travel_start": "2027-03-01",
  "travel_end": "2027-05-31",
  "flexibility": "high"
}
```

`destination_airport` is optional.

Destination region is more important than a single airport.

---

# 6. Award Strategy Model

Do not store fake precision like:

```text
YYZ → Tokyo Business = 75K Aeroplan
```

Instead use strategy ranges.

## `award_strategies`

```sql
award_strategies
----------------
id uuid PRIMARY KEY

origin_region text
destination_region text
cabin text

program_id uuid

strategy_name text

points_low numeric nullable
points_typical numeric nullable
points_high numeric nullable

cash_surcharge_level text nullable
availability_difficulty text nullable
booking_complexity text nullable

confidence text

effective_from date
effective_to date nullable

source_url text nullable
verified_at timestamptz
```

Example concept:

```text
Canada → Japan
Business
Aeroplan / Star Alliance strategy
points range: X–Y
availability: medium/hard
```

The engine works with ranges and strategy quality, not a fake exact price.

---

# 7. Portfolio Analyzer

Input:

```json
{
  "balances": {},
  "cards": [],
  "transfer_paths": []
}
```

Output example:

```json
{
  "direct": {
    "aeroplan": 80000,
    "amex_mr": 120000
  },

  "accessible": {
    "aeroplan": 200000,
    "avios": 120000
  },

  "concentration": {
    "aeroplan_family": 0.67,
    "avios_family": 0.12,
    "hotel": 0.21
  },

  "flexibility_score": 0.72
}
```

## Critical rule: no transferable-points double counting

If user has:

```text
100K MR
```

the engine must not claim the user simultaneously has:

```text
100K Aeroplan
+
100K Avios
+
100K Flying Blue
```

Separate:

```text
direct balance
```

from:

```text
potentially accessible balance
```

---

# 8. Strategy Generator

This is the actual decision layer.

Before thinking about cards, generate possible actions.

Example:

```json
[
  {
    "strategy": "USE_EXISTING_POINTS",
    "score": 0.91
  },
  {
    "strategy": "EARN_FLEXIBLE_POINTS",
    "score": 0.76
  },
  {
    "strategy": "EARN_AEROPLAN",
    "score": 0.34
  }
]
```

Possible strategy/action types:

```text
USE_EXISTING_POINTS
EARN_FLEXIBLE_POINTS
EARN_SPECIFIC_CURRENCY
DIVERSIFY
WAIT_FOR_BETTER_OFFER
OPEN_CARD
FOCUS_ON_AVAILABILITY
BUILD_POINTS
NO_NEW_CARD
```

---

# 9. Needs Engine

Output must be standardized.

Example:

```json
{
  "currency_needs": {
    "aeroplan": 0.15,
    "amex_mr": 0.70,
    "avios": 0.61
  },

  "benefit_needs": {
    "free_bag": 0.20,
    "lounge": 0.05
  },

  "portfolio_needs": {
    "diversification": 0.80,
    "flexibility": 0.90
  },

  "action_need": {
    "new_card": 0.40
  }
}
```

Range:

```text
0 = irrelevant
1 = extremely useful
```

The questionnaire should feed the Needs Engine.

It should not directly choose cards.

---

# 10. Intent-specific Scoring

Do not create one universal card score.

Use separate scoring functions:

```text
score_card_for_trip()
score_card_for_next_card()
score_card_for_diversification()
score_card_for_earning()
```

---

## 10.1 Next Card scoring

```text
25% Current Offer Quality
20% Spend Fit
15% Long-term Earn Fit
15% Currency Fit
10% Benefits Fit
10% Portfolio Diversification
5% Ghế 1A Editorial Adjustment
```

---

## 10.2 Trip Goal scoring

```text
35% Trip Currency Utility
20% Points Gap Reduction
15% Offer Quality
10% Minimum Spend Fit
10% Flexibility Value
5% Relevant Travel Benefits
5% Editorial Adjustment
```

---

## 10.3 Diversification scoring

```text
35% New Currency Exposure
25% Transfer Flexibility
15% Earn Fit
10% Offer Quality
10% Spend Fit
5% Editorial Adjustment
```

---

# 11. Offer Quality

Do not score offers only by headline bonus.

Conceptually:

```text
Offer Quality =
    historical percentile
  + usable bonus ratio
  + spend difficulty
  + annual fee cost
  + expiry urgency
```

Example:

Advertised:

```text
100K
```

But:

```text
60K obtainable in first 3 months
40K only after $40K annual spend
```

For many users:

```text
usable bonus = 60K
```

not 100K.

---

# 12. Historical Offer Percentile

Compare current offer with historical offers for the same product.

Output:

```text
0–100 percentile
```

Example:

```text
95 = near historical high
50 = normal
10 = weak
```

This same data should later power Ghế 1A Deal Hub.

---

# 13. Minimum Spend Fit

Do not make minimum spend purely pass/fail.

Example:

```text
Required spend: $6,000 / 3 months
User capacity: $7,000
```

Score can be:

```text
0.75
```

If:

```text
required = $3K
capacity = $9K
```

Score:

```text
1.0
```

If:

```text
required = $10K
capacity = $6K
```

The card may remain a candidate but receive:

```text
strong penalty
warning = spending requirement likely unsuitable
```

---

# 14. Eligibility vs Suitability

These must remain separate concepts.

Eligibility:

```text
Can the user likely meet published requirements?
```

Suitability:

```text
Does this product make sense for this user?
```

Example:

A user may be eligible for a $799 annual fee card but say:

```text
max annual fee = $200
```

That makes the card unsuitable, not ineligible.

---

# 15. Editorial Rules Engine

Use data-driven rules.

## `editorial_rules`

```sql
editorial_rules
---------------
id uuid PRIMARY KEY
name text
intent text
priority integer

condition jsonb
action jsonb

enabled boolean
version integer
created_at timestamptz
updated_at timestamptz
```

Example:

```json
{
  "condition": {
    "portfolio.aeroplan_concentration": {
      ">": 0.70
    }
  },

  "action": {
    "aeroplan_product_score": "-0.15",
    "reason": "portfolio_concentration"
  }
}
```

---

# 16. Mandatory V1 Rules

## Rule 1 — Enough points

```text
IF user already has sufficient accessible points
for the trip's reasonable range

THEN
new_card_need decreases
availability_strategy increases
```

---

## Rule 2 — Do not transfer early

```text
IF transferable points can cover target program

THEN
do not recommend transferring immediately
unless user indicates book-now intent
```

---

## Rule 3 — Portfolio concentration

```text
IF >70% portfolio exposure effectively leads to one airline ecosystem

THEN
diversification_need increases
```

---

## Rule 4 — Minimum spend pressure

```text
IF minimum spend > user stated capacity

THEN
apply strong penalty
```

---

## Rule 5 — Existing product

```text
IF user already holds product

THEN
exclude from new-card recommendation
unless recommendation type is "keep/use current card"
```

---

## Rule 6 — Duplicate benefits

If user already gets a benefit from another card, score only the incremental value of the duplicate benefit.

Example:

User already receives:

```text
free checked bag
```

A second card offering the same benefit should receive little or no incremental benefit score.

---

## Rule 7 — Affiliate neutrality

This field:

```text
affiliate_available
```

must NEVER affect ranking.

It only controls whether an affiliate CTA can be shown.

---

## Rule 8 — No-action candidate

Every recommendation run automatically includes:

```text
NO_NEW_CARD
```

as a candidate.

If it wins, output:

> You do not need another card right now.

---

# 17. Ghế 1A Editorial Adjustment

Maximum adjustment:

```text
±10%
```

Editorial adjustment must not override core recommendation fundamentals.

Use cases:

```text
bad practical usability
excellent niche utility
offer looks stronger on paper than in real life
issuer-specific practical concern
```

Every adjustment requires:

```text
reason_code
editor_note
```

Do not allow arbitrary hidden score modification.

---

# 18. Recommendation Output

Example:

```json
{
  "recommendation_id": "...",

  "strategy": {
    "type": "DIVERSIFY_AND_EARN",
    "confidence": 0.88
  },

  "primary_action": {
    "type": "OPEN_CARD",
    "product_id": "...",
    "score": 0.84
  },

  "alternatives": [
    {},
    {}
  ],

  "no_action": {
    "score": 0.58
  },

  "reason_codes": [
    "FLEXIBLE_POINTS_USEFUL",
    "PORTFOLIO_CONCENTRATED",
    "CURRENT_OFFER_STRONG",
    "MIN_SPEND_FITS"
  ],

  "warnings": [],

  "numbers": {
    "estimated_trip_need_low": 150000,
    "estimated_trip_need_high": 220000,
    "accessible_points": 120000
  }
}
```

---

# 19. Explainability

Store each score component.

## `recommendation_scores`

```sql
recommendation_scores
---------------------
recommendation_id uuid
product_id uuid

goal_fit numeric
offer_fit numeric
spend_fit numeric
currency_fit numeric
diversification_fit numeric
benefit_fit numeric
editorial_adjustment numeric

final_score numeric
```

Admin must be able to answer:

```text
Why did this product win?
```

Example:

```text
Trip utility          +0.28
Offer                 +0.16
Spend fit             +0.09
Diversification       +0.08
Benefit               +0.03
Editorial              0

Final                  0.82
```

---

# 20. Recommendation Versioning

## `recommendation_runs`

```sql
recommendation_runs
-------------------
id uuid PRIMARY KEY
user_id uuid nullable

engine_version text
rule_version text
data_snapshot_at timestamptz

input_snapshot jsonb
derived_state jsonb
output_snapshot jsonb

created_at timestamptz
```

This should make it possible to explain why recommendations changed over time.

Potential reasons:

```text
offer changed
rule changed
data changed
user input changed
```

---

# 21. Data Provenance

All important time-sensitive records should include:

```text
source_url
verified_at
effective_from
effective_to
```

Do not overwrite historical terms.

If a benefit changes:

```text
old record → effective_to
new record → effective_from
```

---

# 22. Admin Panel

V1 admin must support:

## Products

Edit:

```text
fee
earning rates
benefits
links
active status
```

## Offers

Support:

```text
create offer
expire offer
edit welcome bonus
edit minimum spend
historical offer tracking
```

## Rules

Support:

```text
enable
disable
priority
threshold edits
```

## Recommendation Debugger

Admin can enter a fake profile.

System displays:

```text
Normalized goal
Portfolio analysis
Derived needs
Generated strategies
Excluded products
Suitability warnings
Candidate products
Score breakdown
Editorial rule effects
Final recommendation
Confidence
```

The Recommendation Debugger is mandatory for V1.

---

# 23. Data Entry Workflow

Do not build full scraping automation in V1.

Admin manually maintains:

```text
Products
Current offers
Important benefits
Transfer paths
Award strategy ranges
```

Bad automated data is more dangerous than manual maintenance.

Automation can be added later as monitoring/assistance.

---

# 24. Data Confidence

Important data should support:

```text
verified
estimated
editorial
stale
```

Examples:

```text
annual fee = verified
award requirement = estimated
Ghế 1A assessment = editorial
```

The user-facing explanation should phrase estimates differently from verified facts.

---

# 25. API

Main endpoint:

```text
POST /api/recommend
```

Input:

```json
{
  "profile": {},
  "portfolio": {},
  "goal": {}
}
```

Output:

```json
{
  "strategy": {},
  "recommendation": {},
  "alternatives": [],
  "reason_codes": [],
  "warnings": [],
  "explanation_context": {}
}
```

---

# 26. Internal Code Structure

Recommended:

```text
/lib/recommendation/

normalize.ts
portfolio.ts
strategies.ts
needs.ts

eligibility.ts
suitability.ts

scoring/
  next-card.ts
  trip.ts
  diversify.ts
  earning.ts

rules.ts
rank.ts
confidence.ts
explain.ts
```

Do not build one huge `recommendation.ts` file.

---

# 27. Reason Codes

Logic should emit codes, not hard-coded user-facing prose.

Examples:

```text
CURRENT_OFFER_STRONG
CURRENT_OFFER_WEAK

MIN_SPEND_GOOD_FIT
MIN_SPEND_TOO_HIGH

POINTS_ALREADY_SUFFICIENT

PORTFOLIO_CONCENTRATED

FLEXIBLE_CURRENCY_VALUABLE

EXISTING_BENEFIT_DUPLICATION

LOW_INCREMENTAL_VALUE

TRIP_PROGRAM_MATCH

NO_NEW_CARD_NEEDED
```

Frontend or LLM converts them into Vietnamese.

---

# 28. LLM Rules

The LLM receives only structured recommendation output.

Example:

```json
{
  "primary_recommendation": "...",
  "reason_codes": [],
  "metrics": {},
  "warnings": [],
  "editorial_style": "Ghế 1A"
}
```

LLM instructions:

```text
Do not change recommendation.

Do not invent eligibility requirements.

Do not invent award availability.

Do not claim approval likelihood.

Do not say points guarantee a trip.

Explain recommendation using only supplied facts.

Clearly distinguish estimates from verified facts.
```

---

# 29. Recommendation Confidence

Backend outputs:

```text
high
medium
low
```

This is not LLM confidence.

Derive it from:

```text
data completeness
data freshness
goal specificity
score gap between top candidates
```

Example:

```text
Top = 0.84
Second = 0.83
```

Confidence should be low.

If:

```text
Top = 0.91
Second = 0.61
```

confidence may be high.

---

# 30. Missing Information Strategy

Do not force users through a 25-question form.

Allow incomplete input.

If missing information could materially change the recommendation, identify the highest-value follow-up question.

Example:

Two cards are almost tied, and grocery spend could decide the winner.

Ask:

> Approximately how much do you spend on groceries each month?

Then recalculate.

This enables an adaptive questionnaire.

---

# 31. Questionnaire V1

Initial questions:

1. What are you trying to do?
2. Which cards do you currently have?
3. Which points do you currently have?
4. Monthly spend range
5. Minimum-spend capacity over 3 months
6. Annual-fee tolerance
7. Business cards allowed: yes/no

If trip goal:

8. Origin
9. Destination
10. Cabin
11. Number of travellers
12. Approximate dates

Do not ask questions that are not needed.

---

# 32. Mandatory Test Suite

## Test A — Beginner

Input:

```text
No cards
No points
$2K monthly spend
low fee tolerance
goal: start Miles & Points
```

Expected:

```text
simple strong starter recommendation
no premium-card bias
```

---

## Test B — Aeroplan-heavy portfolio

Input:

```text
300K Aeroplan
50K MR
two Aeroplan cards
goal: next card
```

Expected:

```text
diversification rewarded
third Aeroplan card strongly penalized
```

---

## Test C — Japan trip, enough points

Input:

```text
200K accessible points
goal: Japan business
```

Expected:

```text
NO_NEW_CARD competitive or winner
focus on availability
```

---

## Test D — Japan trip, major points gap

Input:

```text
20K points
2 travellers
business
```

Expected:

```text
earning strategy
strong relevant welcome bonus
```

---

## Test E — Impossible minimum spend

Input:

```text
user capacity $3K
candidate requires $10K
```

Expected:

```text
candidate should not rank first
```

---

## Test F — Huge affiliate payout

Input:

```text
unsuitable card
affiliate_available = true
```

Expected:

```text
ranking unchanged
```

---

## Test G — Duplicate benefits

Input:

```text
user already has free checked bag
candidate also has free checked bag
```

Expected:

```text
little or no incremental benefit value
```

---

## Test H — Flexible points already sufficient

Expected:

```text
do not prematurely recommend a transfer
```

---

## Test I — Offer changes

Same user profile.

Change Card A offer:

```text
weak → near historical high
```

Expected:

```text
ranking may change for an explainable reason
```

---

## Test J — Missing data

Two cards nearly tied.

Expected:

```text
confidence = low
engine identifies highest-value follow-up question
```

---

# 33. V1 Scope

## Country

```text
Canada only
```

## Products

Start with approximately:

```text
20–30 cards
```

Do not include every Canadian card.

Only products relevant to Ghế 1A.

## Programs

```text
Aeroplan
Amex Membership Rewards
Avion
Avios
Flying Blue
Asia Miles
Marriott Bonvoy
Scene+
```

## Trip regions

```text
Canada / US
Europe
Japan
Vietnam / Southeast Asia
East Asia
```

## Cabins

```text
economy
premium economy
business
first
```

---

# 34. Explicitly Out of Scope for V1

Do not build:

- Real-time award availability
- Full worldwide award chart
- Credit approval predictor
- Credit score recommendation engine
- Churning eligibility engine
- Canada + US cards simultaneously
- AI deciding recommendations
- Scraping every issuer
- Real-time transfer bonus automation
- Complex household points pooling
- Multi-player card strategy
- 24-month optimized application roadmap
- Card cancellation recommendations

These belong in V2/V3.

---

# 35. Build Milestones

Claude Code should implement the system in this order.

Do not skip ahead.

## Phase 1 — Data Foundation

Build:

```text
products
issuers
points_programs
offers
offer_components
earning_rates
benefits
product_benefits
transfer_paths
eligibility_rules
award_strategies
```

Also build admin CRUD for these entities.

### Acceptance criteria

- Database migrations are clean and reversible.
- Seed data can be loaded without manual SQL edits.
- Historical records can use effective_from/effective_to.
- Product and offer are separate.
- Benefits are structured.
- Transfer paths are queryable.

---

## Phase 2 — User Model

Build:

```text
user_profiles
user_spend_profiles
user_cards
user_point_balances
goals
```

### Acceptance criteria

- User profile supports missing optional data.
- Current cards and historical ownership are distinguishable.
- Points balances do not require account numbers.
- Trip goals can be represented by region rather than exact airport.

---

## Phase 3 — Recommendation Engine

Implement:

```text
Goal Normalizer
Portfolio Analyzer
Strategy Generator
Needs Engine
Eligibility Filter
Suitability Layer
Intent-specific Scoring
Editorial Rules
Ranking
No-action candidate
Confidence calculation
```

### Acceptance criteria

- Same input + same version = same output.
- LLM is not involved.
- Affiliate status does not affect ranking.
- NO_NEW_CARD can win.
- Transferable points are never double counted.
- Different intents use different scoring functions.

---

## Phase 4 — Debugging and Tests

Build:

```text
Recommendation Debugger
score breakdown
rule effects
excluded product list
recommendation_runs
test fixtures
automated test suite
```

### Acceptance criteria

- Admin can explain why a product won.
- Admin can see why another product lost.
- Test A–J all exist and pass.
- Engine version is recorded.
- Rule version is recorded.
- Input and derived state snapshots are stored.

---

## Phase 5 — Frontend UX

Build:

```text
adaptive questionnaire
result page
alternatives
warnings
confidence
affiliate CTA
```

### Acceptance criteria

- Questionnaire does not require all possible fields.
- Missing critical information can trigger a follow-up question.
- Result can show NO_NEW_CARD.
- Affiliate CTA appears only when applicable.
- Affiliate availability never changes the recommendation.

---

## Phase 6 — LLM Explanation

Only after deterministic recommendation logic is complete.

Build natural-language explanation from structured output.

### Acceptance criteria

- LLM cannot change selected product.
- LLM receives only structured data.
- No invented eligibility criteria.
- No invented award availability.
- Estimates are clearly described as estimates.

---

# 36. Claude Code Implementation Guardrails

These rules are mandatory.

1. Do not simplify the architecture into `questionnaire → GPT → recommendation`.
2. Do not create a universal card score.
3. Do not hard-code every rule inside UI components.
4. Do not mix affiliate commission into ranking.
5. Do not double-count transferable points.
6. Do not model award prices as one exact number when pricing is variable.
7. Do not treat credit score as a hard eligibility requirement.
8. Do not assume that a recommendation must contain a credit card.
9. Do not skip Recommendation Debugger.
10. Do not add V2/V3 features unless explicitly requested.
11. Keep business logic out of React components.
12. Keep recommendation functions pure where practical.
13. Every score-changing editorial rule must be explainable.
14. Every recommendation should return reason codes.
15. Prefer simple deterministic logic over clever AI behavior.

---

# 37. Definition of Done

V1 is not done merely because it can recommend a card.

V1 is done when:

1. Same input + same data + same engine version produces the same result.
2. Every recommendation can explain exactly why it won.
3. Affiliate status cannot affect ranking.
4. Engine can recommend no new card.
5. Changing one important input produces a predictable and explainable change.
6. Recommendation logic works without an LLM.
7. Admin can debug bad recommendations.
8. Tests cover the major Miles & Points edge cases.

---

# 38. Initial Claude Code Task

Start with **Phase 1 only**.

Before writing application code:

1. Inspect the existing repository and stack.
2. Identify existing Supabase/Postgres conventions.
3. Propose the exact migration plan.
4. Map this spec onto the existing project structure.
5. Preserve existing conventions unless there is a strong technical reason not to.
6. Do not begin Phase 2 or later phases.
7. Implement Phase 1.
8. Add seed-data support.
9. Add validation where appropriate.
10. Run the project's existing checks/tests.
11. Summarize:
   - files changed
   - migrations added
   - schema decisions
   - assumptions
   - anything intentionally deferred

If any detail in this document conflicts with the existing codebase architecture, prefer the least invasive implementation that preserves the product principles above.

The architecture principles and guardrails are more important than literal table/filename naming.
