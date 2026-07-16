import "server-only";
import { GetObjectCommand, HeadObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ProductDelivery } from "@/lib/catalog";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export type PrivateAsset = {
  objectKey: string;
  fileName: string;
  contentType: ProductDelivery["contentType"];
};

export interface PrivateAssetStore {
  resolve(delivery: ProductDelivery): PrivateAsset | null;
  createTemporaryDownloadUrl(asset: PrivateAsset): Promise<URL>;
}

type R2Configuration = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export class PrivateAssetNotFoundError extends Error {
  constructor() {
    super("Arquivo privado não encontrado.");
    this.name = "PrivateAssetNotFoundError";
  }
}

export class PrivateAssetStoreUnavailableError extends Error {
  constructor(readonly cause?: unknown) {
    super("Armazenamento privado indisponível.");
    this.name = "PrivateAssetStoreUnavailableError";
  }
}

function getR2Configuration(): R2Configuration | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();

  if (
    !accountId ||
    !ACCOUNT_ID_PATTERN.test(accountId) ||
    !accessKeyId ||
    accessKeyId.length > 256 ||
    !secretAccessKey ||
    secretAccessKey.length > 256 ||
    !bucket ||
    !BUCKET_PATTERN.test(bucket)
  ) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function isValidObjectKey(objectKey: string): boolean {
  return (
    objectKey.length > 0 &&
    objectKey.length <= 1_024 &&
    !objectKey.startsWith("/") &&
    !objectKey.includes("\\") &&
    !objectKey.includes("\0") &&
    !objectKey.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  );
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function contentDisposition(fileName: string): string {
  return `attachment; filename="${safeFileName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.$metadata.httpStatusCode === 404 || error.name === "NotFound" || error.name === "NoSuchKey")
  );
}

class CloudflareR2AssetStore implements PrivateAssetStore {
  private client: S3Client | null = null;
  private configurationKey: string | null = null;

  resolve(delivery: ProductDelivery): PrivateAsset | null {
    if (!getR2Configuration() || !isValidObjectKey(delivery.objectKey)) return null;
    return {
      objectKey: delivery.objectKey,
      fileName: delivery.fileName,
      contentType: delivery.contentType,
    };
  }

  async createTemporaryDownloadUrl(asset: PrivateAsset): Promise<URL> {
    const configuration = getR2Configuration();
    if (!configuration || !isValidObjectKey(asset.objectKey)) {
      throw new PrivateAssetStoreUnavailableError();
    }

    const client = this.getClient(configuration);
    try {
      await client.send(new HeadObjectCommand({ Bucket: configuration.bucket, Key: asset.objectKey }));
      const signedUrl = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: configuration.bucket,
          Key: asset.objectKey,
          ResponseCacheControl: "private, no-store, max-age=0",
          ResponseContentDisposition: contentDisposition(asset.fileName),
          ResponseContentType: asset.contentType,
        }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      );
      return new URL(signedUrl);
    } catch (error) {
      if (isNotFound(error)) throw new PrivateAssetNotFoundError();
      throw new PrivateAssetStoreUnavailableError(error);
    }
  }

  private getClient(configuration: R2Configuration): S3Client {
    const configurationKey = `${configuration.accountId}:${configuration.accessKeyId}`;
    if (!this.client || this.configurationKey !== configurationKey) {
      this.client?.destroy();
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: configuration.accessKeyId,
          secretAccessKey: configuration.secretAccessKey,
        },
        maxAttempts: 3,
      });
      this.configurationKey = configurationKey;
    }
    return this.client;
  }
}

const privateAssetStore: PrivateAssetStore = new CloudflareR2AssetStore();

export function getPrivateAssetStore(): PrivateAssetStore {
  return privateAssetStore;
}

export async function createPrivateAssetDownloadUrl(asset: PrivateAsset): Promise<URL> {
  return getPrivateAssetStore().createTemporaryDownloadUrl(asset);
}
