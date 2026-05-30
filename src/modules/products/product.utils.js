import ProductModel from './product.model.js';
import AppError from '../../core/utils/error.utils.js';
import toSlug from '../../core/utils/slug.utils.js';
import { findCategoryById } from '../categories/category.service.js';
import {
  getEffectiveAttributeRules,
  validateAttributesWithRules,
} from './variants/variants.utils.js';
import { checkProductExist } from './product.service.js';
import {
  formatAdminImages,
  formatPublicImages,
} from './images/images.utils.js';
import {
  formatAdminVariant,
  formatPublicVariant,
} from './variants/variants.service.js';

const ProductErrorCode = {
  DUPLICATE_SLUG: 'PRODUCT_DUPLICATE_SLUG',
  INVALID_CATEGORY_CHANGE: 'PRODUCT_INVALID_CATEGORY_CHANGE',
};

// Validate slug uniqueness:
export async function validateUniqueSlug(name, productId = null, client) {
  const slug = toSlug(name);
  const isAvailable = await ProductModel.isSlugAvailable(
    slug,
    productId,
    client
  );

  if (!isAvailable) {
    throw AppError.conflict('Product with this name already exists', {
      errorCode: ProductErrorCode.DUPLICATE_SLUG,
      message: `A product named "${name}" already exists.`,
      suggestion:
        'Choose a more specific name or add model/series information.',
    });
  }
  return slug;
}

// Validate category change compatibility with existing variants:
export const validateCategoryChange = async (
  newCategoryId,
  existingProduct,
  client
) => {
  const category = await findCategoryById(newCategoryId, client);
  if (!category) {
    throw AppError.notFound('Category');
  }

  const effectiveRules = await getEffectiveAttributeRules(
    newCategoryId,
    client
  );
  const variants = existingProduct?.variants || [];

  try {
    for (const variant of variants) {
      validateAttributesWithRules(variant.attributes, effectiveRules);
    }
  } catch (err) {
    if (err instanceof AppError) {
      throw AppError.conflict(
        'Category change not allowed due to variant incompatibility',
        {
          errorCode: ProductErrorCode.INVALID_CATEGORY_CHANGE,
          details: err.details || err.message,
          suggestion:
            'Update or remove incompatible variants before changing category.',
        }
      );
    }
    throw err;
  }
};

export async function validateProductExists(productId, client) {
  const { exists, deleted } = await checkProductExist(productId, client);
  if (!exists || deleted) {
    throw AppError.notFound('Product', 'Product not exist or has been deleted');
  }
}

const formatImages = (images, includeKey = false) => {
  if (!images?.length) return [];

  const img = images[0];
  return [
    {
      id: img.id,
      ...(includeKey && { key: img.key }),
      url: img.url,
      is_primary: img.is_primary,
    },
  ];
};

const toNumber = (value) =>
  value !== null ? parseFloat(value.toString()) : null;

export const formatProductForPublic = (product) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  base_price: product.base_price,
  category: product.category ?? null,
  images: formatImages(product.images, false),
  reviews: product._count.reviews,
});

export const formatProductForAdmin = (product) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  base_price: product.base_price,
  is_active: product.is_active,
  created_at: product.created_at,
  deleted_at: product.deleted_at ?? null,
  category: product.category ?? null,
  images: formatImages(product.images, true),
  reviews: product._count.reviews,
});

export const formatProductDetail = (product) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description ?? null,
  base_price: toNumber(product.base_price),
  category: {
    id: product.category.id,
    name: product.category.name,
    slug: product.category.slug,
  },
  variants: product.variants.map(formatPublicVariant),
  images: product.images.map(formatPublicImages),
  reviews: product._count.reviews,
});

export const formatProductDetailAdmin = (product) => ({
  id: product.id,
  category_id: product.category_id,
  name: product.name,
  slug: product.slug,
  description: product.description ?? null,
  base_price: toNumber(product.base_price),
  is_active: product.is_active,
  created_at: product.created_at,
  deleted_at: product.deleted_at ?? null,
  category: {
    id: product.category.id,
    name: product.category.name,
    slug: product.category.slug,
    parent_id: product.category.parent_id ?? null,
    is_active: product.category.is_active,
    attribute_rules: product.category.attribute_rules ?? [],
  },
  variants: product.variants.map(formatAdminVariant),
  images: product.images.map(formatAdminImages),
  reviews: product._count.reviews,
});
