var columnsDiary = ["Title", "Year", "Directors", "Rating10", "WatchedDate"];
var columnsWishlist = ["Title", "Year", "Directors"];
MoviesDiary = [];
MoviesDiary.push(columnsDiary);
MovieWatchlist = [];
MovieWatchlist.push(columnsWishlist);

const loader = document.querySelector('#loader')
// const nextPageButton = document.querySelector("#nextpage");
const exportButton = document.querySelector("#export");
var snackbar = document.querySelector("#snackbar");

const params = {
    url: "https://apollo.senscritique.com/",
    baseUrl: "https://senscritique.com",
    autoScroll: true,
    message: {
        fr: {
            DiaryLoadSuccessfullPrefix: "Les éléments de la page ",
            DiaryLoadSuccessfullMiddle: " de votre ",
            DiaryLoadSuccessfullSuffix: " ont été chargés ✨",
            DiaryName: "journal",
            CollectionName: "collection",
            LoadingCSV: "👀 Génération du fichier CSV en cours...",
            Loading: [
                "⚙️ Ça mouline, ça mouline...",
                "🤖 Atta, je travaille...",
                "😌 Va boire un café mon coco...",
                "👇 Tire sur mon doigt en attendant...",
                "🐢 Laisse-moi 2 petites secondes..."
            ]
        }
    }
}


$(document).ready(function() {
    $('#form').submit(function(e) {

        // empêcher formulaire qui recharge la page
        e.preventDefault();
        showLoader();

        window.username = $("#username").val();
        window.numberToLoad = $("#numbertoload").val();
        window.offset = 0;
        if ($("#loadallprofile").is(":checked") == true) {
            window.loadallcollection = true;
            window.numberToLoad = 25;
        } else {
            window.loadallcollection = false;
        }
        document.querySelector('#welcome-explainer').innerHTML = "";
        document.getElementById("posterlist").innerHTML = "";
        document.getElementById("submit").style.display = 'none';
        document.querySelector('#usernameinputgroup').innerHTML = "";
        document.querySelector('#numberinputgroup').innerHTML = "<div id='useravatar'></div><h3 style='margin-top: 0px; margin-bottom: 0px;'>Le SensCritique de " + username + "</h3>";
        loadNewPageFromQueryData()
    });
});



async function loadNewPageFromQueryData() {
    var queryData = defineQueryData(window.username, window.numberToLoad);
    await $.ajax({
        url: params.url,
        type: "POST",
        data: queryData,
        dataType: "json",
        contentType: "application/json",
        success: function(data) {
            if (data[0].data.user == null) {
                showSnackbar("Nous n'avons pas pû récupérer ton profil. Est-il bien défini en public ?");
                hideLoader();
            } else {
                if($('#useravatar > *').length == 0) {
                    $("<img id='profileavatar' height='50' width='50' alt='profileavatar' src='" + data[0].data.user.medias.avatar + "'> </img>").appendTo("#useravatar");
                }
                var movies = data[0].data.user.collection.products;
                movies.forEach(element => {
                    if (element.universe == 1) {
                        extractDataFromElement(element);
                    } else {
                        showSnackbar("Des produits d'autres univers (séries/lives/jv) n'ont pas été chargées.");
                    }
                });
                autoScroll();
                hideLoader();
                // showNextPageButton();
                showExportButton();
                if(window.loadallcollection) {
                    window.offset = window.offset + window.numberToLoad;
                    loadNewPageFromQueryData();
                }
            }
        }
    });
}

