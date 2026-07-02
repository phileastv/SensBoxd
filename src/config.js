/**
 * Configuration constants for SensBoxd application
 */
const CONFIG = {
    // API Configuration
    API: {
        URL: "https://apollo.senscritique.com/",
        BASE_URL: "https://senscritique.com",
        DEFAULT_LIMIT: 25,
        AUTHORIZATION: 'null',
        GITHUB_ISSUES_URL: "https://github.com/phileastv/SensBoxd/issues/"
    },
    
    // UI Configuration
    UI: {
        AUTO_SCROLL: true,
        SCROLL_DISTANCE: 3000,
        SCROLL_DELAY: 1000,
        ANIMATION_DELAY: 1000,
        SNACKBAR_DURATION: 3000,
        SCROLL_THRESHOLD: 200, // Distance from top to disable auto-scroll
        FLOATING_LOADER_DELAY: 500 // Delay before showing floating loader
    },
    
    // Universe Configuration
    UNIVERSES: {
        1: { label: "Films", csvColumns: ["Title", "Year", "Directors", "Rating10", "WatchedDate"] },
        2: { label: "Livres", csvColumns: ["Title", "Year", "Authors", "Rating10", "WatchedDate"] },
        3: { label: "Jeux vidéo", csvColumns: ["Title", "Year", "Developers", "Rating10", "WatchedDate"] },
        4: { label: "Séries", csvColumns: ["Title", "Year", "Creators", "Rating10", "WatchedDate"] },
        6: { label: "BDs", csvColumns: ["Title", "Year", "Authors", "Rating10", "WatchedDate"] },
        7: { label: "Albums", csvColumns: ["Title", "Year", "Artists", "Rating10", "WatchedDate"] },
        8: { label: "Morceaux", csvColumns: ["Title", "Year", "Artists", "Rating10", "WatchedDate"] }
    },
    
    // CSV Configuration
    CSV: {
        DIARY_COLUMNS: ["Title", "Year", "Directors", "Rating10", "WatchedDate"],
        WISHLIST_COLUMNS: ["Title", "Year", "Directors"],
        REGEX_CHAR_TO_REMOVE: /[#,<\{\}\[\]\\\/]/g
    },
    
    // Messages
    MESSAGES: {
        FR: {
            DIARY_LOAD_SUCCESS_PREFIX: "Les éléments de la page ",
            DIARY_LOAD_SUCCESS_MIDDLE: " de votre ",
            DIARY_LOAD_SUCCESS_SUFFIX: " ont été chargés ✨",
            DIARY_NAME: "journal",
            COLLECTION_NAME: "collection",
            LOADING_CSV: "👀 Génération du fichier CSV en cours...",
            LOADING: [
                "⚙️ Ça mouline, ça mouline...",
                "🤖 Atta, je travaille...",
                "😌 Va boire un café mon coco...",
                "👇 Tire sur mon doigt en attendant...",
                "🐢 Laisse-moi 2 petites secondes..."
            ],
            PROFILE_ERROR: "Nous n'avons pas pû récupérer ton profil. Est-il bien défini en public ?",
            OTHER_UNIVERSE_WARNING: "Des produits d'autres univers (séries/lives/jv) n'ont pas été chargées.",
            AJAX_ERROR: "Erreur lors du chargement des données. Vérifiez la console pour plus de détails."
        }
    },
    
    // Request Headers
    HEADERS: {
        USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0',
        ACCEPT: '*/*',
        REFERER: 'https://www.senscritique.com/',
        ORIGIN: 'https://www.senscritique.com',
        CONTENT_TYPE: 'application/json'
    },
    
    // Retry & throttle configuration
    RETRY: {
        MAX_ATTEMPTS: 3,
        BASE_DELAY_MS: 2000,
        RETRYABLE_CODES: [429, 502, 503, 504],
        MIN_REQUEST_INTERVAL_MS: 900
    },

    // Constants
    CONSTANTS: {
        MOVIE_UNIVERSE_ID: 1,
        EXPORT_INFO_BOX_SHOW_CLASS: "show"
    }
}; 