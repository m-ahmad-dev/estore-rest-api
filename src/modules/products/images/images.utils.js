import AppError from '../../../core/utils/error.utils.js';

export const SORT_GAP = 10;
const IMAGE_KEY_PREFIX = 'products/';
const IMAGE_KEY_PATTERN = /^[a-zA-Z0-9/_\-.]+$/;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

const countPrimaries = (images) =>
  images.filter((img) => img.is_primary === true).length;

const hasDuplicates = (list, getKey) =>
  new Set(list.map(getKey)).size !== list.length;

export const validateUniqueImageKeys = (images, helpers) => {
  if (hasDuplicates(images, (img) => img.key)) {
    return helpers.error('array.unique');
  }
  return images;
};

export const validateAtMostOnePrimary = (images, helpers) => {
  if (countPrimaries(images) > 1) {
    return helpers.error('any.invalid');
  }
  return images;
};

export const validateExactlyOnePrimary = (images, helpers) => {
  return countPrimaries(images) === 1 ? images : helpers.error('any.invalid');
};

// Validates and normalizes an image key with security checks:
const validateImageKey = (key) => {
  if (!key || typeof key !== 'string') {
    throw AppError.badRequest('Image key is required');
  }

  const normalized = key.trim();

  if (!IMAGE_KEY_PATTERN.test(normalized)) {
    throw AppError.badRequest('Image key contains invalid characters');
  }

  if (!normalized.startsWith(IMAGE_KEY_PREFIX)) {
    throw AppError.badRequest(
      `Image key must start with "${IMAGE_KEY_PREFIX}"`
    );
  }

  if (
    normalized.includes('..') ||
    normalized.includes('./') ||
    normalized.startsWith('/')
  ) {
    throw AppError.badRequest('Invalid image path - potential security risk');
  }

  const extension = normalized.split('.').pop()?.toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw AppError.badRequest(
      'Unsupported image format. Allowed: jpg, jpeg, png, webp'
    );
  }

  return normalized;
};

const buildImageUrl = (key) => {
  const baseUrl = process.env.IMAGES_BASE_URL;
  if (!baseUrl) {
    throw AppError.internal(
      'IMAGES_BASE_URL environment variable is not configured'
    );
  }

  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanKey = key.replace(/^\//, '');

  return `${cleanBase}/${cleanKey}`;
};

export const prepareImages = (images, nextSortOrder) => {
  let currentSort = nextSortOrder;

  return images.map((image) => {
    const useProvidedSort = Number.isInteger(image.sort_order);

    const prepared = {
      key: validateImageKey(image.key),
      url: buildImageUrl(image.key),
      alt_text: image.alt_text?.trim() || null,
      is_primary: image.is_primary === true,
      sort_order: useProvidedSort ? image.sort_order : currentSort,
    };

    if (!useProvidedSort) currentSort += SORT_GAP;

    return prepared;
  });
};

export const formatPublicImages = (image) => ({
  id: image.id,
  url: image.url,
  alt_text: image.alt_text,
  is_primary: image.is_primary,
});

export const formatAdminImages = (image) => ({
  id: image.id,
  key: image.key,
  url: image.url,
  alt_text: image.alt_text ?? null,
  is_primary: image.is_primary,
  sort_order: image.sort_order,
});
