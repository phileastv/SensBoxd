/**
 * SensBoxd - Export SensCritique data to Letterboxd CSV format
 * Refactored version with proper module organization and state management
 */

// Global collections for CSV export
let moviesDiary = [];
let movieWatchlist = [];

// Initialize CSV headers
moviesDiary.push(CONFIG.CSV.DIARY_COLUMNS);
movieWatchlist.push(CONFIG.CSV.WISHLIST_COLUMNS);

// Universe collections for CSV export
let universeCollections = {
    diary: {}, // Will store diary data by universe
    wishlist: {} // Will store wishlist data by universe
};

// DOM elements
const loader = document.querySelector('#loader');
const exportDropdown = document.querySelector("#export-dropdown");
const snackbar = document.querySelector("#snackbar");
const floatingLoader = document.querySelector("#floating-loader");

// Scroll tracking variables
let lastScrollTop = 0;
let scrollTimeout = null;

// Loading abort / resume
let loadingAborted = false;
let savedLoadParams = null; // { numberToLoad, loadAllCollection, endOffset }

// ---------------------------------------------------------------------------
// Retry & throttle utilities
// ---------------------------------------------------------------------------

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const requestThrottler = {
    _lastTime: 0,
    async throttle() {
        const wait = CONFIG.RETRY.MIN_REQUEST_INTERVAL_MS - (Date.now() - this._lastTime);
        if (wait > 0) await sleep(wait);
        this._lastTime = Date.now();
    }
};

/**
 * Wrapper around $.ajax that retries on transient server errors (503, 429…)
 * using exponential backoff, and enforces a global minimum interval between
 * requests to avoid being flagged as a DDoS source.
 */
async function ajaxWithRetry(options) {
    const { MAX_ATTEMPTS, BASE_DELAY_MS, RETRYABLE_CODES } = CONFIG.RETRY;
    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
        await requestThrottler.throttle();
        try {
            return await $.ajax(options);
        } catch (err) {
            const isRetryable = RETRYABLE_CODES.includes(err.status);
            if (!isRetryable || attempt === MAX_ATTEMPTS) throw err;
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            const loaded = stateManager.get('products')?.length ?? 0;
            const total = stateManager.get('total') ?? 0;
            const progressInfo = total > 0 ? ` (${loaded}/${total} chargés)` : '';
            showSnackbar(`⚠️ Erreur ${err.status}${progressInfo} — Nouvelle tentative dans ${delay / 1000}s… (${attempt + 1}/${MAX_ATTEMPTS})`);
            await sleep(delay);
        }
    }
}

// ---------------------------------------------------------------------------

/**
 * Test proxy connectivity
 */
function testProxyConnectivity() {
    return $.ajax({
        url: '/src/proxy.php',
        type: 'GET',
        timeout: 5000
    }).done(function(data) {
        console.log('✅ Proxy connectivity test passed');
    }).fail(function() {
        console.error('❌ Proxy connectivity test failed');
        showSnackbar('Erreur: Impossible de contacter le serveur proxy');
    });
}

/**
 * Initialize the application when DOM is ready
 */
$(document).ready(function() {
    // Check if GraphQL queries are loaded
    if (!GRAPHQL_QUERIES || !GRAPHQL_QUERIES.USER_COLLECTION) {
        console.error('❌ GraphQL queries not loaded!');
        showSnackbar('Erreur: Les requêtes GraphQL ne sont pas chargées');
        return;
    }
    console.log('✅ GraphQL queries loaded successfully');
    
    // Test proxy connectivity on startup
    testProxyConnectivity();
    
    // Initialize state listeners
    initializeStateListeners();
    
    // Initialize scroll detection
    initializeScrollDetection();
    
    $('#form').submit(function(e) {
        e.preventDefault();
        handleFormSubmission();
    });

    // Bouton "Options avancées" — ouvre/ferme la plage et met à jour le texte du bouton submit
    $('#advanced-toggle-btn').on('click', function() {
        const panel = $('#advanced-options');
        const opening = !panel.is(':visible');
        panel.toggle(opening);
        $(this).text(opening ? '✕ Fermer les options avancées' : '⚙ Options avancées');
        updateSubmitButtonText();
    });

    // Mise à jour du texte du bouton submit en temps réel quand on change les valeurs de plage
    $('#range-start, #range-end').on('input', function() {
        updateSubmitButtonText();
    });
});

/**
 * Initialize state change listeners
 */
function initializeStateListeners() {
    // Listen for universe updates to show/hide tabs
    stateManager.addListener('universes_updated', function(universes) {
        updateUniverseTabs(universes);
    });
    
    // Listen for active universe changes to update display
    stateManager.addListener('active_universe_changed', function(newUniverse, oldUniverse) {
        updateActiveUniverseDisplay(newUniverse);
        updateTabActiveState(newUniverse);
    });
    
    // Listen for auto-scroll state changes
    stateManager.addListener('auto_scroll_changed', function(enabled) {
        updateFloatingLoader();
    });
    
    // Listen for loading state changes
    stateManager.addListener('isLoading', function(isLoading) {
        updateFloatingLoader();
    });
    
    // Listen for products added to animate count
    stateManager.addListener('products_added', function(products) {
        updateFloatingLoader();
        animateCountUpdate();
    });
    
    // Listen for username changes to show/hide floating loader
    stateManager.addListener('username', function(username) {
        updateFloatingLoader();
    });
}

