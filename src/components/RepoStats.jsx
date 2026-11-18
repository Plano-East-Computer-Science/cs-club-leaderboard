/** Cached GitHub numbers for a project (D3). The server fetches them; the browser never calls GitHub. */
const ago = (iso) => {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30)} months ago` : `${Math.round(d / 365)} years ago`;
};

export default function RepoStats({ stats }) {
  if (!stats) return null;
  return (
    <p className="repo-stats">
      <span title="Stars on GitHub">{stats.stars} {stats.stars === 1 ? 'star' : 'stars'}</span>
      {stats.language && <span>{stats.language}</span>}
      {stats.pushed_at && <span>pushed {ago(stats.pushed_at)}</span>}
      <span>{stats.open_issues} open {stats.open_issues === 1 ? 'issue' : 'issues'}</span>
      {stats.stale && <b className="repo-stale">stale</b>}
    </p>
  );
}
