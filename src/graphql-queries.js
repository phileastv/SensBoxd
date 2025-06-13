/**
 * GraphQL queries for SensCritique API
 */
const GRAPHQL_QUERIES = {
    USER_COLLECTION: `query UserCollection($action: ProductAction, $categoryId: Int, $gameSystemId: Int, $genreId: Int, $isAgenda: Boolean, $keywords: String, $limit: Int, $month: Int, $offset: Int, $order: CollectionSort, $showTvAgenda: Boolean, $universe: String, $username: String!, $versus: Boolean, $year: Int, $yearDateDone: Int, $yearDateRelease: Int) {
  user(username: $username) {
    ...UserMinimal
    ...ProfileStats
    notificationSettings {
      alertAgenda
      __typename
    }
    collection(
      action: $action
      categoryId: $categoryId
      gameSystemId: $gameSystemId
      genreId: $genreId
      isAgenda: $isAgenda
      keywords: $keywords
      limit: $limit
      month: $month
      offset: $offset
      order: $order
      showTvAgenda: $showTvAgenda
      universe: $universe
      versus: $versus
      year: $year
      yearDateDone: $yearDateDone
      yearDateRelease: $yearDateRelease
    ) {
      total
      filters {
        action {
          count
          label
          value
          __typename
        }
        category {
          count
          label
          value
          __typename
        }
        gamesystem {
          count
          label
          value
          __typename
        }
        genre {
          count
          label
          value
          __typename
        }
        monthDateDone {
          count
          label
          value
          __typename
        }
        releaseDate {
          count
          label
          value
          __typename
        }
        universe {
          count
          label
          value
          __typename
        }
        yearDateDone {
          count
          label
          value
          __typename
        }
        __typename
      }
      products {
        ...ProductList
        episodeNumber
        seasonNumber
        totalEpisodes
        preloadedParentTvShow {
          ...ProductList
          __typename
        }
        scoutsAverage {
          average
          count
          __typename
        }
        currentUserInfos {
          ...ProductUserInfos
          __typename
        }
        otherUserInfos(username: $username) {
          ...ProductUserInfos
          lists {
            id
            label
            listSubtype
            url
            __typename
          }
          review {
            id
            title
            url
            __typename
          }
          __typename
        }
        __typename
      }
      tvProducts {
        infos {
          channel {
            id
            label
            __typename
          }
          showTimes {
            id
            dateEnd
            dateStart
            __typename
          }
          __typename
        }
        product {
          ...ProductList
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment UserMinimal on User {
  ...UserNano
  dateCreation
  settings {
    about
    birthDate
    country
    dateLastSession
    displayedName
    email
    firstName
    gender
    lastName
    privacyName
    privacyProfile
    showAge
    showGender
    showProfileType
    urlWebsite
    username
    zipCode
    __typename
  }
  __typename
}

fragment UserNano on User {
  following
  hasBlockedMe
  id
  isBlocked
  isScout
  name
  url
  username
  medias {
    avatar
    backdrop
    __typename
  }
  __typename
}

fragment ProductList on Product {
  category
  channel
  dateRelease
  dateReleaseEarlyAccess
  dateReleaseJP
  dateReleaseOriginal
  dateReleaseUS
  displayedYear
  duration
  episodeNumber
  seasonNumber
  frenchReleaseDate
  id
  numberOfSeasons
  originalRun
  originalTitle
  rating
  slug
  subtitle
  title
  universe
  url
  yearOfProduction
  canalVOD {
    url
    __typename
  }
  tvChannel {
    name
    url
    __typename
  }
  countries {
    id
    name
    __typename
  }
  gameSystems {
    id
    label
    __typename
  }
  medias {
    picture
    __typename
  }
  genresInfos {
    label
    __typename
  }
  artists {
    name
    person_id
    url
    __typename
  }
  authors {
    name
    person_id
    url
    __typename
  }
  creators {
    name
    person_id
    url
    __typename
  }
  developers {
    name
    person_id
    url
    __typename
  }
  directors {
    name
    person_id
    url
    __typename
  }
  pencillers {
    name
    person_id
    url
    __typename
  }
  stats {
    ratingCount
    __typename
  }
  __typename
}

fragment ProductUserInfos on ProductUserInfos {
  dateDone
  hasStartedReview
  isCurrent
  id
  isDone
  isListed
  isRecommended
  isReviewed
  isWished
  productId
  rating
  userId
  numberEpisodeDone
  lastEpisodeDone {
    episodeNumber
    id
    season {
      seasonNumber
      id
      episodes {
        title
        id
        episodeNumber
        __typename
      }
      __typename
    }
    __typename
  }
  gameSystem {
    id
    label
    __typename
  }
  review {
    author {
      id
      name
      __typename
    }
    url
    __typename
  }
  __typename
}

fragment ProfileStats on User {
  likePositiveCountStats {
    contact
    feed
    list
    paramIndex
    review
    total
    __typename
  }
  stats {
    ...UserStatsData
    __typename
  }
  __typename
}

fragment UserStatsData on UserStats {
  collectionCount
  diaryCount
  listCount
  pollCount
  topCount
  followerCount
  ratingCount
  reviewCount
  scoutCount
  __typename
}`
}; 