/**
 * Initialize scroll detection to manage auto-scroll behavior
 */
function initializeScrollDetection() {
    console.log('🎯 Initializing scroll detection');
    
    window.addEventListener('scroll', function() {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Clear existing timeout
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // Debounce scroll detection
        scrollTimeout = setTimeout(function() {
            handleScrollDetection(currentScrollTop);
        }, 100);
    });
    
    // Add click handler for floating loader (but not for checkbox or stop/resume btn)
    floatingLoader.addEventListener('click', function(e) {
        if (e.target.type === 'checkbox' || e.target.tagName === 'LABEL' || e.target.id === 'stop-resume-btn') {
            return;
        }
        toggleAutoScroll();
    });

    // Stop / Resume button
    document.getElementById('stop-resume-btn').addEventListener('click', function() {
        if (loadingAborted) {
            resumeLoading();
        } else {
            stopLoading();
        }
    });
    
    // Add specific handler for checkbox
    document.addEventListener('change', function(e) {
        if (e.target.id === 'auto-scroll-checkbox') {
            console.log('🎯 Auto-scroll checkbox changed:', e.target.checked);
            const currentState = stateManager.isAutoScrollEnabled();
            if (e.target.checked !== currentState) {
                toggleAutoScroll();
            }
        }
    });
    
    // Add click-outside-to-close for popup
    document.addEventListener('click', function(e) {
        const popupOverlay = document.getElementById('success-popup-overlay');
        const popup = document.getElementById('success-popup');
        
        if (e.target === popupOverlay && !popup.contains(e.target)) {
            closeSuccessPopup();
        }
    });
}

/**
 * Handle scroll detection logic
 */
function handleScrollDetection(currentScrollTop) {
    const scrollThreshold = CONFIG.UI.SCROLL_THRESHOLD;
    
    // Check if user scrolled up significantly
    if (currentScrollTop < scrollThreshold && stateManager.isAutoScrollEnabled()) {
        // User scrolled to top, disable auto-scroll
        console.log('🔄 Auto-scroll disabled - user scrolled to top');
        stateManager.setAutoScrollEnabled(false);
        stateManager.setUserScrolledUp(true);
        // Immediately update floating loader visibility
        updateFloatingLoader();
    } else if (currentScrollTop >= scrollThreshold && !stateManager.isAutoScrollEnabled()) {
        // User scrolled down past threshold, could re-enable auto-scroll
        // But only if they haven't manually disabled it
        if (stateManager.hasUserScrolledUp()) {
            console.log('🔄 User scrolled down past threshold');
            stateManager.setUserScrolledUp(false);
            // Update floating loader visibility
            updateFloatingLoader();
        }
    }
    
    lastScrollTop = currentScrollTop;
}

/**
 * Update the submit button text based on the current mode
 */
function updateSubmitButtonText() {
    const isRange = $('#advanced-options').is(':visible');
    if (isRange) {
        const start = parseInt($('#range-start').val()) || 0;
        const end = parseInt($('#range-end').val()) || 400;
        $('#submit').val(`Charger les entrées ${start} → ${end}`);
    } else {
        $('#submit').val('Charger ma collection');
    }
}

/**
 * Handle form submission and initialize data loading
 */
function handleFormSubmission() {
    showLoader();
    
    // Update state with form values
    const username = $("#username").val();
    const isRangeMode = $('#advanced-options').is(':visible');

    let startOffset = 0;
    let endOffset = null;
    const itemsPerLoad = CONFIG.API.DEFAULT_LIMIT;

    if (isRangeMode) {
        startOffset = Math.max(0, parseInt($("#range-start").val()) || 0);
        endOffset = Math.max(startOffset + 1, parseInt($("#range-end").val()) || startOffset + 400);
    }

    // Set abort flag and params BEFORE stateManager.update so updateFloatingLoader
    // already has savedLoadParams when isLoading triggers it
    loadingAborted = false;
    savedLoadParams = { numberToLoad: itemsPerLoad, loadAllCollection: true, endOffset };

    stateManager.update({
        username: username,
        offset: startOffset,
        currentPage: 0,
        products: [],
        total: 0,
        isLoading: true,
        autoScrollEnabled: true,
        userScrolledUp: false
    });
    
    // Clear previous data
    moviesDiary = [CONFIG.CSV.DIARY_COLUMNS];
    movieWatchlist = [CONFIG.CSV.WISHLIST_COLUMNS];
    
    // Clear universe collections
    universeCollections = {
        diary: {},
        wishlist: {}
    };
    
    // Update UI
    updateUIForDataLoading(username);

    // Toujours charger toute la collection (ou jusqu'à la borne de plage si mode avancé)
    loadNewPageFromQueryData(itemsPerLoad, true, endOffset);
}

