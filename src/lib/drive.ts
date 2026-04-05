import { google } from "googleapis";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

async function setPublicReader(drive: ReturnType<typeof getDrive>, fileId: string) {
  await drive.permissions.create({
    fileId,
    requestBody: { type: "anyone", role: "reader" },
  });
}

export async function createInspectionFolder(
  customerName: string,
  address: string,
  date: string
): Promise<{ folderId: string; folderUrl: string }> {
  const drive = getDrive();
  const folderName = `${customerName} - ${address} - ${date}`;

  const res = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!],
    },
    fields: "id, webViewLink",
  });

  const folderId = res.data.id!;
  await setPublicReader(drive, folderId);

  return {
    folderId,
    folderUrl: res.data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`,
  };
}

export async function uploadFileToDrive(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  folderId: string
): Promise<{ fileId: string; fileUrl: string }> {
  const drive = getDrive();
  const { Readable } = await import("stream");

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink, webContentLink",
  });

  const fileId = res.data.id!;
  await setPublicReader(drive, fileId);

  // Use direct thumbnail URL for embedding
  const fileUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

  return { fileId, fileUrl };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}
