/** Only the latest list request started after the last mutation may publish. */
export function createListRequestGuard(accountId: string | undefined, currentAccount: () => string | undefined) {
  let revision = 0;
  let foreground = 0;
  return {
    begin() { return ++revision; },
    beginForeground() { return ++foreground; },
    isLatestForeground(request: number) { return request === foreground; },
    invalidate() { revision++; },
    isCurrent(request: number) { return !!accountId && currentAccount() === accountId && request === revision; },
  };
}
