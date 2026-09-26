@AGENTS.md

# Read before starting any work

Every session must read these two documents first and follow them:

- `docs/product-brief.md`: what the product is and must become.
- `docs/decisions.md`: decisions the owner has already made. These win over
  the brief, over defaults, and over your own preferences. Don't reopen a
  decision unless the owner asks, or unless you explain a concrete problem
  with it and wait for their answer.

@docs/product-brief.md
@docs/decisions.md

# Recording decisions

Whenever the owner makes a new decision, or changes an old one, add it to
`docs/decisions.md` in the same pull request as the work it affects. Add
new entries at the end, one bullet each, dated, in plain language:

    - **Topic (YYYY-MM-DD):** what was decided (and why, if the owner said).

If a decision replaces an earlier one, edit the earlier bullet to say
"replaced on YYYY-MM-DD, see below" instead of deleting it.

# Working with the owner

The owner is not a software engineer and doesn't use a terminal. Explain in
plain language, give click-by-click steps for anything they must do
themselves (Vercel, GitHub, Neon, Resend…), and wait for their confirmation
before major architectural changes.
