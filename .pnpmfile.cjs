// Installs from a private mirror (Google Artifact Registry) can record mirror-specific tarball
// URLs in pnpm-lock.yaml, which CI cannot reach. Dropping them makes pnpm derive the URL from
// whichever registry is configured; the integrity hash still pins the exact tarball.
function afterAllResolved(lockfile) {
  for (const pkg of Object.values(lockfile.packages ?? {})) {
    if (pkg.resolution?.tarball?.includes('.pkg.dev/')) delete pkg.resolution.tarball;
  }
  return lockfile;
}

module.exports = { hooks: { afterAllResolved } };
