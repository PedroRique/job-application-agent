import { AppError } from "@/lib/errors";
import { isPdf, MAX_RESUME_BYTES, safePdfName } from "@/lib/files";
import { getProfile } from "@/lib/profile/repository";
import { getSupabase } from "@/lib/supabase/admin";

export type ResumeMeta = {
  id: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  storagePath: string;
};

type ResumeRow = {
  id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
};

function fromRow(row: ResumeRow): ResumeMeta {
  return {
    id: row.id,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    storagePath: row.storage_path,
  };
}

export async function getLatestResume(): Promise<ResumeMeta | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("resumes")
    .select("id, storage_path, file_name, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError("The resume could not be loaded.", 502, "resume_read_failed");
  return data ? fromRow(data as ResumeRow) : null;
}

export async function saveResume(fileName: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESUME_BYTES) {
    throw new AppError("Resume PDF must be 3 MB or smaller.", 422, "resume_too_large");
  }
  if (!isPdf(bytes)) {
    throw new AppError("Upload a PDF resume.", 422, "resume_invalid");
  }

  const profile = await getProfile();
  const supabase = getSupabase();
  const id = crypto.randomUUID();
  const storagePath = `${profile.id}/${id}.pdf`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(storagePath, Buffer.from(bytes), {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw new AppError("The resume could not be stored.", 502, "resume_upload_failed");

  const { error: insertError } = await supabase.from("resumes").insert({
    id,
    profile_id: profile.id,
    storage_path: storagePath,
    file_name: safePdfName(fileName),
    mime_type: "application/pdf",
    size_bytes: bytes.byteLength,
  });

  if (insertError) {
    await supabase.storage.from("resumes").remove([storagePath]);
    throw new AppError("The resume could not be stored.", 502, "resume_upload_failed");
  }

  const { data: older } = await supabase
    .from("resumes")
    .select("id, storage_path")
    .neq("id", id);
  if (older && older.length > 0) {
    await supabase.storage.from("resumes").remove(older.map((row) => row.storage_path as string));
    await supabase
      .from("resumes")
      .delete()
      .in(
        "id",
        older.map((row) => row.id as string),
      );
  }

  const saved = await getLatestResume();
  if (!saved) throw new AppError("The resume could not be stored.", 502, "resume_upload_failed");
  return saved;
}

export async function downloadResume(storagePath: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from("resumes").download(storagePath);
  if (error || !data) throw new AppError("The resume could not be read.", 502, "resume_read_failed");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!isPdf(bytes)) throw new AppError("The saved resume is not a valid PDF.", 422, "resume_invalid");
  return bytes;
}
