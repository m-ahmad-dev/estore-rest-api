import refreshTokenService from "./token.service.js";
import { accessCookieConfig } from "../../core/utils/cookies.utils.js";
import AppError from "../../core/utils/error.utils.js";

const refreshAccessToken = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  try {
    const result = await refreshTokenService(refreshToken);

    // Set Cookie
    res.cookie("accessToken", result.accessToken, accessCookieConfig);

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
    });
  } catch (error) {
    // Handle if custom refresh-token error.
    if (error.errorCode === "REFRESH_TOKEN_EXPIRED") {
      return next(AppError.forbidden("Access Forbidden"));
    }
    next(error);
  }
};

export default refreshAccessToken;
