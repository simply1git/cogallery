import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Simple .env parser
const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const r2AccessKeyId = env['VITE_R2_ACCESS_KEY_ID'];
const r2SecretAccessKey = env['VITE_R2_SECRET_ACCESS_KEY'];
const r2Endpoint = env['VITE_R2_ENDPOINT'];
const r2BucketName = env['VITE_R2_BUCKET_NAME'];

if (!r2AccessKeyId || !r2SecretAccessKey || !r2Endpoint || !r2BucketName) {
  console.error("Missing R2 credentials in .env.local");
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
});

const corsCommand = new PutBucketCorsCommand({
  Bucket: r2BucketName,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        AllowedOrigins: ["*"], // Allowing all origins for development
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3000,
      },
    ],
  },
});

async function run() {
  try {
    await client.send(corsCommand);
    console.log("SUCCESS: CORS configuration successfully applied to bucket:", r2BucketName);
  } catch (err) {
    console.error("Error applying CORS:", err);
  }
}

run();