/**
 * Update UI elements when starting data loading.
 * Uses a CSS class transition instead of innerHTML replacement for a smooth animation.
 */
function updateUIForDataLoading(username) {
    // Populate the compact username area before triggering the transition
    document.getElementById('header-username-text').textContent = username;

    // Trigger the CSS transition: home header → compact header
    document.getElementById('header').classList.add('header-compact');
    document.body.classList.add('header-compact');

    // Clear homepage content
    document.querySelector('#welcome-explainer').innerHTML = '';
    document.getElementById('posterlist').innerHTML = '';

    // Hide bento boxes
    const bentoContainer = document.querySelector('.bento-container');
    if (bentoContainer) {
        bentoContainer.style.display = 'none';
    }
}

/**
 * Load data from SensCritique API
 * @param {number} numberToLoad - Items per page
 * @param {boolean} loadAllCollection - Whether to keep paginating
 * @param {number|null} endOffset - Stop pagination at this offset (range mode), null = no limit
 */
async function loadNewPageFromQueryData(numberToLoad, loadAllCollection = false, endOffset = null) {
    const queryData = defineQueryData(stateManager.get('username'), numberToLoad);
    
    try {
        const data = await ajaxWithRetry({
            url: '/src/proxy.php',
            type: "POST",
            data: JSON.stringify(queryData),
            dataType: "json",
            contentType: CONFIG.HEADERS.CONTENT_TYPE,
            headers: {
                'X-Proxy-URL': CONFIG.API.URL,
                'authorization': CONFIG.API.AUTHORIZATION,
                'Accept': CONFIG.HEADERS.ACCEPT
            }
        });
        
        await handleApiResponse(data, numberToLoad, loadAllCollection, endOffset);
        
    } catch (error) {
        handleApiError(error);
    }
}

/**
 * Handle successful API response and manage profile errors
 */
async function handleApiResponse(data, numberToLoad, loadAllCollection = false, endOffset = null) {
    // CAS DU PROFIL INTROUVABLE OU PRIVÉ (data.data.user est null)
    if (data.data.user == null) {
        // On crée un objet d'erreur simulé pour déclencher proprement le panneau d'aide help.html
        const fakeProfileError = {
            status: "Profil introuvable",
            responseText: JSON.stringify({
                error: "Utilisateur inconnu ou privé",
                message: "Le pseudo fourni n'existe pas sur SensCritique ou son accès est restreint."
            })
        };
        
        // On délègue l'affichage au panneau d'erreur interactif
        handleApiError(fakeProfileError);
        return;
    }
    
    // Update user avatar if not already shown
    if ($('#useravatar > *').length == 0) {
        let avatarUrl = data.data.user.medias.avatar;
        // Use proxy for avatar images from media.senscritique.com to avoid CORS issues
        if (avatarUrl && avatarUrl.includes('media.senscritique.com')) {
            avatarUrl = `/src/proxy.php?csurl=${encodeURIComponent(avatarUrl)}`;
        }
        const avatarImg = `<img id='profileavatar' height='50' width='50' alt='profileavatar' src='${avatarUrl}'></img>`;
        $(avatarImg).appendTo("#useravatar");
    }
    
    // Update total count on first load
    if (stateManager.get('total') === 0) {
        stateManager.set('total', data.data.user.collection.total);
    }
    
    // Process all products (not just movies)
    const products = data.data.user.collection.products;
    
    // Extract data for all products regardless of universe
    products.forEach(element => {
                        extractDataFromElement(element);
    });
    
    // Update state with all products
    stateManager.addProducts(products);
    stateManager.incrementPage();
    
    // UI updates
                autoScroll();
                hideLoader();
                showExportButton();
    
    // Continue loading if needed, respecting optional endOffset (range mode)
    if (loadAllCollection && stateManager.hasMoreProducts()) {
        const nextOffset = stateManager.get('offset') + numberToLoad;
        if (endOffset !== null && nextOffset >= endOffset) {
            // Range limit reached — true end of loading
            stateManager.set('isLoading', false);
            return;
        }
        stateManager.incrementOffset(numberToLoad);
        // Keep savedLoadParams up to date so resume always starts from current position
        if (savedLoadParams) {
            savedLoadParams = { numberToLoad, loadAllCollection, endOffset };
        }
        if (loadingAborted) {
            // User stopped — isLoading is already set to false by stopLoading()
            return;
        }
        await loadNewPageFromQueryData(numberToLoad, loadAllCollection, endOffset);
    } else {
        // No more pages — true end of loading
        stateManager.set('isLoading', false);
    }
}

