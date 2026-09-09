import { isSectionId } from "@/lib/org/hierarchy-settings";
import type { SectionGroup } from "@/lib/org/types";
import type { SectionMemberRow } from "@/lib/org/section-members-client";

/**
 * Ak z payloadu vypadnú sectionGroups, priradenia v overrides ostávajú.
 * Doplní chýbajúce sekcie, aby ľudia pod nimi znova boli viditeľní.
 */
export function mergeSectionGroupsWithOverrides(
  groups: SectionGroup[],
  members: SectionMemberRow[],
  childOrderByParent: Record<string, string[]>,
): SectionGroup[] {
  const byId = new Map<string, SectionGroup>();
  for (const group of groups) byId.set(group.id, { ...group });

  const parentFromOrder = new Map<string, string>();
  for (const [parent, kids] of Object.entries(childOrderByParent)) {
    if (!Array.isArray(kids)) continue;
    for (const kid of kids) {
      if (isSectionId(kid) && !parentFromOrder.has(kid)) parentFromOrder.set(kid, parent);
    }
  }

  const needed = new Set<string>();
  for (const member of members) {
    if (isSectionId(member.section_id)) needed.add(member.section_id);
  }
  for (const sectionId of parentFromOrder.keys()) needed.add(sectionId);

  const created: string[] = [];
  for (const id of needed) {
    const existing = byId.get(id);
    const inferredParent = parentFromOrder.get(id) ?? null;
    if (existing) {
      if (!existing.parentId && inferredParent) {
        byId.set(id, { ...existing, parentId: inferredParent });
      }
      continue;
    }
    created.push(id);
    byId.set(id, {
      id,
      name: "Sekcia",
      parentId: inferredParent,
    });
  }

  created.sort();
  created.forEach((id, index) => {
    const current = byId.get(id);
    if (current) byId.set(id, { ...current, name: `Sekcia ${index + 1}` });
  });

  return [...byId.values()];
}
