/* ============================================================
   sites.js — popular sites database for the Umbra start page
   pop: 1–100 popularity score (rough global traffic rank). It sets the
   bubble's size and how close to the middle it sits. cat groups related
   sites: the layout leans each category toward its own direction, and
   sites link to their nearest more popular neighbour in the category.
   Categories are listed so related ones sit next to each other.
   ============================================================ */

"use strict";

// Ring order: each genre's neighbours are its closest relatives, so the
// nebula layout puts similar clouds side by side. "other" is the outer halo.
const SITE_CATEGORIES = [
  { id: "search",   hue: 214 },
  { id: "reference", hue: 205 },
  { id: "learn",    hue: 100 },
  { id: "dev",      hue: 262 },
  { id: "ai",       hue: 170 },
  { id: "work",     hue: 48 },
  { id: "finance",  hue: 155 },
  { id: "shopping", hue: 40 },
  { id: "food",     hue: 18 },
  { id: "travel",   hue: 185 },
  { id: "sports",   hue: 28 },
  { id: "gambling", hue: 80 },
  { id: "gaming",   hue: 270 },
  { id: "adult",    hue: 305 },
  { id: "dating",   hue: 355 },
  { id: "video",    hue: 0 },
  { id: "piracy",   hue: 20 },
  { id: "music",    hue: 140 },
  { id: "social",   hue: 320 },
  { id: "chat",     hue: 236 },
  { id: "news",     hue: 345 },
  { id: "other",    hue: 230 },
];