/**
* Handle API errors dynamically based on progress
*/
function handleApiError(error) {
   console.error('❌ AJAX Error:', error);
   hideLoader();
   stateManager.set('isLoading', false);

   const username = stateManager.get('username') || "Inconnu";
   const errorStatus = error.status || "Erreur réseau";
   
   let errorDetails = "Impossible de joindre l'API de SensCritique.";
   if (error.responseText) {
       try {
           const parsed = JSON.parse(error.responseText);
           errorDetails = parsed.message || parsed.error || error.responseText.substring(0, 100);
       } catch(e) {
           errorDetails = error.responseText.substring(0, 100);
       }
   }

   const totalLoadedCount = stateManager.getTotalItemsCount();

   // Si des données ont déjà été chargées : alerte discrète en Snackbar
   if (totalLoadedCount > 0) {
       const detailSuffix = errorDetails && errorDetails !== "Impossible de joindre l'API de SensCritique."
           ? ` — ${errorDetails}`
           : '';
       showSnackbar(`⚠️ Erreur ${errorStatus} lors de la récupération de la page suivante.${detailSuffix}`);
       const submitBtn = document.getElementById("submit");
       if (submitBtn) {
           submitBtn.style.display = 'block';
       }
       return;
   }

   // Si aucune donnée n'a été récupérée (0 œuvres) : affichage du panneau d'aide complet
   const queryParams = new URLSearchParams({
       user: username,
       status: errorStatus,
       details: errorDetails
   });

   const helpPageUrl = `./help.html?${queryParams.toString()}`;
   const posterList = document.getElementById("posterlist");

   if (posterList) {
       // CORRECTION DU CADRE BLANC : suppression stricte des styles CSS hérités
       posterList.setAttribute("style", "background: transparent !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important;");

       // Intégration de l'iframe à l'échelle optimale
       posterList.innerHTML = `
           <iframe src="${helpPageUrl}" style="
               width: 100%;
               min-height: 900px; /* Hauteur augmentée pour contenir le texte de profil sans scroll */
               border: none;
               background: transparent;
               display: block;
               margin: 0 auto;
               max-width: 650px;
               overflow: hidden;
           " scrolling="no"></iframe>
       `;
   }

   // Ré-affichage du formulaire de recherche
   const submitBtn = document.getElementById("submit");
   if (submitBtn) {
       submitBtn.style.display = 'block';
   }

   showSnackbar("Le chargement a échoué. Consultez le guide d'aide affiché ci-dessous.");
}

/**
 * Create GraphQL query data
 */
function defineQueryData(username, numberToLoad) {
    return {
        operationName: "UserCollection",
        variables: {
            action: null,
            categoryId: null,
            gameSystemId: null,
            genreId: null,
            keywords: null,
            limit: parseInt(numberToLoad),
            offset: stateManager.get('offset'),
            order: "LAST_ACTION_DESC",
            universe: null,
            username: username,
            yearDateDone: null,
            yearDateRelease: null
        },
        query: GRAPHQL_QUERIES.USER_COLLECTION
    };
}

/**
 * Extract and process data from API response element for any universe
 */
function extractDataFromElement(element) {
    const title = extractTitle(element);
    if (!title) return;
    
    const year = extractYear(element);
    const creators = extractCreators(element);
    const rating = element.otherUserInfos.rating;
    const watchedDate = extractWatchedDate(element);
    const isWishlist = element.otherUserInfos.isWished;
    const isDone = element.otherUserInfos.isDone;
    const url = CONFIG.API.BASE_URL + element.url;
    const imgUrl = element.medias.picture;
    const universe = element.universe;
    
    addToUniverseCollections(universe, title, year, creators, rating, watchedDate, isWishlist, isDone);
    
    // Only draw items for the currently active universe
    if (universe === stateManager.get('activeUniverse')) {
        drawNewItem(url, imgUrl, title, year, rating, watchedDate, isWishlist);
    }
}

/**
 * Extract title from element with fallback logic
 */
function extractTitle(element) {
    if (element.originalTitle !== null) {
        return '"' + element.originalTitle + '"';
    } else if (element.title !== null) {
        return '"' + element.title + '"';
    }
    return null;
}

/**
 * Extract year from element with multiple fallbacks
 */
function extractYear(element) {
    if (element.dateRelease !== null) {
        return convertDateToYear(element.dateRelease);
    } else if (element.yearOfProduction !== null) {
        return element.yearOfProduction;
    } else if (element.frenchReleaseDate !== null) {
        return convertDateToYear(element.frenchReleaseDate);
    }
    return null;
}

/**
 * Extract creators from element based on universe type
 */
function extractCreators(element) {
    try {
        const universe = element.universe;
        
        // Different universes have different creator fields
        switch (universe) {
            case 1: // Films
                return element.directors?.map(d => d.name).join(', ') || '';
            case 2: // Livres
                return element.authors?.map(a => a.name).join(', ') || '';
            case 3: // Jeux vidéo
                return element.developers?.map(d => d.name).join(', ') || '';
            case 4: // Séries
                return element.creators?.map(c => c.name).join(', ') || element.directors?.map(d => d.name).join(', ') || '';
            case 6: // BDs
                return element.authors?.map(a => a.name).join(', ') || element.pencillers?.map(p => p.name).join(', ') || '';
            case 7: // Albums
            case 8: // Morceaux
                return element.artists?.map(a => a.name).join(', ') || '';
            default:
                return '';
        }
    } catch (e) {
        return "";
    }
}

