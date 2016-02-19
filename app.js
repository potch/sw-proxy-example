'use strict';

//jshint: jsx:true esnext:true

var repos = [];

try {
  repos = JSON.parse(localStorage.getItem('repo_list')) || [];
} catch (e) {}

var state = {
  totals: {
    prs: 0,
    issues: 0,
    unassigned: 0
  },
  repos: []
};

var onStateChange = function onStateChange() {};

function dispatch(event, data) {
  switch (event) {
    case 'ADD_REPO':
      repos.push(data.repo);
      localStorage.setItem('repo_list', JSON.stringify(repos));
      dispatch('LOAD_REPO', { repo: data.repo });
      break;
    case 'LOAD_REPO':
      loadRepoData(data.repo);
      break;
    case 'REPO_LOADED':
      state.repos.push(data.repo);
      break;
    case 'ISSUES':
      state.repos.forEach(function (r) {
        if (r.id === data.repo) {
          r.issues = data.issues;
          r.prs = data.prs;
          r.unassigned = data.unassigned;
        }
      });
      break;
    case 'TOTALS':
      state.totals[data.field] += data.count;
      break;
  }
  onStateChange(state);
}

var App = React.createClass({
  displayName: 'App',

  getInitialState: function getInitialState() {
    var _this = this;

    onStateChange = function onStateChange(state) {
      return _this.setState(state);
    };
    return state;
  },
  render: function render() {
    return React.createElement(
      'article',
      null,
      React.createElement('header', null),
      React.createElement(BigNumbers, { totals: this.state.totals }),
      React.createElement(DetailTable, { repos: this.state.repos })
    );
  }
});

var BigNumbers = React.createClass({
  displayName: 'BigNumbers',

  render: function render() {
    return React.createElement(
      'section',
      { className: 'big-numbers' },
      React.createElement(
        'div',
        { className: 'item' },
        React.createElement(
          'div',
          { className: 'big-number' },
          this.props.totals.prs
        ),
        'PRs'
      ),
      React.createElement(
        'div',
        { className: 'item' },
        React.createElement(
          'div',
          { className: 'big-number' },
          this.props.totals.issues
        ),
        'Issues'
      ),
      React.createElement(
        'div',
        { className: 'item' },
        React.createElement(
          'div',
          { className: 'big-number' },
          this.props.totals.unassigned
        ),
        'Unassigned'
      )
    );
  }
});

var DetailTable = React.createClass({
  displayName: 'DetailTable',

  onKeyPress: function onKeyPress(e) {
    if (e.key === 'Enter') {
      dispatch('ADD_REPO', { repo: e.target.value });
      e.target.value = '';
    }
  },
  render: function render() {
    var sorted = this.props.repos.sort(function (a, b) {
      return a.full_name < b.full_name ? -1 : 1;
    });
    return React.createElement(
      'table',
      null,
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          React.createElement(
            'th',
            null,
            'Repository'
          ),
          React.createElement(
            'th',
            null,
            'Issues'
          ),
          React.createElement(
            'th',
            null,
            'Unassigned'
          ),
          React.createElement(
            'th',
            null,
            'PRs'
          )
        )
      ),
      React.createElement(
        'tbody',
        null,
        sorted.map(function (repo) {
          return React.createElement(RepoRow, { repo: repo });
        }),
        React.createElement(
          'tr',
          { className: 'add-repo' },
          React.createElement(
            'td',
            null,
            React.createElement('input', { placeholder: 'user/repo', onKeyPress: this.onKeyPress })
          )
        )
      )
    );
  }
});

var RepoRow = React.createClass({
  displayName: 'RepoRow',

  render: function render() {
    var repo = this.props.repo;
    var unassigned = repo.unassigned || [];
    var prs = repo.prs || [];
    return React.createElement(
      'tr',
      null,
      React.createElement(
        'td',
        null,
        React.createElement(Link, { url: repo.html_url, text: repo.full_name })
      ),
      React.createElement(
        'td',
        null,
        React.createElement(IssuesLink, { repo: repo, text: repo.open_issues_count })
      ),
      React.createElement(
        'td',
        null,
        React.createElement(UnassignedIssuesLink, { repo: repo, text: unassigned.length })
      ),
      React.createElement(
        'td',
        null,
        React.createElement(PRsLink, { repo: repo, text: prs.length })
      )
    );
  }
});

var Link = React.createClass({
  displayName: 'Link',

  render: function render() {
    return React.createElement(
      'a',
      { href: this.props.url, target: '_blank' },
      this.props.text
    );
  }
});

var UnassignedIssuesLink = React.createClass({
  displayName: 'UnassignedIssuesLink',

  render: function render() {
    var url = "https://github.com/" + this.props.repo.full_name + "/issues?utf8=✓&q=is%3Aissue+is%3Aopen+no%3Aassignee";
    return React.createElement(Link, { url: url, text: this.props.text });
  }
});

var IssuesLink = React.createClass({
  displayName: 'IssuesLink',

  render: function render() {
    var url = "https://github.com/" + this.props.repo.full_name + "/issues";
    return React.createElement(Link, { url: url, text: this.props.text });
  }
});

var PRsLink = React.createClass({
  displayName: 'PRsLink',

  render: function render() {
    var url = "https://github.com/" + this.props.repo.full_name + "/pulls";
    return React.createElement(Link, { url: url, text: this.props.text });
  }
});

ReactDOM.render(React.createElement(App, null), document.body);

function err(prefix) {
  return function () {
    var _console;

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    (_console = console).error.apply(_console, [prefix].concat(args));
  };
}

function fetchAll(url) {
  return new Promise(function (resolve, reject) {
    var result = [];

    function page(url) {
      fetch(url).then(function (r) {
        var next = parseLinks(r).next;
        r.json().then(function (o) {
          result.push(o);
          if (next) {
            page(next);
          } else {
            resolve(result);
          }
        });
      });
    }
    page(url);
  });
}

var flatten = function flatten(arr) {
  return arr.reduce(function (_, c) {
    return _.concat(c);
  }, []);
};

function parseLinks(r) {
  var o = {};
  var s = r.headers.get('Link') || '';
  var parts = s.split(',');
  parts.forEach(function (p) {
    var m = p.match(/<([^>]+)>; rel="([^"]+)"/);
    if (m) {
      o[m[2]] = m[1];
    }
  });
  return o;
}

function loadRepoData(name) {
  fetch('https://api.github.com/repos/' + name).then(function (r) {
    return r.json();
  }).then(function (repo) {
    dispatch('REPO_LOADED', { repo: repo });

    var req = fetchAll(repo.issues_url.replace('{/number}', '')).then(flatten).then(function (items) {

      var issues = items.filter(function (i) {
        return !i.pull_request;
      });
      var unassigned = issues.filter(function (i) {
        return !i.assignee;
      });
      var prs = items.filter(function (i) {
        return i.pull_request;
      });

      dispatch('ISSUES', {
        repo: repo.id,
        issues: issues,
        unassigned: unassigned,
        prs: prs
      });

      dispatch('TOTALS', { field: 'issues', count: issues.length });
      dispatch('TOTALS', { field: 'prs', count: prs.length });
      dispatch('TOTALS', { field: 'unassigned', count: unassigned.length });
    });
  }).catch(err('[api]'));
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').then(function () {
    repos.forEach(function (r) {
      return dispatch('LOAD_REPO', { repo: r });
    });
  }).catch(err('[sw]'));
}
