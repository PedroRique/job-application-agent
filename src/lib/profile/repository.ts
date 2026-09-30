import { AppError } from "@/lib/errors";
import { candidateProfileSchema, type CandidateProfile } from "@/lib/profile/schema";
import { seedProfile } from "@/lib/profile/seed";
import { getSupabase } from "@/lib/supabase/admin";

type ProfileRow = {
  id: string;
  personal_info: unknown;
  headline: string;
  summary: string;
  education: unknown;
  experiences: unknown;
  skills: unknown;
  languages: unknown;
};

function fromRow(row: ProfileRow): CandidateProfile {
  return candidateProfileSchema.parse({
    personalInfo: row.personal_info,
    headline: row.headline,
    summary: row.summary,
    education: row.education,
    experiences: row.experiences,
    skills: row.skills,
    languages: row.languages,
  });
}

export async function getProfile(): Promise<{ id: string; profile: CandidateProfile }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("id, personal_info, headline, summary, education, experiences, skills, languages")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new AppError("The profile could not be loaded.", 502, "profile_read_failed");
  if (!data) return insertSeed();

  try {
    return { id: data.id as string, profile: fromRow(data as ProfileRow) };
  } catch {
    throw new AppError("The saved profile is invalid.", 500, "profile_invalid");
  }
}

async function insertSeed(): Promise<{ id: string; profile: CandidateProfile }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("candidate_profiles")
    .insert({
      is_active: true,
      personal_info: seedProfile.personalInfo,
      headline: seedProfile.headline,
      summary: seedProfile.summary,
      education: seedProfile.education,
      experiences: seedProfile.experiences,
      skills: seedProfile.skills,
      languages: seedProfile.languages,
    })
    .select("id")
    .single();

  if (error) {
    const again = await supabase
      .from("candidate_profiles")
      .select("id, personal_info, headline, summary, education, experiences, skills, languages")
      .eq("is_active", true)
      .maybeSingle();
    if (again.data) {
      return { id: again.data.id as string, profile: fromRow(again.data as ProfileRow) };
    }
    throw new AppError("The profile could not be created.", 502, "profile_create_failed");
  }

  return { id: data.id as string, profile: seedProfile };
}

export async function saveProfile(profile: CandidateProfile) {
  const parsed = candidateProfileSchema.parse(profile);
  const current = await getProfile();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("candidate_profiles")
    .update({
      personal_info: parsed.personalInfo,
      headline: parsed.headline,
      summary: parsed.summary,
      education: parsed.education,
      experiences: parsed.experiences,
      skills: parsed.skills,
      languages: parsed.languages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id);

  if (error) throw new AppError("The profile could not be saved.", 502, "profile_save_failed");
  return parsed;
}
