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

// DOM elements
const loader = document.querySelector('#loader');
const exportButton = document.querySelector("#export");
const snackbar = document.querySelector("#snackbar");

// Configure CORS proxy for external requests
$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
    if (options.url.match(/^https?:/)) {
        if (!options.headers) {
            options.headers = {};
        }
        options.headers['X-Proxy-URL'] = options.url;
        options.url = '/src/proxy.php';
    }
});

/**
 * Initialize the application when DOM is ready
 */
$(document).ready(function() {
    $('#form').submit(function(e) {
        e.preventDefault();
        handleFormSubmission();
    });
});

/**
 * Handle form submission and initialize data loading
 */
function handleFormSubmission() {
    showLoader();
    
    // Update state with form values
    const username = $("#username").val();
    const numberToLoad = $("#numbertoload").val();
    const loadAllCollection = $("#loadallprofile").is(":checked");
    
    stateManager.update({
        username: username,
        offset: 0,
        currentPage: 0,
        products: [],
        total: 0,
        isLoading: true
    });
    
    // Clear previous data
    moviesDiary = [CONFIG.CSV.DIARY_COLUMNS];
    movieWatchlist = [CONFIG.CSV.WISHLIST_COLUMNS];
    
    // Update UI
    updateUIForDataLoading(username);
    
    // Start loading data
    const itemsPerLoad = loadAllCollection ? CONFIG.API.DEFAULT_LIMIT : parseInt(numberToLoad);
    loadNewPageFromQueryData(itemsPerLoad, loadAllCollection);
}

/**
 * Update UI elements when starting data loading
 */
function updateUIForDataLoading(username) {
    document.querySelector('#welcome-explainer').innerHTML = "";
    document.getElementById("posterlist").innerHTML = "";
    document.getElementById("submit").style.display = 'none';
    document.querySelector('#usernameinputgroup').innerHTML = "";
    document.querySelector('#numberinputgroup').innerHTML = 
        `<div id='useravatar'></div><h3 style='margin-top: 0px; margin-bottom: 0px;'>Le SensCritique de ${username}</h3>`;
    
    // Hide bento boxes when loading starts
    const bentoContainer = document.querySelector('.bento-container');
    if (bentoContainer) {
        bentoContainer.style.display = 'none';
    }
}

/**
 * Load data from SensCritique API
 */
async function loadNewPageFromQueryData(numberToLoad, loadAllCollection = false) {
    const queryData = defineQueryData(stateManager.get('username'), numberToLoad);
    
    console.log('=== AJAX REQUEST DEBUG ===');
    console.log('Query data being sent:', queryData);
    console.log('Target URL:', CONFIG.API.URL);
    console.log('Headers:', CONFIG.HEADERS);
    console.log('Data size:', JSON.stringify(queryData).length, 'characters');
    console.log('=============================');
    
    try {
        const data = await $.ajax({
            url: CONFIG.API.URL,
            type: "POST",
            data: JSON.stringify(queryData),
            dataType: "json",
            contentType: CONFIG.HEADERS.CONTENT_TYPE,
            headers: {
                'authorization': CONFIG.API.AUTHORIZATION,
                'User-Agent': CONFIG.HEADERS.USER_AGENT,
                'Accept': CONFIG.HEADERS.ACCEPT,
                'Referer': CONFIG.HEADERS.REFERER,
                'Origin': CONFIG.HEADERS.ORIGIN
            }
        });
        
        console.log('✅ Response received:', data);
        await handleApiResponse(data, numberToLoad, loadAllCollection);
        
    } catch (error) {
        handleApiError(error);
    }
}

/**
 * Handle successful API response
 */
async function handleApiResponse(data, numberToLoad, loadAllCollection) {
    if (data.data.user == null) {
        showSnackbar(CONFIG.MESSAGES.FR.PROFILE_ERROR);
        hideLoader();
        return;
    }
    
    // Update user avatar if not already shown
    if ($('#useravatar > *').length == 0) {
        const avatarImg = `<img id='profileavatar' height='50' width='50' alt='profileavatar' src='${data.data.user.medias.avatar}'></img>`;
        $(avatarImg).appendTo("#useravatar");
    }
    
    // Update total count on first load
    if (stateManager.get('total') === 0) {
        stateManager.set('total', data.data.user.collection.total);
    }
    
    // Process movies
    const movies = data.data.user.collection.products;
    let movieCount = 0;
    let otherUniverseCount = 0;
    
    movies.forEach(element => {
        if (element.universe === CONFIG.CONSTANTS.MOVIE_UNIVERSE_ID) {
            extractDataFromElement(element);
            movieCount++;
        } else {
            otherUniverseCount++;
        }
    });
    
    if (otherUniverseCount > 0) {
        showSnackbar(CONFIG.MESSAGES.FR.OTHER_UNIVERSE_WARNING);
    }
    
    // Update state
    stateManager.addProducts(movies.filter(m => m.universe === CONFIG.CONSTANTS.MOVIE_UNIVERSE_ID));
    stateManager.incrementPage();
    
    // UI updates
    autoScroll();
    hideLoader();
    showExportButton();
    
    // Continue loading if needed
    if (loadAllCollection && stateManager.hasMoreProducts()) {
        stateManager.incrementOffset(numberToLoad);
        await loadNewPageFromQueryData(numberToLoad, loadAllCollection);
    }
}

