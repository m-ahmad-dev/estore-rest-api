import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import env from "../configs/env.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      const userProfile = {
        googleId: profile.id,
        email: profile.emails[0].value,
        firstname: profile.name.givenName,
        lastname: profile.name.familyName,
        provider: profile.provider,
      };
      return done(null, userProfile);
    },
  ),
);
