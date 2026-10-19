# Decisions

## 19 October 2026 — approved ad schedule; documentation only

User approved rewarded videos on retries **3, 6, 9...** and interstitials once every **5 completed races**, then instructed that this be documented in the repo. Pre-roll stays locked and unchanged. Interstitials occur on ordinary Next after the result; the 120-second minimum is removed. Same-course Retry/Restart/Replay share a retry counter, reset on advancing; no rewarded/interstitial stacking on one transition.

The full current specification and recovery rules are in section 7 of PRODUCT-CONTRACT.txt, configuration `vehicle-shift-ad-5-races-3-retries-v1`. This supersedes the earlier D/B pacing and retry/reward-placement proposals. Runtime code, live ads, tests and release ZIP are unchanged; implementing and verifying the new schedule remains pending. ADS531-536 are NOT RUN.

## 18 October 2026 — historical engine/QA scope

18 October 2026. User authorized implementing level generation, all feasible end-to-end tests and reporting the product-usable count. All eight vehicles and one-finger controls are in scope. Graphics remain unspecified. The diagnostic surface is a test fixture, not the final presentation. Monetization D is tested with fixtures only; no live SDK, advertisement or publication is authorized or claimed.

Prebuilt content is counted after mathematical/simulation/pacing/diversity acceptance. Human enjoyment is not established by synthetic players. The earlier 5,580 count is a restricted sequence enumeration, not a certified level count. Keep rejection evidence. Do not relax quality gates just to meet a number.
