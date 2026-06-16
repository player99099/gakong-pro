import { supabase } from '../lib/supabase';

export const PRINT_TEMPLATE_BUCKET = 'print-templates';

export function isPublicTemplatePath(path: string): boolean {
  return path.startsWith('/templates/') || path.startsWith('templates/');
}

export function normalizePublicTemplatePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export async function loadPrintTemplateBytes(storagePath: string): Promise<ArrayBuffer> {
  if (isPublicTemplatePath(storagePath)) {
    const url = normalizePublicTemplatePath(storagePath);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`양식 파일을 불러오지 못했습니다: ${url}`);
    }
    return res.arrayBuffer();
  }

  const { data, error } = await supabase.storage
    .from(PRINT_TEMPLATE_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      error?.message ??
        `Storage에서 양식을 불러오지 못했습니다 (${PRINT_TEMPLATE_BUCKET}/${storagePath})`,
    );
  }
  return data.arrayBuffer();
}

export async function uploadPrintTemplateFile(
  file: File,
  storagePath: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(PRINT_TEMPLATE_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

  if (error) {
    throw new Error(
      `양식 파일 업로드 실패: ${error.message}\n` +
        `(Supabase Storage 버킷 "${PRINT_TEMPLATE_BUCKET}" 생성 필요)`,
    );
  }
  return storagePath;
}

export function buildStoragePathForTemplate(
  templateId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${templateId}/${safe}`;
}
