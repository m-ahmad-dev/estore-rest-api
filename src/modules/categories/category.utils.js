import CategoryModel from "./category.model.js";

// Maximum allowed category nesting depth.
// Prevents runaway recursion if corrupt circular data reaches the DB.
const MAX_DEPTH = 20;

/**
 * Depth-first search to detect circular references in the category hierarchy.
 * Guards against infinite loops with a visited Set and a hard depth cap.
 *
 * @param {string} rootId    - The category whose subtree we are searching.
 * @param {string} targetId  - The ID we are looking for inside that subtree.
 * @param {object} client    - Prisma transaction client.
 * @param {Set}    visited   - Already-visited IDs (prevents re-traversal of shared nodes).
 * @param {number} depth     - Current recursion depth.
 * @returns {Promise<boolean>}
 */
export async function isDescendant(
  rootId,
  targetId,
  client,
  visited = new Set(),
  depth = 0,
) {
  if (depth > MAX_DEPTH || visited.has(rootId)) return false;
  visited.add(rootId);

  const children = await CategoryModel.findChild(rootId, client);

  for (const child of children) {
    if (child.id === targetId) return true;
    if (await isDescendant(child.id, targetId, client, visited, depth + 1))
      return true;
  }

  return false;
}

/**
 * Walks the ancestor chain bottom-up and returns an ordered array
 * from the root down to the immediate parent, each annotated with its level.
 *
 * @param {string} parentId - ID of the direct parent to start from.
 * @param {object} client   - Prisma transaction client.
 * @returns {Promise<Array<{ id, name, slug, level }>>}
 */
export async function getAncestors(parentId, client) {
  const ancestors = [];
  let currentId = parentId;
  let safetyCounter = 0;

  while (currentId !== null && safetyCounter < MAX_DEPTH) {
    safetyCounter++;
    const categ = await CategoryModel.findById(currentId, client);
    if (!categ) break;

    ancestors.unshift({ id: categ.id, name: categ.name, slug: categ.slug });
    currentId = categ.parent_id;
  }

  return ancestors.map((ancestor, index) => ({ ...ancestor, level: index }));
}

/**
 * Merges two arrays of attribute rules by their `name` key.
 * Child rules take precedence over parent rules with the same name,
 * allowing child categories to override inherited definitions.
 *
 * @param {Array} childRules
 * @param {Array} parentRules
 * @returns {Array}
 */
function mergeRules(childRules = [], parentRules = []) {
  const map = new Map();
  parentRules.forEach((r) => map.set(r.name, r));
  childRules.forEach((r) => map.set(r.name, r));
  return Array.from(map.values());
}

/**
 * Recursively collects and merges attribute rules from root down to the
 * given category, so the result represents the full effective schema.
 *
 * @param {string} categoryId - The category whose effective attributes we need.
 * @param {object} client     - Prisma transaction client.
 * @param {number} depth      - Internal recursion guard.
 * @returns {Promise<Array>}
 */
export async function getInheritedAttributes(categoryId, client, depth = 0) {
  if (depth > MAX_DEPTH) return [];

  const category = await CategoryModel.findById(categoryId, client);
  if (!category) return [];

  const parentRules = category.parent_id
    ? await getInheritedAttributes(category.parent_id, client, depth + 1)
    : [];

  const currentRules = Array.isArray(category.attribute_rules)
    ? category.attribute_rules
    : [];

  return mergeRules(currentRules, parentRules);
}

/**
 * Returns true if the given category has at least one product assigned to it.
 * Used as a safety gate before destructive mutations.
 *
 * @param {string} categoryId
 * @param {object} client - Prisma transaction client.
 * @returns {Promise<boolean>}
 */
export async function checkInUse(categoryId, client) {
  const count = await client.products.count({
    where: { category_id: categoryId },
  });
  return count > 0;
}
