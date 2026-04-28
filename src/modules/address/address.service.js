import AppError from "../../core/utils/error.utils.js";
import executeTransaction from "../../core/utils/dbTransaction.js";
import AddressModel from "./address.model.js";

export const create = async (userId, body) => {
  return await executeTransaction(async (client) => {
    // New address is default, then others false
    if (body.is_default === true) {
      await AddressModel.otherDefaults(userId, false, client);
    }

    const data = {
      ...body,
      customer_id: userId,
      is_default: body.is_default ?? false,
    };

    const address = await AddressModel.insert(data, client);

    return {
      success: true,
      message: "Address added successfully.",
      address,
    };
  });
};

export const getAll = async (userId) => {
  const addresses = await AddressModel.findAll(userId);
  return {
    success: true,
    message: "Data retrieved successfully",
    addresses,
  };
};

export const getOne = async (addressId) => {
  const address = await AddressModel.findOne(addressId);

  if (!address) throw AppError.notFound("Address");
  return {
    success: true,
    message: "Data retrieved successfully",
    address,
  };
};

export const update = async (userId, addressId, body) => {
  return await executeTransaction(async (client) => {
    const isExist = await AddressModel.findOne(addressId, client);

    if (!isExist) throw AppError.notFound("Address");
    if (body.is_default === true) {
      await AddressModel.otherDefaults(userId, false, client);
    }

    const address = await AddressModel.edit(addressId, body, client);
    return {
      success: true,
      message: "Address updated successfully",
      address,
    };
  });
};

export const remove = async (addressId) => {
  await executeTransaction(async (client) => {
    const isExist = await AddressModel.findOne(addressId, client);
    if (!isExist) throw AppError.notFound("Address");

    await AddressModel.delete(addressId, client);
    return {
      success: true,
      message: `${addressId} deleted successfully`,
    };
  });
};
