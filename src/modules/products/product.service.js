import executeTransaction from '../../core/utils/dbTransaction.js';
import ProductModel from './product.model.js';
import AppError from '../../core/utils/error.utils.js';
import {
  validateUniqueSlug,
  validateCategoryChange,
  formatProductForPublic,
  formatProductForAdmin,
  formatProductDetail,
  formatProductDetailAdmin,
} from './product.utils.js';
import {
  createVariantService,
  bulkDeleteVariants,
} from './variants/variants.service.js';
import {
  deleteImagesByProduct,
  insertImagesService,
} from './images/images.service.js';

export const createProductService = async (payload) => {
  const { variants, images, ...productFields } = payload;

  return await executeTransaction(async (client) => {
    const slug = await validateUniqueSlug(
      productFields.name,
      null,
      client
    );
    const product = await ProductModel.create(
      { ...productFields, slug },
      client
    );

    if (variants?.length) {
      await createVariantService(
        product.id,
        variants,
        product.category_id,
        client
      );
    }

    if (images?.length) {
      await insertImagesService(product.id, images, client);
    }

    return {
      success: true,
      message: 'Product created successfully',
      product,
    };
  });
};

export const updateProductService = async (
  productId,
  updatePayload
) => {
  return await executeTransaction(async (client) => {
    const product = await ProductModel.findById(productId);
    if (!product) throw AppError.notFound('Product');

    const { name, category_id, ...otherFields } = updatePayload;
    const updateData = { ...otherFields };

    if (name !== undefined) {
      const slug = await validateUniqueSlug(name, productId, client);
      updateData.name = name;
      updateData.slug = slug;
    }

    if (category_id !== undefined) {
      await validateCategoryChange(
        productId,
        category_id,
        product,
        client
      );
      updateData.category_id = category_id;
    }

    if (Object.keys(updateData).length === 0) {
      throw AppError.badRequest('No valid fields provided');
    }

    const updatedProduct = await ProductModel.update(
      productId,
      updateData,
      client
    );

    return {
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct,
    };
  });
};

export const deleteProductService = async (productId) => {
  return await executeTransaction(async (client) => {
    const { exists, deleted } = await ProductModel.exists(
      productId,
      client
    );
    if (!exists || deleted) throw AppError.notFound('Product');

    await ProductModel.softDelete(productId, client);

    return {
      success: true,
      message: 'Product deleted successfully',
      id: productId,
    };
  });
};

export const hardDeleteProductService = async (productId) => {
  return await executeTransaction(async (client) => {
    const { exists, deleted } = await ProductModel.exists(
      productId,
      client
    );
    if (!exists || deleted) throw AppError.notFound('Product');

    await bulkDeleteVariants(productId, client);
    await deleteImagesByProduct(productId, client);
    await ProductModel.hardDelete(productId, client);

    return {
      success: true,
      message: 'Product permanently deleted',
      id: productId,
    };
  });
};

export const getProductByIdService = async (productId) => {
  const product = await ProductModel.findById(productId);

  if (!product || product.deleted_at) {
    throw AppError.notFound(
      'Product',
      'Product not exist or has been deleted.'
    );
  }

  return formatProductDetailAdmin(product);
};

export const getProductBySlugService = async (slug) => {
  const product = await ProductModel.findBySlug(slug);

  if (!product) {
    throw AppError.notFound(
      'Product',
      'Product not exist or has been deleted.'
    );
  }

  return formatProductDetail(product);
};

export const getAllProductsService = async (
  query = {},
  isAdmin = false
) => {
  const {
    q,
    category,
    min_price,
    max_price,
    sort = 'created_at',
    order = 'desc',
    limit: limitRaw = 10,
    cursor,
    include_deleted,
    status,
  } = query;

  const limit = parseInt(limitRaw, 10) || 10;

  // Build query filters
  const where = buildWhereClause({
    q,
    category,
    min_price,
    max_price,
    isAdmin,
    include_deleted,
    status,
  });

  // Build sorting
  const orderBy = buildOrderBy(sort, order);

  // Fetch products
  const rawProducts = await ProductModel.findMany(
    where,
    orderBy,
    limit,
    cursor || undefined
  );

  // Handle pagination
  const hasNextPage = rawProducts.length > limit;
  const productsData = hasNextPage
    ? rawProducts.slice(0, limit)
    : rawProducts;

  const nextCursor = hasNextPage
    ? productsData[productsData.length - 1].id
    : null;

  // Format products based on user role
  const formatter = isAdmin
    ? formatProductForAdmin
    : formatProductForPublic;
  const products = productsData.map(formatter);

  return {
    success: true,
    message: 'Products retrieved successfully',
    products,
    pagination: {
      limit,
      hasNextPage,
      nextCursor,
    },
  };
};

// Shared Services:
export const findProductById = async (productId, client) => {
  return await ProductModel.findById(productId, client);
};

export const findManyProductsByIds = async (productIds, client) => {
  return await ProductModel.findManyByIds(productIds, client);
};

export const checkProductExist = async (productId, client) => {
  return await ProductModel.exists(productId, client);
};

// Helper Functions:
const buildWhereClause = ({
  q,
  category,
  min_price,
  max_price,
  isAdmin,
  include_deleted,
  status,
}) => {
  const where = {};

  // Access control
  if (!isAdmin) {
    where.is_active = true;
    where.deleted_at = null;
  } else {
    if (include_deleted !== 'true') where.deleted_at = null;

    if (status === 'active') where.is_active = true;
    else if (status === 'inactive') where.is_active = false;
  }

  // Search
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (category) {
    where.category = { slug: category };
  }

  // Price range filter
  if (min_price !== undefined || max_price !== undefined) {
    where.base_price = {
      ...(min_price !== undefined && { gte: Number(min_price) }),
      ...(max_price !== undefined && { lte: Number(max_price) }),
    };
  }

  return where;
};

const buildOrderBy = (sort, order) => {
  const sortField = sort === 'price' ? 'base_price' : sort;

  return [
    { [sortField]: order },
    { id: order }, // Secondary sort for stable pagination
  ];
};
