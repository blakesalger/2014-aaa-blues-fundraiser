# Road to Quebec! — St. Louis AAA Blues 2014 Fundraiser Site

Plain HTML/CSS/JS static site. No build step required.

## Pages
- `index.html` — Home
- `about.html` — About the Tournament
- `sponsorship.html` — Sponsorship Opportunities
- `holiday-tournament.html` — Holiday Tournament entry form
- `alumni-auction.html` — Alumni Auction
- `success.html` — Shown after a Holiday Tournament form submission

## Local preview
Open `index.html` directly in a browser, or serve the folder with any static server.

## Deploying (free — Netlify)
The Holiday Tournament entry form uses **Netlify Forms**, so this site should be deployed to Netlify (not GitHub Pages) for the form to work and email submissions to you.

1. Create a free account at https://app.netlify.com
2. Drag-and-drop this entire project folder onto the Netlify dashboard ("Deploy manually"), **or** push this folder to a GitHub repo and connect it in Netlify for auto-deploys on every push.
3. Once deployed, go to **Site settings → Forms → Form notifications** and add an email notification pointing to blakesalger@gmail.com. Netlify auto-detects the form because of the `data-netlify="true"` attribute in `holiday-tournament.html` — no extra code needed.
4. (Optional) Add a custom domain under **Site settings → Domain management**.

## Known placeholders to update before launch
- **Logos**: replace `images/logo-placeholder.svg` references with the real team/tournament logos once added to `images/`.
- **Venmo payment link** (`holiday-tournament.html`): the "Pay via Venmo" button is currently disabled/placeholder.
- **Auction tickets & bidding app links** (`alumni-auction.html`): both buttons are currently disabled/placeholder.
- **Holiday Tournament event details**: dates/location/schedule are marked "coming soon" — add real details once set.
