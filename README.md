# Free TV

Free live TV from around the world.  
No account · No sign-up · No tracking · No ads.

The app loads public channel lists from [iptv-org](https://github.com/iptv-org/iptv) directly in your browser and plays the streams. It hosts nothing itself.

## Deploy on GitHub Pages (recommended)

1. Create a new repository on GitHub.
2. Upload **every file** in this folder (keep the `icons` folder and the `.nojekyll` file).
3. Go to **Settings → Pages**.
4. Under **Source** choose **Deploy from a branch**, select `main` (or `master`) and `/ (root)`, then Save.
5. Wait a minute, then open:  
   `https://<your-username>.github.io/<repo-name>/`

### Add to home screen (iPhone / Android)
- **iPhone**: open the site in Safari → Share → **Add to Home Screen**.
- **Android**: open in Chrome → menu → **Install app** / Add to Home screen.

## Why some channels don’t play on GitHub Pages

GitHub Pages is always HTTPS. Browsers therefore block plain `http://` streams (mixed content).  
The app automatically hides those streams so you only see HTTPS ones.

Even among HTTPS streams, many public servers do not send the CORS headers required by Chrome, Firefox and Edge.  
Safari / iOS is more permissive and usually works better.

If a channel fails:
- Try another one (thousands are available).
- Prefer Safari on iPhone / Mac for the highest success rate.
- Streams also go offline or become geo-blocked without notice – that is normal for public lists.

## Customize the channel sources

Edit `sources.json`. Any public `.m3u` / `.m3u8` playlist URL works.  
Duplicates are removed automatically. Only HTTPS streams appear when the page itself is HTTPS.

Example:
```json
{
  "sources": [
    { "name": "Worldwide by country", "url": "https://iptv-org.github.io/iptv/index.country.m3u" },
    { "name": "By category", "url": "https://iptv-org.github.io/iptv/index.category.m3u" }
  ]
}
```

## Features

- Thousands of free channels from every region
- Search + country / category filter
- Favorites (saved in your browser)
- Recently watched
- Works offline for the app shell (service worker)
- Installable as a Progressive Web App
- Dark, modern interface

## Legal note

This project only links to streams that other people already publish publicly.  
It does not host, proxy or rebroadcast any video.  
Respect the terms of the original broadcasters and the laws of your country.
