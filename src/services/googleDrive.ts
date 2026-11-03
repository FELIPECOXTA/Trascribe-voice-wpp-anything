export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  webViewLink?: string;
}

/**
 * Busca arquivos no Google Drive do usuário (com foco em ZIP e TRANSCREVA TUDO)
 */
export async function searchDriveFiles(
  token: string,
  queryTerm: string = 'TRANSCREVA TUDO'
): Promise<DriveFileItem[]> {
  const cleanTerm = queryTerm.replace(/'/g, "\\'").trim();
  
  // Constrói cláusula de consulta flexível
  let q = 'trashed = false';
  if (cleanTerm) {
    q += ` and (name contains '${cleanTerm}' or name contains '.zip')`;
  } else {
    q += ` and (mimeType = 'application/zip' or mimeType = 'application/x-zip-compressed' or name contains '.zip')`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', '30');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('fields', 'files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink)');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Erro ao consultar Google Drive: status ${response.status}`
    );
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Baixa o conteúdo binário de um arquivo do Google Drive
 */
export async function downloadDriveFile(
  fileId: string,
  token: string,
  onProgress?: (loadedBytes: number, totalBytes?: number) => void
): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Falha no download do arquivo (status ${response.status}): ${errText}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : undefined;

  if (!response.body || !onProgress) {
    return await response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}
