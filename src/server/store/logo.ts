import "server-only";
import { publicImages } from "@/server/storage/public-images";

// Store logos (A6): the "logos" folder of the public image store, served at
// /uploads/logos/<uuid>.<ext>. The settings form crops them square and
// shrinks them in the browser before upload.

const logos = publicImages("logos");

export const saveStoreLogo = logos.save;
export const deleteStoreLogo = logos.remove;
export const readStoreLogo = logos.read;
