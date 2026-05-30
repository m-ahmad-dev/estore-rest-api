import { S3Client } from "@aws-sdk/client-s3";
import env from "./env.js";

export const s3Client = new S3Client({
  endpoint: env.B2_ENDPOINT,
  region: env.B2_REGION,
  credentials: {
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APP_KEY,
  },
});