/**
 * Extract watched date from element with error handling
 */
function extractWatchedDate(element) {
    try {
        if (!element.otherUserInfos.dateDone) {
            return "";
        }

        // SensCritique stores watched dates as UTC timestamps.
        // Letterboxd uses local YYYY-MM-DD format.
        // Convert to local time to avoid off-by-one-day errors.
        const utcDate = new Date(element.otherUserInfos.dateDone);

        const options = {
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        };

        const formatter = new Intl.DateTimeFormat('fr-FR', options);
        const parts = formatter.formatToParts(utcDate);

        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;

        const localDate = `${year}-${month}-${day}`;

        return localDate;
    } catch (e) {
        return "";
    }
}

/**
 * Convert date string to year
 */
function convertDateToYear(dateString) {
    return dateString.substring(0, 4);
}

/**
 * Add item to appropriate universe collections (diary/wishlist)
 */
function addToUniverseCollections(universe, title, year, creators, rating, watchedDate, isWishlist, isDone) {
    // Initialize universe collections if they don't exist
    if (!universeCollections.diary[universe]) {
        const universeConfig = CONFIG.UNIVERSES[universe];
        if (universeConfig) {
            universeCollections.diary[universe] = [universeConfig.csvColumns];
            universeCollections.wishlist[universe] = [universeConfig.csvColumns.slice(0, 3)]; // Title, Year, Creators
        }
    }
    
    // Clean special characters for CSV compatibility
    const titleCleaned = title.replace(CONFIG.CSV.REGEX_CHAR_TO_REMOVE, '');
    const creatorsCleaned = creators.replace(CONFIG.CSV.REGEX_CHAR_TO_REMOVE, '');
    const yearInt = parseInt(year);
    const ratingInt = parseInt(rating);
    
    const universeLabel = CONFIG.UNIVERSES[universe]?.label || 'Unknown';
    
    if (isDone === true && universeCollections.diary[universe]) {
        console.log(`✅ Ajouté au journal ${universeLabel} ➡️ ${title}`);
        universeCollections.diary[universe].push([titleCleaned, yearInt, creatorsCleaned, ratingInt, watchedDate]);
    }
    
    if (isWishlist === true && universeCollections.wishlist[universe]) {
        universeCollections.wishlist[universe].push([titleCleaned, yearInt, creatorsCleaned]);
        console.log(`📝 Ajouté à la Wishlist ${universeLabel} ➡️ ${title}`);
    }
    
    // Also add to legacy collections for backward compatibility (movies only)
    if (universe === 1) {
        if (isDone === true) {
            moviesDiary.push([titleCleaned, yearInt, creatorsCleaned, ratingInt, watchedDate]);
        }
        if (isWishlist === true) {
            movieWatchlist.push([titleCleaned, yearInt, creatorsCleaned]);
        }
    }
}

/**
 * Export diary to CSV file (legacy function - now redirects to exportAll)
 */
function exportDiary() {
    exportAll();
}

/**
 * Export wishlist to CSV file (legacy function for movies)
 */
function exportWishlist() {
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const filename = `${date} Export SensCritique de ${stateManager.get('username')} - Films dans la watchlist.csv`;
    exportToCsv(filename, movieWatchlist);
}

/**
 * Export diary for a specific universe
 */
function exportUniverseDiary(universeId) {
    const universeConfig = CONFIG.UNIVERSES[universeId];
    if (!universeConfig || !universeCollections.diary[universeId]) {
        showSnackbar('Aucune donnée à exporter pour cet univers');
        return;
    }
    
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const filename = `${date} Export SensCritique de ${stateManager.get('username')} - ${universeConfig.label} vu(e)s.csv`;
    exportToCsv(filename, universeCollections.diary[universeId]);
}

/**
 * Export wishlist for a specific universe
 */
function exportUniverseWishlist(universeId) {
    const universeConfig = CONFIG.UNIVERSES[universeId];
    if (!universeConfig || !universeCollections.wishlist[universeId]) {
        showSnackbar('Aucune donnée à exporter pour cet univers');
        return;
    }
    
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const filename = `${date} Export SensCritique de ${stateManager.get('username')} - ${universeConfig.label} dans la watchlist.csv`;
    exportToCsv(filename, universeCollections.wishlist[universeId]);
}

/**
 * Export for Letterboxd (Films only - Diary + Wishlist)
 */
