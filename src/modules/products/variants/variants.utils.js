import crypto from 'crypto';
import VariantModel from './variants.model.js';
import AppError from '../../../core/utils/error.utils.js';
import { getCategoryLineage } from '../../categories/category.service.js';

const DEFAULT_REORDER_LEVEL = 5;
const SKU_MAX_LENGTH = 64;
const ProductErrorCode = {
  INVALID_ATTRIBUTES: 'PRODUCT_INVALID_ATTRIBUTES',
  DUPLICATE_VARIANT: 'PRODUCT_DUPLICATE_VARIANT',
};

// Normalize attributes for deterministic hashing/comparison:
const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalize(value[key]);
        return acc;
      }, {});
  }
  return value;
};

// Generate deterministic hash for attribute combination:
const generateAttributesHash = (attributes) => {
  const normalized = normalize(attributes);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
};

// Generate SKU with length safety:
const generateSku = (productId, normalizedAttrs) => {
  const attrPart = Object.values(normalizedAttrs)
    .map((value) =>
      value === null
        ? ''
        : String(value)
            .toUpperCase()
            .trim()
            .replace(/[^A-Z0-9]/g, '')
    )
    .filter(Boolean)
    .join('-');

  let sku = `${productId.slice(0, 8)}-${attrPart}`;

  if (sku.length > SKU_MAX_LENGTH) {
    const hashSuffix = crypto
      .createHash('md5')
      .update(sku)
      .digest('hex')
      .slice(0, 12);
    sku = `${sku.substring(0, 50)}-${hashSuffix}`;
  }

  return sku;
};

// Get merged attribute rules from category hierarchy (child overrides parent):
export async function getEffectiveAttributeRules(categoryId, client) {
  if (!categoryId) return [];

  const lineage = await getCategoryLineage(categoryId, client);
  if (!lineage?.length) return [];

  const rulesMap = new Map();
  for (const cat of lineage) {
    const rules = Array.isArray(cat.attribute_rules) ? cat.attribute_rules : [];
    for (const rule of rules) {
      if (rule?.name) {
        rulesMap.set(rule.name, { ...rule });
      }
    }
  }
  return Array.from(rulesMap.values());
}

// Validate attributes against rules:
export function validateAttributesWithRules(attributes, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return;

  if (
    !attributes ||
    typeof attributes !== 'object' ||
    Array.isArray(attributes)
  ) {
    throw AppError.badRequest('Attributes must be a valid object', {
      errorCode: ProductErrorCode.INVALID_ATTRIBUTES,
    });
  }

  const allowed = new Set(rules.map((r) => r.name).filter(Boolean));

  for (const key of Object.keys(attributes)) {
    if (!allowed.has(key)) {
      throw AppError.badRequest(`Unknown attribute "${key}" not allowed`, {
        errorCode: ProductErrorCode.INVALID_ATTRIBUTES,
        allowed: Array.from(allowed),
      });
    }
  }

  for (const rule of rules) {
    if (!rule?.name) continue;

    const value = attributes[rule.name];
    const hasValue =
      value !== undefined &&
      value !== null &&
      (typeof value !== 'string' || value.trim() !== '');

    if (rule.required && !hasValue) {
      throw AppError.badRequest(`Missing required attribute "${rule.name}"`, {
        errorCode: ProductErrorCode.INVALID_ATTRIBUTES,
        attribute: rule.name,
      });
    }

    if (!hasValue) continue;

    if (rule.type === 'enum' && Array.isArray(rule.options)) {
      const strValue = String(value).trim();
      if (!rule.options.includes(strValue)) {
        throw AppError.badRequest(
          `Invalid value for attribute "${rule.name}"`,
          {
            errorCode: ProductErrorCode.INVALID_ATTRIBUTES,
            attribute: rule.name,
            allowedValues: rule.options,
          }
        );
      }
    }
  }
}

function validateVariantBusinessRules(variant) {
  if ((variant.price ?? 0) < 0) {
    throw AppError.badRequest('Price cannot be negative');
  }
  if ((variant.stock_quantity ?? 0) < 0) {
    throw AppError.badRequest('Stock quantity cannot be negative');
  }
  if ((variant.reserved_quantity ?? 0) > (variant.stock_quantity ?? 0)) {
    throw AppError.badRequest('Reserved quantity cannot exceed stock quantity');
  }
}

export const validateUniqueVariantAttributes = (variants, helpers) => {
  const seen = new Set();

  for (const variant of variants) {
    const hash = JSON.stringify(normalize(variant.attributes));

    if (seen.has(hash)) return helpers.error('array.unique');
    seen.add(hash);
  }

  return variants;
};

export const validateReservedStock = (value, helpers) => {
  if (value.reserved_quantity > value.stock_quantity) {
    return helpers.error('any.invalid');
  }
  return value;
};

export const formatAdminVariant = (variant) => ({
  id: variant.id,
  product_id: variant.product_id,
  sku: variant.sku,
  price: variant.price,
  attributes: variant.attributes,
  stock_quantity: variant.stock_quantity,
  reserved_quantity: variant.reserved_quantity,
  reorder_level: variant.reorder_level,
  low_stock: variant.stock_quantity <= variant.reorder_level,
  deleted_at: variant.deleted_at,
});

export const formatPublicVariant = (variant) => ({
  id: variant.id,
  sku: variant.sku,
  price: variant.price,
  attributes: variant.attributes,
  available_quantity: variant.stock_quantity - (variant.reserved_quantity || 0),
  in_stock:
    (variant.stock_quantity || 0) - (variant.reserved_quantity || 0) > 0,
});

//* ====== Helper Services ======

// Prepare and validate variants for creation/update:
export async function prepareVariants(productId, variants, categoryId, client) {
  if (!Array.isArray(variants) || variants.length === 0) return [];

  const rules = await getEffectiveAttributeRules(categoryId, client);
  const seenHashes = new Set();
  const seenSkus = new Set(); // batch level deduplication

  const processed = [];

  for (const variant of variants) {
    validateAttributesWithRules(variant.attributes, rules);

    const normalized = normalize(variant.attributes);
    const hash = generateAttributesHash(normalized);

    if (seenHashes.has(hash)) {
      throw AppError.conflict('Duplicate variant attributes detected', {
        errorCode: ProductErrorCode.DUPLICATE_VARIANT,
      });
    }
    seenHashes.add(hash);

    let sku = variant.sku?.trim();

    if (!sku || (await VariantModel.findBySKU(sku, client))) {
      sku = generateSku(productId, normalized);
    }

    // If duplicate fallback
    if (seenSkus.has(sku)) {
      sku =
        generateSku(productId, normalized) +
        '-' +
        Math.random().toString(36).slice(2, 6);
    }

    seenSkus.add(sku);
    validateVariantBusinessRules(variant);

    processed.push({
      sku,
      attributes: normalized,
      attributes_hash: hash,
      price: variant.price ?? 0,
      stock_quantity: variant.stock_quantity ?? 0,
      reserved_quantity: variant.reserved_quantity ?? 0,
      reorder_level: variant.reorder_level ?? DEFAULT_REORDER_LEVEL,
    });
  }

  return processed;
}
