// GitHub API Cache

// Cache a GitHub API response until its X-RateLimie-Reset time.
// If the cache expires but ratelimit is exhausted,
// return the cached object anyway.

function err(...args) {
  console.error(...args);
}

const API_CACHE = 'GitHubAPICache';

self.onfetch = function(event) {
  if (event.request.url.startsWith('https://api.github.com/')) {
    var url = event.request.url;
    event.respondWith(caches.open(API_CACHE).then(function(cache) {
      return cache.match(url).then(function (response) {
        if (response) {
          var expiry = response.headers.get('X-RateLimit-Reset') * 1000;
          if (Date.now() < expiry) {
            console.log('cache hit', url, 'ttl', expiry - Date.now());
            return response;
          }
          console.log('cache expiry', url);
        }
        return fetch(event.request).then(function (response) {
          console.log(response.headers.get('X-RateLimit-Remaining'));
          if (response.headers.get('X-RateLimit-Remaining') > 0) {
            console.log('caching response', url);
            cache.put(event.request, response.clone()).catch(err);
            return response;
          }
          console.log('cache miss and ratelimit exhausted!');
          return response;
        }).catch(err);
      });
    }).catch(err));
  } else {
    event.respondWith(fetch(event.request));
  }
};
