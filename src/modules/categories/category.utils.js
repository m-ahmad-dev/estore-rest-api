import CategoryModel from "./category.model.js";

// Depth-first search to detect circular references.
export async function isDescendant(rootId, targetId, client) {
  const children = await CategoryModel.findChild(rootId, client);

  for (const child of children) {
    if (
      child.id === targetId ||
      (await isDescendant(child.id, targetId, client))
    )
      return true;
  }
  return false;
}

// Find ancestors of a category:
export async function getAncestors(parentId, client) {
  const ancestors = [];
  let currentId = parentId;

  // Walk bottom-up, collecting all ancestors
  while (currentId !== null) {
    const categ = await CategoryModel.findById(currentId, client);
    if (!categ) break;

    ancestors.unshift({
      id: categ.id,
      name: categ.name,
      slug: categ.slug,
    });

    currentId = categ.parent_id;
  }
  
  return ancestors.map((ancestor, index) => ({
    ...ancestor,
    level: index,
  }));
}
