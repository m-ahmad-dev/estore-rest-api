import refreshTokenService from "../services/token.service.js";
import { accessCookieConfig } from "../utils/cookies.utils.js";
import { AppError } from "../utils/error.utils.js";

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
    // Agar custom refresh-token error hai to woh handle karein
    if (error.errorCode === "REFRESH_TOKEN_EXPIRED") {
      return next(AppError.forbidden("Access Forbidden"));
    }
    next(error);
  }
};

export default refreshAccessToken;