const SITES = [
  // search
  { id: "go",    name: "Google",          domain: "google.com",              cat: "search",    pop: 100 },
  { id: "bing",  name: "Bing",            domain: "bing.com",                cat: "search",    pop: 70 },
  { id: "yho",   name: "Yahoo",           domain: "yahoo.com",               cat: "search",    pop: 66 },
  { id: "bdu",   name: "Baidu",           domain: "baidu.com",               cat: "search",    pop: 70 },
  { id: "ydx",   name: "Yandex",          domain: "yandex.ru",               cat: "search",    pop: 60 },
  { id: "ddg",   name: "DuckDuckGo",      domain: "duckduckgo.com",          cat: "search",    pop: 58 },
  { id: "eco",   name: "Ecosia",          domain: "ecosia.org",              cat: "search",    pop: 30 },
  { id: "brs",   name: "Brave Search",    domain: "search.brave.com",        cat: "search",    pop: 28 },
  { id: "gmap",  name: "Google Maps",     domain: "maps.google.com",         cat: "search",    pop: 68 },
  { id: "gtr",   name: "Google Translate", domain: "translate.google.com",   cat: "search",    pop: 60 },

  // reference
  { id: "wiki",  name: "Wikipedia",       domain: "wikipedia.org",           cat: "reference", pop: 93 },
  { id: "imdb",  name: "IMDb",            domain: "imdb.com",                cat: "reference", pop: 70 },
  { id: "fdm",   name: "Fandom",          domain: "fandom.com",              cat: "reference", pop: 62 },
  { id: "wthr",  name: "Weather.com",     domain: "weather.com",             cat: "reference", pop: 58 },
  { id: "acc",   name: "AccuWeather",     domain: "accuweather.com",         cat: "reference", pop: 48 },
  { id: "arc",   name: "Internet Archive", domain: "archive.org",            cat: "reference", pop: 52 },
  { id: "mw",    name: "Merriam-Webster", domain: "merriam-webster.com",     cat: "reference", pop: 46 },
  { id: "dict",  name: "Dictionary.com",  domain: "dictionary.com",          cat: "reference", pop: 40 },
  { id: "brit",  name: "Britannica",      domain: "britannica.com",          cat: "reference", pop: 40 },
  { id: "wikt",  name: "Wiktionary",      domain: "wiktionary.org",          cat: "reference", pop: 34 },
  { id: "wa",    name: "Wolfram Alpha",   domain: "wolframalpha.com",        cat: "reference", pop: 38 },
  { id: "osm",   name: "OpenStreetMap",   domain: "openstreetmap.org",       cat: "reference", pop: 34 },
  { id: "zil",   name: "Zillow",          domain: "zillow.com",              cat: "reference", pop: 50 },

  // news
  { id: "bbc",   name: "BBC",             domain: "bbc.com",                 cat: "news",      pop: 78 },
  { id: "cnn",   name: "CNN",             domain: "cnn.com",                 cat: "news",      pop: 74 },
  { id: "nyt",   name: "New York Times",  domain: "nytimes.com",             cat: "news",      pop: 74 },
  { id: "grd",   name: "The Guardian",    domain: "theguardian.com",         cat: "news",      pop: 68 },
  { id: "fox",   name: "Fox News",        domain: "foxnews.com",             cat: "news",      pop: 62 },
  { id: "rtr",   name: "Reuters",         domain: "reuters.com",             cat: "news",      pop: 62 },
  { id: "med",   name: "Medium",          domain: "medium.com",              cat: "news",      pop: 62 },
  { id: "gnews", name: "Google News",     domain: "news.google.com",         cat: "news",      pop: 60 },
  { id: "wapo",  name: "Washington Post", domain: "washingtonpost.com",      cat: "news",      pop: 60 },
  { id: "frb",   name: "Forbes",          domain: "forbes.com",              cat: "news",      pop: 60 },
  { id: "apn",   name: "AP News",         domain: "apnews.com",              cat: "news",      pop: 58 },
  { id: "bbg",   name: "Bloomberg",       domain: "bloomberg.com",           cat: "news",      pop: 58 },
  { id: "hn",    name: "Hacker News",     domain: "news.ycombinator.com",    cat: "news",      pop: 56 },
  { id: "wsj",   name: "Wall Street Journal", domain: "wsj.com",             cat: "news",      pop: 56 },
  { id: "vg",    name: "The Verge",       domain: "theverge.com",            cat: "news",      pop: 52 },
  { id: "alj",   name: "Al Jazeera",      domain: "aljazeera.com",           cat: "news",      pop: 50 },
  { id: "npr",   name: "NPR",             domain: "npr.org",                 cat: "news",      pop: 50 },
  { id: "sub",   name: "Substack",        domain: "substack.com",            cat: "news",      pop: 48 },
  { id: "wrd",   name: "Wired",           domain: "wired.com",               cat: "news",      pop: 46 },
  { id: "tc",    name: "TechCrunch",      domain: "techcrunch.com",          cat: "news",      pop: 44 },
  { id: "bzf",   name: "BuzzFeed",        domain: "buzzfeed.com",            cat: "news",      pop: 44 },
  { id: "ars",   name: "Ars Technica",    domain: "arstechnica.com",         cat: "news",      pop: 42 },
  { id: "atl",   name: "The Atlantic",    domain: "theatlantic.com",         cat: "news",      pop: 40 },
  { id: "vox",   name: "Vox",             domain: "vox.com",                 cat: "news",      pop: 40 },
  { id: "pol",   name: "Politico",        domain: "politico.com",            cat: "news",      pop: 40 },

  // social
  { id: "fb",    name: "Facebook",        domain: "facebook.com",            cat: "social",    pop: 95 },
  { id: "ig",    name: "Instagram",       domain: "instagram.com",           cat: "social",    pop: 92 },
  { id: "rd",    name: "Reddit",          domain: "reddit.com",              cat: "social",    pop: 86 },
  { id: "x",     name: "X",               domain: "x.com",                   cat: "social",    pop: 85 },
  { id: "li",    name: "LinkedIn",        domain: "linkedin.com",            cat: "social",    pop: 80 },
  { id: "pin",   name: "Pinterest",       domain: "pinterest.com",           cat: "social",    pop: 70 },
  { id: "quo",   name: "Quora",           domain: "quora.com",               cat: "social",    pop: 58 },
  { id: "snap",  name: "Snapchat",        domain: "snapchat.com",            cat: "social",    pop: 55 },
  { id: "vk",    name: "VK",              domain: "vk.com",                  cat: "social",    pop: 55 },
  { id: "thr",   name: "Threads",         domain: "threads.com",             cat: "social",    pop: 50 },
  { id: "wbo",   name: "Weibo",           domain: "weibo.com",               cat: "social",    pop: 50 },
  { id: "tmb",   name: "Tumblr",          domain: "tumblr.com",              cat: "social",    pop: 45 },
  { id: "bsky",  name: "Bluesky",         domain: "bsky.app",                cat: "social",    pop: 42 },
  { id: "mst",   name: "Mastodon",        domain: "mastodon.social",         cat: "social",    pop: 30 },

  // chat & calls
  { id: "wapp",  name: "WhatsApp",        domain: "whatsapp.com",            cat: "chat",      pop: 82 },
  { id: "dc",    name: "Discord",         domain: "discord.com",             cat: "chat",      pop: 74 },
  { id: "tg",    name: "Telegram",        domain: "telegram.org",            cat: "chat",      pop: 64 },
  { id: "zoom",  name: "Zoom",            domain: "zoom.us",                 cat: "chat",      pop: 62 },
  { id: "slk",   name: "Slack",           domain: "slack.com",               cat: "chat",      pop: 60 },
  { id: "tms",   name: "Microsoft Teams", domain: "teams.microsoft.com",     cat: "chat",      pop: 58 },
  { id: "msgr",  name: "Messenger",       domain: "messenger.com",           cat: "chat",      pop: 55 },
  { id: "sig",   name: "Signal",          domain: "signal.org",              cat: "chat",      pop: 40 },

  // video
  { id: "yt",    name: "YouTube",         domain: "youtube.com",             cat: "video",     pop: 99 },
  { id: "tt",    name: "TikTok",          domain: "tiktok.com",              cat: "video",     pop: 84 },
  { id: "nf",    name: "Netflix",         domain: "netflix.com",             cat: "video",     pop: 80 },
  { id: "tw",    name: "Twitch",          domain: "twitch.tv",               cat: "video",     pop: 72 },
  { id: "dsn",   name: "Disney+",         domain: "disneyplus.com",          cat: "video",     pop: 60 },
  { id: "pv",    name: "Prime Video",     domain: "primevideo.com",          cat: "video",     pop: 58 },
  { id: "bili",  name: "Bilibili",        domain: "bilibili.com",            cat: "video",     pop: 55 },
  { id: "vim",   name: "Vimeo",           domain: "vimeo.com",               cat: "video",     pop: 50 },
  { id: "hulu",  name: "Hulu",            domain: "hulu.com",                cat: "video",     pop: 50 },
  { id: "max",   name: "Max",             domain: "max.com",                 cat: "video",     pop: 48 },
  { id: "cr",    name: "Crunchyroll",     domain: "crunchyroll.com",         cat: "video",     pop: 48 },
  { id: "dm",    name: "Dailymotion",     domain: "dailymotion.com",         cat: "video",     pop: 40 },
  { id: "kick",  name: "Kick",            domain: "kick.com",                cat: "video",     pop: 35 },
  { id: "rmb",   name: "Rumble",          domain: "rumble.com",              cat: "video",     pop: 35 },
  { id: "plex",  name: "Plex",            domain: "plex.tv",                 cat: "video",     pop: 30 },

  // music
  { id: "sp",    name: "Spotify",         domain: "spotify.com",             cat: "music",     pop: 78 },
  { id: "ytm",   name: "YouTube Music",   domain: "music.youtube.com",       cat: "music",     pop: 55 },
  { id: "snd",   name: "SoundCloud",      domain: "soundcloud.com",          cat: "music",     pop: 52 },
  { id: "am",    name: "Apple Music",     domain: "music.apple.com",         cat: "music",     pop: 50 },
  { id: "gen",   name: "Genius",          domain: "genius.com",              cat: "music",     pop: 46 },
  { id: "dzr",   name: "Deezer",          domain: "deezer.com",              cat: "music",     pop: 38 },
  { id: "bc",    name: "Bandcamp",        domain: "bandcamp.com",            cat: "music",     pop: 36 },
  { id: "pnd",   name: "Pandora",         domain: "pandora.com",             cat: "music",     pop: 35 },
  { id: "lfm",   name: "Last.fm",         domain: "last.fm",                 cat: "music",     pop: 30 },
  { id: "tdl",   name: "Tidal",           domain: "tidal.com",               cat: "music",     pop: 30 },

  // gaming
  { id: "rbx",   name: "Roblox",          domain: "roblox.com",              cat: "gaming",    pop: 70 },
  { id: "stm",   name: "Steam",           domain: "steampowered.com",        cat: "gaming",    pop: 66 },
  { id: "chs",   name: "Chess.com",       domain: "chess.com",               cat: "gaming",    pop: 62 },
  { id: "ps",    name: "PlayStation",     domain: "playstation.com",         cat: "gaming",    pop: 52 },
  { id: "epic",  name: "Epic Games",      domain: "epicgames.com",           cat: "gaming",    pop: 50 },
  { id: "xbox",  name: "Xbox",            domain: "xbox.com",                cat: "gaming",    pop: 50 },
  { id: "mc",    name: "Minecraft",       domain: "minecraft.net",           cat: "gaming",    pop: 50 },
  { id: "nin",   name: "Nintendo",        domain: "nintendo.com",            cat: "gaming",    pop: 48 },
  { id: "ign",   name: "IGN",             domain: "ign.com",                 cat: "gaming",    pop: 46 },
  { id: "poki",  name: "Poki",            domain: "poki.com",                cat: "gaming",    pop: 46 },
  { id: "lch",   name: "Lichess",         domain: "lichess.org",             cat: "gaming",    pop: 40 },
  { id: "nxs",   name: "Nexus Mods",      domain: "nexusmods.com",           cat: "gaming",    pop: 40 },
  { id: "itch",  name: "itch.io",         domain: "itch.io",                 cat: "gaming",    pop: 36 },
  { id: "gsp",   name: "GameSpot",        domain: "gamespot.com",            cat: "gaming",    pop: 36 },
  { id: "cf",    name: "CurseForge",      domain: "curseforge.com",          cat: "gaming",    pop: 36 },

  // shopping
  { id: "amz",   name: "Amazon",          domain: "amazon.com",              cat: "shopping",  pop: 92 },
  { id: "ebay",  name: "eBay",            domain: "ebay.com",                cat: "shopping",  pop: 72 },
  { id: "wmt",   name: "Walmart",         domain: "walmart.com",             cat: "shopping",  pop: 66 },
  { id: "ali",   name: "AliExpress",      domain: "aliexpress.com",          cat: "shopping",  pop: 64 },
  { id: "temu",  name: "Temu",            domain: "temu.com",                cat: "shopping",  pop: 62 },
  { id: "etsy",  name: "Etsy",            domain: "etsy.com",                cat: "shopping",  pop: 60 },
  { id: "shn",   name: "Shein",           domain: "shein.com",               cat: "shopping",  pop: 56 },
  { id: "tgt",   name: "Target",          domain: "target.com",              cat: "shopping",  pop: 52 },
  { id: "bby",   name: "Best Buy",        domain: "bestbuy.com",             cat: "shopping",  pop: 50 },
  { id: "ikea",  name: "IKEA",            domain: "ikea.com",                cat: "shopping",  pop: 48 },
  { id: "hd",    name: "Home Depot",      domain: "homedepot.com",           cat: "shopping",  pop: 48 },
  { id: "cost",  name: "Costco",          domain: "costco.com",              cat: "shopping",  pop: 46 },
  { id: "shop",  name: "Shopify",         domain: "shopify.com",             cat: "shopping",  pop: 46 },
  { id: "cl",    name: "Craigslist",      domain: "craigslist.org",          cat: "shopping",  pop: 46 },
  { id: "wf",    name: "Wayfair",         domain: "wayfair.com",             cat: "shopping",  pop: 38 },
  { id: "neg",   name: "Newegg",          domain: "newegg.com",              cat: "shopping",  pop: 32 },

  // food delivery & recipes
  { id: "dd",    name: "DoorDash",        domain: "doordash.com",            cat: "food",      pop: 50 },
  { id: "ue",    name: "Uber Eats",       domain: "ubereats.com",            cat: "food",      pop: 48 },
  { id: "alr",   name: "Allrecipes",      domain: "allrecipes.com",          cat: "food",      pop: 44 },
  { id: "inc",   name: "Instacart",       domain: "instacart.com",           cat: "food",      pop: 40 },
  { id: "gh2",   name: "Grubhub",         domain: "grubhub.com",             cat: "food",      pop: 34 },

  // travel
  { id: "bkg",   name: "Booking.com",     domain: "booking.com",             cat: "travel",    pop: 64 },
  { id: "abb",   name: "Airbnb",          domain: "airbnb.com",              cat: "travel",    pop: 62 },
  { id: "uber",  name: "Uber",            domain: "uber.com",                cat: "travel",    pop: 54 },
  { id: "ta",    name: "Tripadvisor",     domain: "tripadvisor.com",         cat: "travel",    pop: 52 },
  { id: "exp",   name: "Expedia",         domain: "expedia.com",             cat: "travel",    pop: 50 },
  { id: "gfl",   name: "Google Flights",  domain: "google.com",  path: "/travel/flights", cat: "travel", pop: 40 },
  { id: "sky",   name: "Skyscanner",      domain: "skyscanner.net",          cat: "travel",    pop: 40 },
  { id: "kyk",   name: "Kayak",           domain: "kayak.com",               cat: "travel",    pop: 36 },
  { id: "htl",   name: "Hotels.com",      domain: "hotels.com",              cat: "travel",    pop: 34 },
  { id: "lyft",  name: "Lyft",            domain: "lyft.com",                cat: "travel",    pop: 30 },

  // finance
  { id: "pp",    name: "PayPal",          domain: "paypal.com",              cat: "finance",   pop: 70 },
  { id: "chs2",  name: "Chase",           domain: "chase.com",               cat: "finance",   pop: 58 },
  { id: "yfin",  name: "Yahoo Finance",   domain: "finance.yahoo.com",       cat: "finance",   pop: 56 },
  { id: "bofa",  name: "Bank of America", domain: "bankofamerica.com",       cat: "finance",   pop: 54 },
  { id: "bnc",   name: "Binance",         domain: "binance.com",             cat: "finance",   pop: 54 },
  { id: "tv",    name: "TradingView",     domain: "tradingview.com",         cat: "finance",   pop: 52 },
  { id: "wfg",   name: "Wells Fargo",     domain: "wellsfargo.com",          cat: "finance",   pop: 50 },
  { id: "cb",    name: "Coinbase",        domain: "coinbase.com",            cat: "finance",   pop: 50 },
  { id: "c1",    name: "Capital One",     domain: "capitalone.com",          cat: "finance",   pop: 48 },
  { id: "amex",  name: "American Express", domain: "americanexpress.com",    cat: "finance",   pop: 46 },
  { id: "inv",   name: "Investing.com",   domain: "investing.com",           cat: "finance",   pop: 44 },
  { id: "fid",   name: "Fidelity",        domain: "fidelity.com",            cat: "finance",   pop: 42 },
  { id: "rh",    name: "Robinhood",       domain: "robinhood.com",           cat: "finance",   pop: 40 },
  { id: "rev",   name: "Revolut",         domain: "revolut.com",             cat: "finance",   pop: 40 },
  { id: "strp",  name: "Stripe",          domain: "stripe.com",              cat: "finance",   pop: 40 },
  { id: "vng",   name: "Vanguard",        domain: "vanguard.com",            cat: "finance",   pop: 38 },
  { id: "vnm",   name: "Venmo",           domain: "venmo.com",               cat: "finance",   pop: 36 },

  // work & productivity
  { id: "gml",   name: "Gmail",           domain: "mail.google.com",         cat: "work",      pop: 88 },
  { id: "olk",   name: "Outlook",         domain: "outlook.live.com",        cat: "work",      pop: 74 },
  { id: "gdr",   name: "Google Drive",    domain: "drive.google.com",        cat: "work",      pop: 70 },
  { id: "gdoc",  name: "Google Docs",     domain: "docs.google.com",         cat: "work",      pop: 68 },
  { id: "m365",  name: "Microsoft 365",   domain: "office.com",              cat: "work",      pop: 66 },
  { id: "cnv",   name: "Canva",           domain: "canva.com",               cat: "work",      pop: 64 },
  { id: "nt",    name: "Notion",          domain: "notion.so",               cat: "work",      pop: 58 },
  { id: "dbx",   name: "Dropbox",         domain: "dropbox.com",             cat: "work",      pop: 52 },
  { id: "fg",    name: "Figma",           domain: "figma.com",               cat: "work",      pop: 52 },
  { id: "atl2",  name: "Atlassian",       domain: "atlassian.com",           cat: "work",      pop: 52 },
  { id: "gcal",  name: "Google Calendar", domain: "calendar.google.com",     cat: "work",      pop: 50 },
  { id: "icl",   name: "iCloud",          domain: "icloud.com",              cat: "work",      pop: 50 },
  { id: "trl",   name: "Trello",          domain: "trello.com",              cat: "work",      pop: 44 },
  { id: "prt",   name: "Proton",          domain: "proton.me",               cat: "work",      pop: 40 },
  { id: "asn",   name: "Asana",           domain: "asana.com",               cat: "work",      pop: 38 },
  { id: "miro",  name: "Miro",            domain: "miro.com",                cat: "work",      pop: 38 },
  { id: "evn",   name: "Evernote",        domain: "evernote.com",            cat: "work",      pop: 32 },

  // AI assistants
  { id: "cgpt",  name: "ChatGPT",         domain: "chatgpt.com",             cat: "ai",        pop: 90 },
  { id: "gem",   name: "Gemini",          domain: "gemini.google.com",       cat: "ai",        pop: 62 },
  { id: "oa",    name: "OpenAI",          domain: "openai.com",              cat: "ai",        pop: 60 },
  { id: "cld",   name: "Claude",          domain: "claude.ai",               cat: "ai",        pop: 58 },
  { id: "ppx",   name: "Perplexity",      domain: "perplexity.ai",           cat: "ai",        pop: 50 },
  { id: "cop",   name: "Copilot",         domain: "copilot.microsoft.com",   cat: "ai",        pop: 48 },
  { id: "hf",    name: "Hugging Face",    domain: "huggingface.co",          cat: "ai",        pop: 48 },

  // dev
  { id: "gh",    name: "GitHub",          domain: "github.com",              cat: "dev",       pop: 82 },
  { id: "so",    name: "Stack Overflow",  domain: "stackoverflow.com",       cat: "dev",       pop: 66 },
  { id: "aws",   name: "AWS",             domain: "aws.amazon.com",          cat: "dev",       pop: 60 },
  { id: "mdn",   name: "MDN Web Docs",    domain: "developer.mozilla.org",   cat: "dev",       pop: 58 },
  { id: "w3s",   name: "W3Schools",       domain: "w3schools.com",           cat: "dev",       pop: 58 },
  { id: "cfl",   name: "Cloudflare",      domain: "cloudflare.com",          cat: "dev",       pop: 56 },
  { id: "gfg",   name: "GeeksforGeeks",   domain: "geeksforgeeks.org",       cat: "dev",       pop: 56 },
  { id: "azr",   name: "Azure",           domain: "azure.microsoft.com",     cat: "dev",       pop: 50 },
  { id: "npm",   name: "npm",             domain: "npmjs.com",               cat: "dev",       pop: 48 },
  { id: "gl",    name: "GitLab",          domain: "gitlab.com",              cat: "dev",       pop: 46 },
  { id: "gcp",   name: "Google Cloud",    domain: "cloud.google.com",        cat: "dev",       pop: 46 },
  { id: "lc",    name: "LeetCode",        domain: "leetcode.com",            cat: "dev",       pop: 44 },
  { id: "py",    name: "Python",          domain: "python.org",              cat: "dev",       pop: 42 },
  { id: "pypi",  name: "PyPI",            domain: "pypi.org",                cat: "dev",       pop: 40 },
  { id: "vrc",   name: "Vercel",          domain: "vercel.com",              cat: "dev",       pop: 40 },
  { id: "kag",   name: "Kaggle",          domain: "kaggle.com",              cat: "dev",       pop: 40 },
  { id: "fcc",   name: "freeCodeCamp",    domain: "freecodecamp.org",        cat: "dev",       pop: 40 },
  { id: "dkr",   name: "Docker Hub",      domain: "hub.docker.com",          cat: "dev",       pop: 38 },
  { id: "cpn",   name: "CodePen",         domain: "codepen.io",              cat: "dev",       pop: 38 },
  { id: "dto",   name: "DEV",             domain: "dev.to",                  cat: "dev",       pop: 38 },
  { id: "do",    name: "DigitalOcean",    domain: "digitalocean.com",        cat: "dev",       pop: 36 },
  { id: "rpl",   name: "Replit",          domain: "replit.com",              cat: "dev",       pop: 36 },
  { id: "ntl",   name: "Netlify",         domain: "netlify.com",             cat: "dev",       pop: 34 },
  { id: "hrk",   name: "Heroku",          domain: "heroku.com",              cat: "dev",       pop: 32 },
  { id: "rust",  name: "Rust",            domain: "rust-lang.org",           cat: "dev",       pop: 30 },

  // learning
  { id: "duo",   name: "Duolingo",        domain: "duolingo.com",            cat: "learn",     pop: 54 },
  { id: "cnvs",  name: "Canvas",          domain: "instructure.com",         cat: "learn",     pop: 54 },
  { id: "qzl",   name: "Quizlet",         domain: "quizlet.com",             cat: "learn",     pop: 52 },
  { id: "gcls",  name: "Google Classroom", domain: "classroom.google.com",   cat: "learn",     pop: 52 },
  { id: "udm",   name: "Udemy",           domain: "udemy.com",               cat: "learn",     pop: 50 },
  { id: "crs",   name: "Coursera",        domain: "coursera.org",            cat: "learn",     pop: 48 },
  { id: "khn",   name: "Khan Academy",    domain: "khanacademy.org",         cat: "learn",     pop: 48 },
  { id: "chg",   name: "Chegg",           domain: "chegg.com",               cat: "learn",     pop: 46 },
  { id: "edx",   name: "edX",             domain: "edx.org",                 cat: "learn",     pop: 36 },
  { id: "brl",   name: "Brilliant",       domain: "brilliant.org",           cat: "learn",     pop: 30 },
  { id: "ocw",   name: "MIT OpenCourseWare", domain: "ocw.mit.edu",          cat: "learn",     pop: 28 },

  // sports
  { id: "espn",  name: "ESPN",            domain: "espn.com",                cat: "sports",    pop: 64 },
  { id: "nba",   name: "NBA",             domain: "nba.com",                 cat: "sports",    pop: 46 },
  { id: "fifa",  name: "FIFA",            domain: "fifa.com",                cat: "sports",    pop: 40 },
  { id: "strv",  name: "Strava",          domain: "strava.com",              cat: "sports",    pop: 38 },
];

/* Imported sites (sites-radar.js, generated by tools/radar-sites.mjs from
   Cloudflare Radar and the Chrome UX Report): every domain not listed above
   joins the network. Sites listed above keep their scores: Radar ranks by
   DNS lookups, which favours apps and background traffic over browsing.
   Entries are [domain, name, categories, pop, threat labels if flagged,
   English name if the name is in another script]; categories and threat
   labels are "|"-separated. A site in several categories gets a bubble in
   each; sites with threat labels get a warning ring and a warning that lists
   them before they open. */
if (typeof RADAR_SITES !== "undefined") {
  const byDomain = new Map(SITES.filter((s) => !s.path).map((s) => [s.domain, s]));
  for (const r of RADAR_SITES) {
    const [domain, name, cats, pop, risk, en] = Array.isArray(r) ? r : [r.domain, r.name, r.cat, r.pop, r.risk];
    if (byDomain.has(domain) || byDomain.has("www." + domain)) continue;
    cats.split("|").forEach((cat, i) => {
      const site = { id: "r:" + domain + (i ? "#" + cat : ""), name, domain, cat, pop };
      if (risk) site.risk = risk;
      if (en) site.en = en;
      SITES.push(site);
      if (!i) byDomain.set(domain, site);
    });
  }
}
