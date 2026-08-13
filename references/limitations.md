# API boundaries

- The script returns the current state exposed by the App Store Connect `appStoreVersions` resource.
- It does not know the exact time a version entered its current state.
- It does not persist observations, calculate waiting time, estimate approval time, or produce scheduled reports.
- Apple's public API does not expose App Review messages or the detailed rejection explanation.
- The script does not submit, cancel, release, edit, or otherwise modify App Store Connect data.
- API access is limited by the apps and role assigned to the team key or individual user.
