//jshint: jsx:true esnext:true

var repos = [];

try {
  repos = JSON.parse(localStorage.getItem('repo_list')) || [];
} catch (e) {
}

var state = {
  totals: {
    prs: 0,
    issues: 0,
    unassigned: 0
  },
  repos: []
};

var onStateChange = function () {};

function dispatch (event, data) {
  switch (event) {
    case 'ADD_REPO':
      repos.push(data.repo);
      localStorage.setItem('repo_list', JSON.stringify(repos));
      dispatch('LOAD_REPO', {repo: data.repo});
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
  getInitialState: function () {
    onStateChange = state => this.setState(state);
    return state;
  },
  render: function () {
    return (
      <article>
        <header></header>
        <BigNumbers totals={this.state.totals} />
        <DetailTable repos={this.state.repos} />
      </article>
    );
  }
});

var BigNumbers = React.createClass({
  render: function () {
    return (
      <section className="big-numbers">
        <div className="item">
          <div className="big-number">{this.props.totals.prs}</div>
          PRs
        </div>
        <div className="item">
          <div className="big-number">{this.props.totals.issues}</div>
          Issues
        </div>
        <div className="item">
          <div className="big-number">{this.props.totals.unassigned}</div>
          Unassigned
        </div>
      </section>
    );
  }
});

var DetailTable = React.createClass({
  onKeyPress: function (e) {
    if (e.key === 'Enter') {
      dispatch('ADD_REPO', {repo: e.target.value});
      e.target.value = '';
    }
  },
  render: function () {
    var sorted = this.props.repos.sort((a, b) => {
      return a.full_name < b.full_name ? -1 : 1;
    });
    return (
      <table>
        <thead>
          <tr>
            <th>Repository</th>
            <th>Issues</th>
            <th>Unassigned</th>
            <th>PRs</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(repo => <RepoRow repo={repo} />)}
          <tr className="add-repo">
            <td><input placeholder="user/repo" onKeyPress={this.onKeyPress}/></td>
          </tr>
        </tbody>
      </table>
    );
  }
});

var RepoRow = React.createClass({
  render: function () {
    var repo = this.props.repo;
    var unassigned = repo.unassigned || [];
    var prs = repo.prs || [];
    return (
      <tr>
        <td><Link url={repo.html_url} text={repo.full_name} /></td>
        <td><IssuesLink repo={repo} text={repo.open_issues_count} /></td>
        <td><UnassignedIssuesLink repo={repo} text={unassigned.length} /></td>
        <td><PRsLink repo={repo} text={prs.length} /></td>
      </tr>
    );
  }
});

var Link = React.createClass({
  render: function () {
    return (
      <a href={this.props.url} target="_blank">{this.props.text}</a>
    );
  }
});

var UnassignedIssuesLink = React.createClass({
  render: function () {
    var url = "https://github.com/" + this.props.repo.full_name + "/issues?utf8=✓&q=is%3Aissue+is%3Aopen+no%3Aassignee";
    return <Link url={url} text={this.props.text} />;
  }
});

var IssuesLink = React.createClass({
  render: function () {
    var url = "https://github.com/" + this.props.repo.full_name + "/issues";
    return <Link url={url} text={this.props.text} />;
  }
});

var PRsLink = React.createClass({
  render: function () {
    var url = "https://github.com/" + this.props.repo.full_name + "/pulls";
    return <Link url={url} text={this.props.text} />;
  }
});

ReactDOM.render(<App />, document.body);

function err(prefix) {
  return function (...args) {
    console.error(prefix, ...args);
  };
}

function fetchAll(url) {
  return new Promise(function (resolve, reject) {
    var result = []

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

var flatten = (arr) => arr.reduce((_, c) => _.concat(c), []);

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
  fetch('https://api.github.com/repos/' + name).then(r => r.json())
  .then(function (repo) {
    dispatch('REPO_LOADED', {repo: repo});

    var req = fetchAll(repo.issues_url.replace('{/number}','')).then(flatten)
    .then(function (items) {

      var issues = items.filter(i => !i.pull_request);
      var unassigned = issues.filter(i => !i.assignee);
      var prs = items.filter(i => i.pull_request);

      dispatch('ISSUES', {
        repo: repo.id,
        issues: issues,
        unassigned: unassigned,
        prs: prs
      });

      dispatch('TOTALS', {field: 'issues', count: issues.length});
      dispatch('TOTALS', {field: 'prs', count: prs.length});
      dispatch('TOTALS', {field: 'unassigned', count: unassigned.length});
    });
  }).catch(err('[api]'));
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
  .then(function () {
    repos.forEach(r => dispatch('LOAD_REPO', {repo: r}));
  }).catch(err('[sw]'));
}
