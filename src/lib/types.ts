import type { StudySession } from "../study-state";

export type View =
  | "overview"
  | "today"
  | "timer"
  | "records"
  | "exams"
  | "reviews"
  | "subjects"
  | "experiences"
  | "weekly"
  | "scoring"
  | "settings";

export type BackupMode = "export" | "import";

export type RecordDraft = Partial<
  Pick<StudySession, "date" | "start" | "end" | "subjectId" | "task" | "note">
>;
