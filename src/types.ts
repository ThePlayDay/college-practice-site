export interface Question {
  id: string;
  text: string;
  type: 'select' | 'text';
  options?: string[];
  imageUrl?: string;
  isDefault: boolean;
  required: boolean;
}

export interface Submission {
  id: string;
  applicantName: string;
  referrerName: string;
  referrerType?: 'student' | 'staff' | null;
  answers: {
    [questionId: string]: string; // questionId -> answer text or selected option
  };
  submittedAt: string; // ISO string: YYYY-MM-DDTHH:mm:ss.sssZ
  consentGiven: boolean;
  consentAt: string;
  consentVersion: string;
  consentPurpose: string;
  consentDataScope: string;
  isDuplicate?: boolean;
}

export interface AdminStats {
  totalCount: number;
  sourceCounts: { [source: string]: number };
  specialtyCounts: { [specialty: string]: number };
  dailyTrend: { [date: string]: number };
}
