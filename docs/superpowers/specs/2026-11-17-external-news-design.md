# External news fallback

The user delegated completion of missing work and requested an external news
source so the deployed news app works. Keep the existing NewsAPI interface and
add Google News RSS as a server-side fallback when NewsAPI fails, is unconfigured,
or has no articles. This is the implementation choice made under that delegation.

Alternatives: requiring another paid/keyed news API would introduce another
credential and quota; static sample APIs would not provide current news. Live
Google News feeds already returned current Egyptian headlines during verification.

Preserve country, category, search, language, date, and finite pagination behavior.
Never send the NewsAPI key to the feed service. Bound requests and feed sizes,
validate external URLs, deduplicate entries, and return errors if both sources fail.
Feeds provide publisher attribution and links; thumbnails and full article text
are optional. Keep image-free articles in Flutter and use its existing placeholder.

Scope is the deployed web API. Native builds keep their existing NewsAPI access.
