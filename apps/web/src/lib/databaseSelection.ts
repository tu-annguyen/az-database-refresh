export function updateDatabaseSelection(
  selectedIds: ReadonlySet<string>,
  orderedVisibleIds: string[],
  anchorId: string | null,
  clickedId: string,
  checked: boolean,
  shiftKey: boolean
): Set<string> {
  const next = new Set(selectedIds);
  const anchorIndex = anchorId ? orderedVisibleIds.indexOf(anchorId) : -1;
  const clickedIndex = orderedVisibleIds.indexOf(clickedId);

  if (shiftKey && anchorIndex >= 0 && clickedIndex >= 0) {
    const start = Math.min(anchorIndex, clickedIndex);
    const end = Math.max(anchorIndex, clickedIndex);
    for (const id of orderedVisibleIds.slice(start, end + 1)) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    return next;
  }

  if (checked) next.add(clickedId);
  else next.delete(clickedId);
  return next;
}
