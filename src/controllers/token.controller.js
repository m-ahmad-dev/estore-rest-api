import refreshTokenService from "../services/token.service.js";

const refreshAccessToken = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  try {
    const result = await refreshTokenService(refreshToken);

    // Set Cookie
    res.cookie("accessToken", result.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 15 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
    });
  } catch (error) {
    // Agar custom refresh-token error hai to woh handle karein
    if (error.errorCode === "REFRESH_TOKEN_EXPIRED") {
      return res.status(403).json({
        success: false,
        message: error.message,
        code: error.errorCode,
      });
    }
    next(error);
  }
};

export default refreshAccessToken;
