import "server-only";
import { publicImages } from "@/server/storage/public-images";

// Product images (A7): the "products" folder of the public image store, on
// local disk or S3 (STORAGE_DRIVER), served at /uploads/products/<uuid>.<ext>
// exactly as in Phase 1.

export { MAX_IMAGE_BYTES, type SaveImageResult } from "@/server/storage/public-images";

const products = publicImages("products");

export const saveProductImage = products.save;
export const deleteProductImage = products.remove;
export const readProductImage = products.read;
