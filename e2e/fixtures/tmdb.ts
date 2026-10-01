/** Canned TMDB responses for the smoke tests. Shapes match `src/lib/tmdb-types.ts`. */

const movie = (id: number, title: string, year: number, genres: number[], lang = 'hi') => ({
  id,
  title,
  original_title: title,
  release_date: `${year}-06-01`,
  poster_path: null,
  backdrop_path: null,
  overview: `${title} overview.`,
  vote_average: 7.5,
  vote_count: 900,
  original_language: lang,
  popularity: 40,
  genre_ids: genres,
});

export const ddljDetail = {
  id: 19404,
  title: 'Dilwale Dulhania Le Jayenge',
  original_title: 'दिलवाले दुल्हनिया ले जायेंगे',
  release_date: '1995-10-20',
  poster_path: null,
  backdrop_path: '/ddlj-backdrop.jpg',
  overview:
    'Raj and Simran meet on a trip across Europe and fall in love. Her father has already promised her to his friend’s son.',
  vote_average: 8.5,
  vote_count: 4400,
  original_language: 'hi',
  popularity: 30,
  genres: [
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 10749, name: 'Romance' },
  ],
  runtime: 190,
  tagline: 'Come fall in love, all over again.',
  status: 'Released',
  imdb_id: 'tt0112870',
  credits: {
    cast: [
      {
        id: 35742,
        name: 'Shah Rukh Khan',
        character: 'Raj Malhotra',
        profile_path: null,
        order: 0,
      },
      { id: 35776, name: 'Kajol', character: 'Simran Singh', profile_path: null, order: 1 },
      { id: 35780, name: 'Amrish Puri', character: 'Baldev Singh', profile_path: null, order: 2 },
    ],
    crew: [{ id: 35783, name: 'Aditya Chopra', job: 'Director', department: 'Directing' }],
  },
  videos: {
    results: [
      {
        key: 'trailer-key',
        name: 'Official Trailer',
        site: 'YouTube',
        type: 'Trailer',
        official: true,
        published_at: '2015-01-01T00:00:00.000Z',
      },
    ],
  },
  recommendations: {
    page: 1,
    total_pages: 1,
    total_results: 2,
    results: [
      movie(11854, 'Kuch Kuch Hota Hai', 1998, [35, 18]),
      movie(10757, 'Kabhi Khushi Kabhie Gham', 2001, [35, 18]),
    ],
  },
  external_ids: { imdb_id: 'tt0112870' },
  'watch/providers': {
    results: {
      IN: {
        link: 'https://www.themoviedb.org/movie/19404/watch?locale=IN',
        flatrate: [
          {
            provider_id: 8,
            provider_name: 'Netflix',
            logo_path: '/netflix.png',
            display_priority: 0,
          },
        ],
        rent: [
          {
            provider_id: 2,
            provider_name: 'Apple TV Store',
            logo_path: '/apple.png',
            display_priority: 5,
          },
          {
            provider_id: 3,
            provider_name: 'Google Play Movies',
            logo_path: '/google.png',
            display_priority: 8,
          },
          {
            provider_id: 192,
            provider_name: 'YouTube',
            logo_path: '/youtube.png',
            display_priority: 11,
          },
        ],
        buy: [
          {
            provider_id: 2,
            provider_name: 'Apple TV Store',
            logo_path: '/apple.png',
            display_priority: 5,
          },
          {
            provider_id: 3,
            provider_name: 'Google Play Movies',
            logo_path: '/google.png',
            display_priority: 8,
          },
          {
            provider_id: 192,
            provider_name: 'YouTube',
            logo_path: '/youtube.png',
            display_priority: 11,
          },
        ],
      },
      // A second region with listings, so the region select appears.
      GB: {
        link: 'https://www.themoviedb.org/movie/19404/watch?locale=GB',
        flatrate: [
          {
            provider_id: 8,
            provider_name: 'Netflix',
            logo_path: '/netflix.png',
            display_priority: 0,
          },
        ],
      },
    },
  },
};

/** The standalone `/movie/{id}/watch/providers` response — same data as the append above, used
 * by search's per-result lookups (docs/phase-2-plan.md §3.5). */
export const ddljProvidersOnly = {
  id: 19404,
  results: ddljDetail['watch/providers'].results,
};

/** Panchayat (tv 9001 in the catalog fixtures): Prime Video appears in both `flatrate` and its
 * "with Ads" variant, per the real response documented in docs/phase-2-plan.md §2.1. */
export const panchayatProviders = {
  id: 9001,
  results: {
    IN: {
      link: 'https://www.themoviedb.org/tv/9001/watch?locale=IN',
      flatrate: [
        {
          provider_id: 119,
          provider_name: 'Amazon Prime Video',
          logo_path: '/prime.png',
          display_priority: 1,
        },
        {
          provider_id: 2100,
          provider_name: 'Amazon Prime Video with Ads',
          logo_path: '/prime.png',
          display_priority: 71,
        },
      ],
      free: [
        {
          provider_id: 119,
          provider_name: 'Amazon Prime Video',
          logo_path: '/prime.png',
          display_priority: 1,
        },
      ],
    },
  },
};

export const tenetSearch = {
  page: 1,
  total_pages: 1,
  total_results: 2,
  results: [
    { ...movie(577922, 'Tenet', 2020, [28, 53, 878], 'en'), media_type: 'movie' },
    {
      media_type: 'person',
      id: 525,
      name: 'Christopher Nolan',
      known_for_department: 'Directing',
      profile_path: null,
      known_for: [{ ...movie(27205, 'Inception', 2010, [28, 878], 'en'), media_type: 'movie' }],
    },
  ],
};

export const comedyDiscover = {
  page: 1,
  total_pages: 3,
  total_results: 54,
  results: [
    movie(20453, '3 Idiots', 2009, [35, 18]),
    movie(19404, 'Dilwale Dulhania Le Jayenge', 1995, [35, 18, 10749]),
    movie(9004, 'Andaz Apna Apna', 1994, [35]),
  ],
};

export const emptyPage = { page: 1, total_pages: 0, total_results: 0, results: [] };
