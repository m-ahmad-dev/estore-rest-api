import * as uploadService from "./upload.service.js";
import { asyncWrapper } from "../../core/utils/trycatch.js";

export const getPresignedUrl = asyncWrapper(async (req, res) => {
  const { fileName, fileType } = req.query;
  const result = await uploadService.getUploadPresignedUrl(fileName, fileType);

  res.status(200).json({
    status: "success",
    data: result,
  });
});