/**
 * Handle API errors
 */
function handleApiError(error) {
    console.error('❌ AJAX Error:', error);
    console.log('Error details:', {
        readyState: error.readyState,
        status: error.status,
        statusText: error.statusText,
        responseText: error.responseText
    });
    
    showSnackbar(CONFIG.MESSAGES.FR.AJAX_ERROR);
    hideLoader();
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
 * Extract and process movie data from API response element
 */
function extractDataFromElement(element) {
    const title = extractTitle(element);
    if (!title) return;
    
    const year = extractYear(element);
    const directors = extractDirectors(element);
    const rating = element.otherUserInfos.rating;
    const watchedDate = extractWatchedDate(element);
    const isWishlist = element.otherUserInfos.isWished;
    const isDone = element.otherUserInfos.isDone;
    const url = CONFIG.API.BASE_URL + element.url;
    const imgUrl = element.medias.picture;
    
    addMovieToCollections(title, year, directors, rating, watchedDate, isWishlist, isDone);
    drawNewMovie(url, imgUrl, title, year, rating, watchedDate, isWishlist);
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
 * Extract directors from element with error handling
 */
function extractDirectors(element) {
    try {
        return '"' + element.directors[0].name + '"';
    } catch (e) {
        return "";
    }
}

/**
 * Extract watched date from element with error handling
 */
function extractWatchedDate(element) {
    try {
        return element.otherUserInfos.dateDone.substring(0, 10);
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
 * Add movie to appropriate collections (diary/wishlist)
 */
function addMovieToCollections(title, year, directors, rating, watchedDate, isWishlist, isDone) {
    // Clean special characters for CSV compatibility
    const titleCleaned = title.replace(CONFIG.CSV.REGEX_CHAR_TO_REMOVE, '');
    const directorsCleaned = directors.replace(CONFIG.CSV.REGEX_CHAR_TO_REMOVE, '');
    const yearInt = parseInt(year);
    const ratingInt = parseInt(rating);
    
    if (isDone === true) {
        console.log("✅ Ajouté au journal     ➡️ " + title);
        moviesDiary.push([titleCleaned, yearInt, directorsCleaned, ratingInt, watchedDate]);
    }
    
    if (isWishlist === true) {
        movieWatchlist.push([titleCleaned, yearInt, directorsCleaned]);
        console.log("📝 Ajouté à la Watchlist ➡️ " + title);
    }
}

/**
 * Export diary to CSV file
 */
function exportDiary() {
    const exportBox = document.querySelector('#export-info-box');
    exportBox.className = CONFIG.CONSTANTS.EXPORT_INFO_BOX_SHOW_CLASS;
    exportBox.innerHTML = `
        <h2>Au top !</h2>
        <video width='320' height='240' controls autoplay>
            <source src='./video/fantasticmrfox_whistle.mp4' type='video/mp4'>
            Your browser does not support the video tag.
        </video>
        <p>Tu viens de télécharger le fichier .CSV contenant tous les films marqués en vert sur ton écran.</p>
        <p>Pour importer tes films sur Letterboxd, il te suffit maintenant d'<a target='_blank' rel='noopener noreferrer' href='https://letterboxd.com/import/'><strong>aller sur la page d'importation</strong></a> et de sélectionner le .CSV téléchargé !</p>
        <p>Il est également posible d'importer ta liste d'envies sur Letterboxd (films marqués en bleu sur ton écran). Il faut à ce moment aller sur https://letterboxd.com/TONPROFIL/watchlist/, et importer le CSV dispo ci-dessous.</p>
        <button onclick='exportWishlist()'>Exporter ma liste d'envies.</button>
        <button onclick='hideExportInfoBox()'>Fermer</button>
    `;
    
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const filename = `${date} Export de la Collection SensCritique de ${stateManager.get('username')}.csv`;
    exportToCsv(filename, moviesDiary);
}

/**
 * Export wishlist to CSV file
 */
function exportWishlist() {
    const today = new Date();
    const date = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
    const filename = `${date} Export de la Watchlist SensCritique de ${stateManager.get('username')}.csv`;
    exportToCsv(filename, movieWatchlist);
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
    if (CONFIG.UI.AUTO_SCROLL) {
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
 * Draw new movie poster in the UI
 */
function drawNewMovie(scUrl, imgUrl, name, year, rating, date, isWishlist) {
    const img = document.createElement("img");
    img.src = imgUrl;
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
 * Hide loading indicator
 */
function hideLoader() {
    loader.style.display = 'none';
    stateManager.set('isLoading', false);
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
    exportButton.style.opacity = 1;
}

/**
 * Hide export info box
 */
function hideExportInfoBox() {
    document.querySelector('#export-info-box').classList = "";
}