/**
 * Odstráni spätné hrany z parent -> children mapy, aby rekurzívny layout
 * nespadol na "Maximum call stack size exceeded" pri cykloch
 * (napr. sekcia priradená pod člena / potomka tej istej sekcie).
 */
export function stripHierarchyCycles(map: Map<string, string[]>): Map<string, string[]> {
  const cleaned = new Map<string, string[]>();
  const visiting = new Set<string>();
  const done = new Set<string>();

  function dfs(id: string) {
    if (done.has(id)) return;
    visiting.add(id);
    const kids = map.get(id) ?? [];
    const kept: string[] = [];
    for (const kid of kids) {
      if (kid === id || visiting.has(kid)) continue;
      kept.push(kid);
      if (!done.has(kid)) dfs(kid);
    }
    cleaned.set(id, kept);
    visiting.delete(id);
    done.add(id);
  }

  const ids = new Set<string>();
  map.forEach((kids, parent) => {
    ids.add(parent);
    kids.forEach((kid) => ids.add(kid));
  });
  for (const id of ids) {
    if (!done.has(id)) dfs(id);
  }
  return cleaned;
}

/** Uzol a všetci dosiahnuteľní potomkovia (vrátane rootId). Odolné voči cyklom. */
export function collectReachable(rootId: string, childrenMap: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const kids = childrenMap.get(id);
    if (kids) {
      for (const kid of kids) stack.push(kid);
    }
  }
  return out;
}
