// Convert flat data to hierarchical tree structure:
export function toHierarchicalTree(items, rootId = null) {
  const lookup = new Map();
  const result = [];

  for (const item of items) {
    lookup.set(item.id, { ...item, children: [] });
  }

  // Build relationships (Parent-Child)
  for (const item of items) {
    const node = lookup.get(item.id);
    const parent = lookup.get(item.parent_id);

    if (item.parent_id === rootId) {
      result.push(node);
    } else if (parent) {
      parent.children.push(node);
    }
  }

  return result;
}