function exportForLetterboxd() {
    const filmUniverseId = 1; // Films universe
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const username = stateManager.get('username');
    
    let downloadsStarted = 0;
    let totalItems = 0;
    
    // Export Films Diary
    if (universeCollections.diary[filmUniverseId] && universeCollections.diary[filmUniverseId].length > 1) {
        const diaryFilename = `${date} Export SensCritique de ${username} - Films vus.csv`;
        exportToCsv(diaryFilename, universeCollections.diary[filmUniverseId]);
        downloadsStarted++;
        totalItems += universeCollections.diary[filmUniverseId].length - 1; // -1 for header row
    }
    
    // Export Films Wishlist
    if (universeCollections.wishlist[filmUniverseId] && universeCollections.wishlist[filmUniverseId].length > 1) {
        const wishlistFilename = `${date} Export SensCritique de ${username} - Films dans la watchlist.csv`;
        setTimeout(() => {
            exportToCsv(wishlistFilename, universeCollections.wishlist[filmUniverseId]);
        }, 100); // Small delay to avoid browser blocking multiple downloads
        downloadsStarted++;
        totalItems += universeCollections.wishlist[filmUniverseId].length - 1; // -1 for header row
    }
    
    if (downloadsStarted > 0) {
        // Show success popup after a short delay to ensure downloads have started
        setTimeout(() => {
            showLetterboxdSuccessPopup(totalItems, downloadsStarted);
        }, 500);
    } else {
        showSnackbar('Aucun film trouvé à exporter pour Letterboxd');
    }
}

/**
 * Export all universes (Films, Series, Books, Albums, etc.)
 */
function exportAll() {
    const availableUniverses = stateManager.getAvailableUniverses();
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const username = stateManager.get('username');
    
    let downloadsStarted = 0;
    let totalItems = 0;
    let delay = 0;
    const exportedFiles = [];
    
    availableUniverses.forEach(universe => {
        // Export Diary for this universe
        if (universeCollections.diary[universe.id] && universeCollections.diary[universe.id].length > 1) {
            const diaryFilename = `${date} Export SensCritique de ${username} - ${universe.label} vu(e)s.csv`;
            setTimeout(() => {
                exportToCsv(diaryFilename, universeCollections.diary[universe.id]);
            }, delay);
            delay += 150; // Stagger downloads to avoid browser blocking
            downloadsStarted++;
            totalItems += universeCollections.diary[universe.id].length - 1; // -1 for header row
            exportedFiles.push({
                type: 'diary',
                universe: universe.label,
                count: universeCollections.diary[universe.id].length - 1
            });
        }
        
        // Export Wishlist for this universe
        if (universeCollections.wishlist[universe.id] && universeCollections.wishlist[universe.id].length > 1) {
            const wishlistFilename = `${date} Export SensCritique de ${username} - ${universe.label} dans la watchlist.csv`;
            setTimeout(() => {
                exportToCsv(wishlistFilename, universeCollections.wishlist[universe.id]);
            }, delay);
            delay += 150;
            downloadsStarted++;
            totalItems += universeCollections.wishlist[universe.id].length - 1; // -1 for header row
            exportedFiles.push({
                type: 'wishlist',
                universe: universe.label,
                count: universeCollections.wishlist[universe.id].length - 1
            });
        }
    });
    
    if (downloadsStarted > 0) {
        // Show success popup after all downloads have started
        setTimeout(() => {
            showExportAllSuccessPopup(totalItems, downloadsStarted, exportedFiles);
        }, delay + 500);
    } else {
        showSnackbar('Aucune donnée trouvée à exporter');
    }
}

/**
 * Export data to CSV file
 */