function defineQueryData(username, numberToLoad) {

    return JSON.stringify([{
        operationName: "UserCollection",
        query: "query UserCollection($action: ProductAction, $categoryId: Int, $gameSystemId: Int, $genreId: Int, $isAgenda: Boolean, $keywords: String, $limit: Int, $month: Int, $offset: Int, $order: CollectionSort, $showTvAgenda: Boolean, $universe: String, $username: String!, $versus: Boolean, $year: Int, $yearDateDone: Int, $yearDateRelease: Int) {\n  user(username: $username) {\n    ...UserMinimal\n    ...ProfileStats\n    notificationSettings {\n      alertAgenda\n      __typename\n    }\n    collection(\n      action: $action\n      categoryId: $categoryId\n      gameSystemId: $gameSystemId\n      genreId: $genreId\n      isAgenda: $isAgenda\n      keywords: $keywords\n      limit: $limit\n      month: $month\n      offset: $offset\n      order: $order\n      showTvAgenda: $showTvAgenda\n      universe: $universe\n      versus: $versus\n      year: $year\n      yearDateDone: $yearDateDone\n      yearDateRelease: $yearDateRelease\n    ) {\n      total\n      filters {\n        action {\n          count\n          label\n          value\n          __typename\n        }\n        category {\n          count\n          label\n          value\n          __typename\n        }\n        gamesystem {\n          count\n          label\n          value\n          __typename\n        }\n        genre {\n          count\n          label\n          value\n          __typename\n        }\n        monthDateDone {\n          count\n          label\n          value\n          __typename\n        }\n        releaseDate {\n          count\n          label\n          value\n          __typename\n        }\n        universe {\n          count\n          label\n          value\n          __typename\n        }\n        yearDateDone {\n          count\n          label\n          value\n          __typename\n        }\n        __typename\n      }\n      products {\n        ...ProductMinimal\n        preloadedParentTvShow {\n          ...ProductMinimal\n          __typename\n        }\n        scoutsAverage {\n          average\n          count\n          __typename\n        }\n        currentUserInfos {\n          ...ProductUserInfos\n          __typename\n        }\n        otherUserInfos(username: $username) {\n          ...ProductUserInfos\n          lists {\n            id\n            label\n            listSubtype\n            url\n            __typename\n          }\n          review {\n            id\n            title\n            url\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      tvProducts {\n        infos {\n          channel {\n            id\n            label\n            __typename\n          }\n          showTimes {\n            id\n            dateEnd\n            dateStart\n            __typename\n          }\n          __typename\n        }\n        product {\n          ...ProductMinimal\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment UserMinimal on User {\n  ...UserNano\n  settings {\n    about\n    birthDate\n    country\n    dateLastSession\n    displayedName\n    email\n    firstName\n    gender\n    lastName\n    privacyName\n    privacyProfile\n    showAge\n    showProfileType\n    urlWebsite\n    username\n    zipCode\n    __typename\n  }\n  __typename\n}\n\nfragment UserNano on User {\n  following\n  id\n  isBlocked\n  isScout\n  name\n  reviewCount\n  url\n  username\n  medias {\n    avatar\n    backdrop\n    __typename\n  }\n  __typename\n}\n\nfragment ProductMinimal on Product {\n  ...ProductNano\n  channel\n  dateCreation\n  dateLastUpdate\n  dateRelease\n  dateReleaseEarlyAccess\n  dateReleaseJP\n  dateReleaseOriginal\n  dateReleaseUS\n  displayedYear\n  duration\n  episodeNumber\n  frenchReleaseDate\n  listCount\n  numberOfEpisodes\n  numberOfSeasons\n  originalRun\n  originalTitle\n  parentTvShowId\n  productionStatus\n  retailReleaseDate\n  seasonId\n  seasonNumber\n  subtitle\n  synopsis\n  url\n  actors {\n    name\n    person_id\n    url\n    __typename\n  }\n  artists {\n    name\n    person_id\n    url\n    __typename\n  }\n  authors {\n    name\n    person_id\n    url\n    __typename\n  }\n  tvChannel {\n    name\n    url\n    __typename\n  }\n  countries {\n    id\n    name\n    __typename\n  }\n  creators {\n    name\n    person_id\n    url\n    __typename\n  }\n  developers {\n    name\n    person_id\n    url\n    __typename\n  }\n  directors {\n    name\n    person_id\n    url\n    __typename\n  }\n  distributors {\n    name\n    person_id\n    url\n    __typename\n  }\n  franchises {\n    id\n    label\n    slug\n    url\n    __typename\n  }\n  gameSystems {\n    id\n    label\n    __typename\n  }\n  genresInfos {\n    id\n    label\n    slug\n    url\n    __typename\n  }\n  illustrators {\n    name\n    person_id\n    url\n    __typename\n  }\n  isbn\n  medias(backdropSize: \"1200\") {\n    randomBackdrop\n    backdrop\n    picture\n    screenshot\n    videos {\n      id\n      image\n      provider\n      type\n      __typename\n    }\n    __typename\n  }\n  musicLabels {\n    name\n    person_id\n    url\n    __typename\n  }\n  pencillers {\n    name\n    person_id\n    url\n    __typename\n  }\n  producers {\n    name\n    person_id\n    url\n    __typename\n  }\n  publishers {\n    name\n    person_id\n    url\n    __typename\n  }\n  soundtracks {\n    id\n    title\n    url\n    __typename\n  }\n  stats {\n    currentCount\n    ratingCount\n    recommendCount\n    reviewCount\n    wishCount\n    __typename\n  }\n  translators {\n    name\n    person_id\n    url\n    __typename\n  }\n  __typename\n}\n\nfragment ProductNano on Product {\n  id\n  rating\n  title\n  universe\n  url\n  yearOfProduction\n  medias(backdropSize: \"1200\") {\n    backdrop\n    picture\n    screenshot\n    __typename\n  }\n  __typename\n}\n\nfragment ProductUserInfos on ProductUserInfos {\n  dateDone\n  hasStartedReview\n  isCurrent\n  id\n  isDone\n  isListed\n  isRecommended\n  isRejected\n  isReviewed\n  isWished\n  productId\n  rating\n  userId\n  gameSystem {\n    id\n    label\n    __typename\n  }\n  lastEpisodeDone {\n    id\n    episodeNumber\n    __typename\n  }\n  review {\n    url\n    __typename\n  }\n  __typename\n}\n\nfragment ProfileStats on User {\n  likePositiveCountStats {\n    contact\n    feed\n    list\n    paramIndex\n    review\n    total\n    __typename\n  }\n  stats {\n    collectionCount\n    diaryCount\n    listCount\n    followerCount\n    ratingCount\n    reviewCount\n    scoutCount\n    __typename\n  }\n  __typename\n}\n",
        variables: {
            action: null,
            categoryId: null,
            gameSystemId: null,
            genreId: null,
            keywords: null,
            limit: parseInt(numberToLoad),
            offset: window.offset,
            order: "LAST_ACTION_DESC",
            universe: null,
            username: username,
            yearDateDone: null,
            yearDateRelease: null
        }
    }])
}

function extractDataFromElement(element) {

    if (element.originalTitle !== null) {
        var Title = '"' + element.originalTitle + '"';
    } else if (element.title !== null) {
        var Title = '"' + element.title + '"';
    } else return

    if (element.dateRelease !== null) {
        var Year = convertDateInYear(element.dateRelease);
    } else if (element.yearOfProduction !== null) {
        var Year = element.yearOfProduction;
    } else if (element.frenchReleaseDate !== null) {
        var Year = convertDateInYear(element.frenchReleaseDate);
    } else {
        var Year = null;
    }


    try {
        var Directors = '"' + element.directors[0].name + '"';
    } catch (e) {
        var Directors = "";
    }

    var Rating10 = element.otherUserInfos.rating;

    try {
        var WatchedDate = element.otherUserInfos.dateDone.substring(0, 10);
    } catch (e) {
        var WatchedDate = "";
    }

    var Watchlist = element.otherUserInfos.isWished;

    var isDone = element.otherUserInfos.isDone;

    var url = params.baseUrl + element.url;

    var imgUrl = element.medias.picture;

    addMovieToJson(Title, Year, Directors, Rating10, WatchedDate, Watchlist, isDone);
    drawNewMovie(url, imgUrl, Title, Year, Rating10, WatchedDate, Watchlist);


}