function exportToCsv(filename, rows) {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Auto-scroll functionality
 */
function autoScroll() {
    if (CONFIG.UI.AUTO_SCROLL && stateManager.isAutoScrollEnabled()) {
        setTimeout(function() {
            window.scrollBy({
                top: CONFIG.UI.SCROLL_DISTANCE,
                left: 0,
                behavior: "smooth"
            });
        }, CONFIG.UI.SCROLL_DELAY);
    }
}

/**
 * Draw new item poster in the UI
 */
function drawNewItem(scUrl, imgUrl, name, year, rating, date, isWishlist) {
    const img = document.createElement("img");
    
    // Use proxy for images from media.senscritique.com to avoid CORS issues
    if (imgUrl && imgUrl.includes('media.senscritique.com')) {
        img.src = `/src/proxy.php?csurl=${encodeURIComponent(imgUrl)}`;
    } else {
        img.src = imgUrl;
    }
    
    img.className = "poster";
    img.title = `${name} (${year}) - Noté ${rating} le ${date.toString()}`;
    img.href = scUrl;
    
    if (isWishlist) {
        img.className = "wishlist poster";
    }
    
    const posterContainer = document.getElementById("posterlist");
    posterContainer.appendChild(img);
    
    setTimeout(() => img.classList.add("animate"), CONFIG.UI.ANIMATION_DELAY);
}

/**
 * Show loading indicator with random message
 */
function showLoader() {
    const randomMessage = stateManager.getNextLoadingMessage();
    loader.innerHTML = randomMessage;
    loader.style.display = 'block';
    stateManager.set('isLoading', true);
}

/**
 * Hide the visual #loader element ("ça mouline...").
 * Does NOT touch isLoading — that flag stays true across the full
 * multi-page collection load, so the floating loader spinner and
 * "Arrêter" button stay visible until every page is fetched.
 */
function hideLoader() {
    loader.style.display = 'none';
}

/**
 * Show snackbar notification
 */
function showSnackbar(message) {
    snackbar.innerHTML = message;
    snackbar.className = "show";

    setTimeout(function() {
        snackbar.className = snackbar.className.replace("show", "");
    }, CONFIG.UI.SNACKBAR_DURATION);
}

/**
 * Show export button
 */
function showExportButton() {
    const exportDropdown = document.getElementById('export-dropdown');
    if (exportDropdown) {
        exportDropdown.style.opacity = 1;
    }
}

/**
 * Hide export info box
 */
function hideExportInfoBox() {
    document.querySelector('#export-info-box').classList = "";
}

/**
 * Update universe tabs display
 */
function updateUniverseTabs(universes) {
    const tabsContainer = document.querySelector('#universe-tabs .tabs-container');
    const universeTabs = document.querySelector('#universe-tabs');
    
    if (universes.length <= 1) {
        universeTabs.style.display = 'none';
        return;
    }
    
    // Clear existing tabs
    tabsContainer.innerHTML = '';
    
    // Create tabs for each universe
    universes.forEach(universe => {
        const tab = document.createElement('button');
        tab.className = 'universe-tab';
        tab.dataset.universe = universe.id;
        tab.innerHTML = `${universe.label} <span class="count">(${universe.count})</span>`;
        
        // Set active state for current universe
        if (universe.id === stateManager.get('activeUniverse')) {
            tab.classList.add('active');
        }
        
        // Add click handler
        tab.addEventListener('click', () => {
            switchToUniverse(universe.id);
        });
        
        tabsContainer.appendChild(tab);
    });
    
    universeTabs.style.display = 'block';
}

/**
 * Switch to a different universe
 */
function switchToUniverse(universeId) {
    stateManager.setActiveUniverse(universeId);
}

/**
 * Update tab active state
 */
function updateTabActiveState(activeUniverse) {
    const tabs = document.querySelectorAll('.universe-tab');
    tabs.forEach(tab => {
        if (parseInt(tab.dataset.universe) === activeUniverse) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

/**
 * Update display for active universe
 */
function updateActiveUniverseDisplay(universeId) {
    const posterContainer = document.getElementById("posterlist");
    posterContainer.innerHTML = "";
    
    // Get products for the active universe
    const products = stateManager.getUniverseProducts(universeId);
    
    // Draw all products for this universe
    products.forEach(element => {
        const title = extractTitle(element);
        if (!title) return;
        
        const year = extractYear(element);
        const rating = element.otherUserInfos.rating;
        const watchedDate = extractWatchedDate(element);
        const isWishlist = element.otherUserInfos.isWished;
        const url = CONFIG.API.BASE_URL + element.url;
        const imgUrl = element.medias.picture;
        
        drawNewItem(url, imgUrl, title, year, rating, watchedDate, isWishlist);
    });
}

/**
 * Update floating loader visibility and content
 */
function updateFloatingLoader() {
    const floatingLoader = document.getElementById('floating-loader');
    const countText = floatingLoader.querySelector('.count-text');
    const loadingIcon = floatingLoader.querySelector('.loading-icon');
    const autoScrollCheckbox = document.getElementById('auto-scroll-checkbox');
    
    const isLoading = stateManager.get('isLoading');
    const autoScrollEnabled = stateManager.isAutoScrollEnabled();
    const totalCount = stateManager.getTotalItemsCount();
    const username = stateManager.get('username');
    
    // Show floating loader when we have a username (tool is started)
    if (username) {
        floatingLoader.style.display = 'block';
        
        // Update count
        countText.textContent = totalCount;
        
        // Update checkbox state
        if (autoScrollCheckbox) {
            autoScrollCheckbox.checked = autoScrollEnabled;
        }
        
        // Show/hide spinner based on loading state
        if (isLoading) {
            loadingIcon.classList.remove('hidden');
            floatingLoader.classList.add('loading');
        } else {
            loadingIcon.classList.add('hidden');
            floatingLoader.classList.remove('loading');
        }

        // Stop / Resume button
        const stopBtn = document.getElementById('stop-resume-btn');
        if (stopBtn) {
            if (isLoading) {
                stopBtn.style.display = 'block';
                stopBtn.textContent = '◼ Arrêter';
                stopBtn.classList.remove('is-resume');
            } else if (loadingAborted) {
                stopBtn.style.display = 'block';
                stopBtn.textContent = '▶ Reprendre';
                stopBtn.classList.add('is-resume');
            } else {
                stopBtn.style.display = 'none';
            }
        }
        
        // Update background color: black in paused state, else based on auto-scroll
        if (loadingAborted) {
            floatingLoader.style.backgroundColor = 'black';
        } else if (autoScrollEnabled) {
            floatingLoader.style.backgroundColor = 'var(--green)';
        } else {
            floatingLoader.style.backgroundColor = 'var(--orange)';
        }
    } else {
        floatingLoader.style.display = 'none';
    }
}

/**
 * Animate count when new items are added
 */
function animateCountUpdate() {
    const floatingLoader = document.getElementById('floating-loader');
    floatingLoader.classList.add('animate-count');
    
    setTimeout(() => {
        floatingLoader.classList.remove('animate-count');
    }, 600);
}

/**
 * Toggle auto-scroll state
 */
function toggleAutoScroll() {
    const currentState = stateManager.isAutoScrollEnabled();
    stateManager.setAutoScrollEnabled(!currentState);
    
    if (!currentState) {
        // If enabling auto-scroll, scroll to bottom
        stateManager.setUserScrolledUp(false);
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }
    
    updateFloatingLoader();
}

/**
 * Stop ongoing collection loading
 */
function stopLoading() {
    loadingAborted = true;
    stateManager.set('isLoading', false);
    updateFloatingLoader();
    showSnackbar('⏸ Chargement mis en pause. Clique sur "Reprendre" pour continuer.');
}

/**
 * Resume collection loading from current offset
 */
function resumeLoading() {
    if (!savedLoadParams) return;
    loadingAborted = false;
    stateManager.set('isLoading', true);
    updateFloatingLoader();
    const { numberToLoad, loadAllCollection, endOffset } = savedLoadParams;
    loadNewPageFromQueryData(numberToLoad, loadAllCollection, endOffset);
}

/**
 * Show success popup for Letterboxd export
 */
function showLetterboxdSuccessPopup(totalItems, filesCount) {
    const popupOverlay = document.getElementById('success-popup-overlay');
    const popupContent = document.querySelector('.popup-content');
    
    popupContent.innerHTML = `
        <h2>🎉 Bravo !</h2>
        <div class="success-count">${totalItems}</div>
        <div class="success-message">Tu as maintenant exporté <strong>${totalItems} œuvres</strong> de ton SensCritique !</div>
        
        <video width='350' height='260' controls autoplay>
            <source src='./video/fantasticmrfox_whistle.mp4' type='video/mp4'>
            Your browser does not support the video tag.
        </video>
        
        <div class="instruction-text">
            <strong>📽️ Pour importer tes films sur Letterboxd :</strong><br>
            Clique sur le bouton ci-dessous pour accéder à la page d'importation de Letterboxd, puis sélectionne les fichiers CSV que tu viens de télécharger !
        </div>
        
        <a href="https://letterboxd.com/import/" target="_blank" rel="noopener noreferrer" class="letterboxd-button">
            🚀 Aller sur la page d'importation Letterboxd
        </a>

        <div class="instruction-text">
            <strong>☕ Tu as aimé cet outil et gagné un temps monstrueux ?</strong><br>
            Tu peux (si tu le souhaites) <strong><a href="https://buymeacoffee.com/phileas_imt" target="_blank" rel="noopener noreferrer">m'offrir un café (slurp, merci !) ☕</a></strong>
            </br></br>Sache également que ce site est <a href="https://github.com/phileastv/SensBoxd" target="_blank" rel="noopener noreferrer">open-source</a>, tout le monde peut contribuer à son amélioration. Rends le monde meilleur et parles en autour de toi ! ☭
        </div>

        <br>
        <button class="close-button" onclick="closeSuccessPopup()">Fermer</button>
    `;
    
    popupOverlay.classList.add('show');
}

/**
 * Show success popup for Export All
 */
function showExportAllSuccessPopup(totalItems, filesCount, exportedFiles) {
    const popupOverlay = document.getElementById('success-popup-overlay');
    const popupContent = document.querySelector('.popup-content');
    
    // Generate files list
    let filesList = '<div class="files-list"><h3>📁 Fichiers téléchargés :</h3>';
    exportedFiles.forEach(file => {
        const typeLabel = file.type === 'diary' ? 'vus' : 'dans la watchlist';
        filesList += `
            <div class="file-item">
                <span class="file-name">${file.universe} ${typeLabel}</span>
                <span class="file-count">${file.count} éléments</span>
            </div>
        `;
    });
    filesList += '</div>';
    
    popupContent.innerHTML = `
        <h2>🎉 Bravo !</h2>
        <div class="success-count">${totalItems}</div>
        <div class="success-message">Tu as maintenant exporté <strong>${totalItems} œuvres</strong> de ton SensCritique !</div>
        
        <video width='350' height='260' controls autoplay>
            <source src='./video/fantasticmrfox_whistle.mp4' type='video/mp4'>
            Your browser does not support the video tag.
        </video>
        
        ${filesList}
        
        <div class="instruction-text">
            <strong>📚 Tes collections sont maintenant exportées !</strong><br>
            Tu as téléchargé ${filesCount} fichiers CSV contenant toutes tes données SensCritique. 
            Pour les films, tu peux les <a href="https://letterboxd.com/import/" target="_blank" rel="noopener noreferrer">importer sur Letterboxd</a>. 
            Les autres contenus peuvent être utilisés pour d'autres plateformes ou pour tes archives personnelles.
        </div>
        
        <button class="close-button" onclick="closeSuccessPopup()">Fermer</button>
    `;
    
    popupOverlay.classList.add('show');
}

/**
 * Close success popup
 */
function closeSuccessPopup() {
    const popupOverlay = document.getElementById('success-popup-overlay');
    popupOverlay.classList.remove('show');
}