function convertDateInYear(string) {
    var year = string.substring(0, 4)
    return year;
}

function addMovieToJson(Title, Year, Directors, Rating10, WatchedDate, Watchlist, isDone) {

    if (isDone == true) {
        MoviesDiary.push([Title, Year, Directors, Rating10, WatchedDate]);
        console.log("✅ Ajouté au journal     ➡️ " + Title);
    }

    if (Watchlist == true) {
        MovieWatchlist.push([Title, Year, Directors]);
        console.log("📝 Ajouté à la Watchlist ➡️ " + Title);
    }

}



function exportDiary() {
    document.querySelector('#export-info-box').className = "show";
    document.querySelector('#export-info-box').innerHTML = "<h2>Au top !</h2>" +
        "<p><iframe src='https://www.youtube.com/embed/xklW7hq2kqg?autoplay=1' width=500 height=200 frameborder=0></iframe></p>" +
        "<p>Tu viens de t&eacute;l&eacute;charger le fichier .CSV contenant tous les films marqu&eacute;s en vert sur ton &eacute;cran.</p>" +
        "<p>Pour importer tes films sur Letterboxd, il te suffit maintenant d'<a target='_blank' rel='noopener noreferrer' href='https://letterboxd.com/import/'><strong>aller sur la page d'importation</strong></a> et de s&eacute;l&eacute;ctionner le .CSV t&eacute;l&eacute;charg&eacute; !</p>" +
        "<p>Il est également posible d'importer ta liste d'envies sur Letterboxd (films marqués en bleu sur ton écran). Il faut à ce moment aller sur https://letterboxd.com/TONPROFIL/watchlist/, et importer le CSV dispo ci-dessous.</p>" +
        "<button onclick='exportWishlist()'>Exporter ma liste d'envies.</button>" +
        "<button onclick='hideExportInfoBox()'>Fermer</button>";
    var today = new Date();
    var date = today.getFullYear() + '.' + (today.getMonth() + 1) + '.' + today.getDate();
    var username = localStorage.getItem("username");
    exportToCsv(date + '_' + username + "_Diary.csv", MoviesDiary);
}

function exportWishlist() {
    var today = new Date();
    var date = today.getFullYear() + '.' + (today.getMonth() + 1) + '.' + today.getDate();
    var username = localStorage.getItem("username");
    exportToCsv(date + '_' + username + "_Wishlist.csv", MovieWatchlist);
}

function exportToCsv(filename, rows) {
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // Required for FF

    link.click(); // This will download the data file named "my_data.csv".

}



function autoScroll() {
    if (params.autoScroll) {
        setTimeout(function(){
            window.scrollBy({
                top: 3000,
                left: 0,
                behavior: "smooth"
            });
        }, 1000);
    }
}

function drawNewMovie(sc_url, imgUrl, name, annee, note, date, wishlist) {
    var img = document.createElement("img");
    img.src = imgUrl;
    img.className = "poster";
    img.title = name + " (" + annee + ") - Noté " + note + " le " + date.toString();
    img.href = sc_url;
    if (wishlist) {
        img.className = "wishlist poster"
    };
    var src = document.getElementById("posterlist");
    src.appendChild(img);
    setTimeout(() => img.classList.add("animate"), 1000);
}


function showLoader() {
    var randomMessage = params.message.fr.Loading[Math.floor(Math.random() * params.message.fr.Loading.length)];
    loader.innerHTML = randomMessage;
    loader.style.display = 'block';
}

function hideLoader() {
    loader.style.display = 'none';
}

function showSnackbar(message) {
    snackbar.innerHTML = message;
    snackbar.className = "show";

    setTimeout(function() {
        snackbar.className = snackbar.className.replace("show", "");
    }, 3000);
}

function showExportButton() {
    exportButton.style.opacity = 1;
}

function hideExportInfoBox() {
    document.querySelector('#export-info-box').classList = "";
}

/* function showNextPageButton() {
    nextPageButton.style.display = 'block';
}

function hideNextPageButton() {
    nextPageButton.style.display = 'none';
} */