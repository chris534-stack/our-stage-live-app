

export type Venue = {
  id: string;
  name: string;
  color: string;
  address?: string;
  sourceUrl?: string;
};

export type EventStatus = 'pending' | 'approved' | 'denied';

export type EventType = 'Play' | 'Musical' | 'Improv' | 'Special Event' | string; // Allow string for migrated data

export type EventOccurrence = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
};

export type Event = {
  id: string;
  title: string;
  description: string;
  occurrences: EventOccurrence[];
  venueId: string;
  type: EventType;
  tags?: string[];
  status: EventStatus;
  createdBy: string;
  url?: string;
  posterUrl?: string;
  // Archive-specific fields (optional, for historical productions)
  playwright?: string;
  composer?: string;
  director?: string;
  isArchived?: boolean;              // True for historical/past events in the archive
  originalProductionYear?: number;   // Year of original production
  researchConfidence?: 'low' | 'medium' | 'high'; // AI research confidence level
};

export type Idea = {
  id: string;
  // Fields from the form
  idea: string;
  showType: string;
  targetAudience: string;
  communityFit: string;
  // User info
  userId?: string;
  userName: string;
  userEmail: string;
  // Timestamp
  timestamp: Date;
};

export type NewsArticle = {
  id: string;
  url: string;
  title: string;
  summary: string;
  imageUrl?: string;
  createdAt: string;
  order: number;
};

export type Review = {
  id: string;
  showId: string;
  showTitle: string;
  performanceDate: string; // ISO String format
  reviewerId: string;
  reviewerName: string;
  createdAt: string;
  updatedAt?: string;
  overallExperience: string;
  specialMomentsText: string;
  recommendations: string[];
  showHeartText: string;
  communityImpactText: string;
  ticketInfo: string;
  valueConsiderationText: string;
  timeWellSpentText: string;
  likes: number;
  dislikes: number;
  votedBy: string[];
  disclosureText: string;
  // Revision flags for admin moderation
  flaggedForRevision?: boolean;
  flaggedReason?: string;
  flaggedAt?: string;
  flaggedBy?: string;
};

// An "Expanded Event" is a single performance instance, derived from a parent Event
export type ExpandedCalendarEvent = Omit<Event, 'occurrences'> & {
  uniqueOccurrenceId: string; // A unique ID for this specific performance
  date: string;
  time: string;
  venue?: Venue;
  reviews: Review[];
};

export type ReviewerRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  archived?: boolean;              // Whether this request has been archived
};

export type UserProfile = {
  userId: string;
  displayName: string;
  photoURL: string;
  email: string;
  bio?: string;
  roleInCommunity?: 'Performer' | 'Technician' | 'Designer' | 'Director' | 'Audience' | 'Other';
  communityStartDate?: string;
  galleryImageUrls?: string[];
  coverPhotoUrl?: string;
  showEmail?: boolean;
  authStatus?: 'active' | 'notFound';
  isReviewer?: boolean;
  // Venue Representative role flags
  isVenueRep?: boolean;
  assignedVenueIds?: string[]; // Venue IDs this user may manage events for
  // Onboarding flags for Venue Representatives
  hasSeenVenueRepIntro?: boolean;            // Whether user has dismissed or viewed the intro modal
  venueRepOnboardingCompleted?: boolean;     // Set to true when user completes onboarding
  // Testing flag to mark profiles created by automated tests or seeded data
  isTest?: boolean;
};

export type ReviewerInvitation = {
  id: string;
  email: string;                   // Email address of invitee
  token: string;                   // Secure, single-use token
  invitedBy: string;               // Admin user ID who sent invite
  invitedByName: string;           // Admin display name
  createdAt: string;               // When invitation was created
  expiresAt: string;               // When invitation expires (7 days)
  status: 'pending' | 'accepted' | 'expired';
  usedAt?: string;                 // When invitation was used (if accepted)
  acceptedByUserId?: string;       // Firebase user ID who accepted
  archived?: boolean;              // Whether this invitation has been archived
};

// Invitation to grant Venue Representative privileges for specific venues
export type VenueRepresentativeInvitation = {
  id: string;
  email: string;                   // Email address of invitee
  token: string;                   // Secure, single-use token
  invitedBy: string;               // Admin user ID who sent invite
  invitedByName: string;           // Admin display name
  assignedVenueIds: string[];      // Venue IDs assigned via this invite
  createdAt: string;               // When invitation was created
  expiresAt: string;               // When invitation expires (e.g., 7 days)
  status: 'pending' | 'accepted' | 'expired';
  usedAt?: string;                 // When invitation was used (if accepted)
  acceptedByUserId?: string;       // Firebase user ID who accepted
  archived?: boolean;              // Whether this invitation has been archived

  // Unbound invite extras (for short code challenge)
  // When creating an unbound invite, set email to an empty string and isUnbound to true.
  isUnbound?: boolean;             // If true, this invite is not tied to a specific email
  claimCodeHash?: string;          // Scrypt hash of the short claim code
  claimCodeSalt?: string;          // Salt used for hashing the claim code
  claimCodeAttemptCount?: number;  // Number of failed attempts so far
  claimCodeMaxAttempts?: number;   // Max allowed failed attempts before lockout (default 5)
  claimCodeLocked?: boolean;       // Whether further attempts are locked due to too many failures
  claimCodeLockedAt?: string;      // When the invite was locked (if locked)
};

export type CommunitySpotlight = {
  id: string;
  name: string;                    // Person being spotlighted
  story: string;                   // Admin-written recognition narrative
  photoUrl: string;                // Uploaded photo (not tied to platform profile)
  tags: string[];                  // Role badges: ["Director", "Actor", "Volunteer", etc.]
  createdAt: string;               // When spotlight was created
  createdBy: string;               // Admin who created it
  isActive: boolean;               // Only one can be active at a time

  // Optional fields:
  links?: {                        // Optional external links
    website?: string;
    social?: string;
  };
  adminNotes?: string;             // Internal admin notes
};

// --- Line Notes (Rehearse My Lines) domain types ---

export type ScriptDoc = {
  id: string;
  ownerId: string;                // UID of the owner
  name: string;                   // Original filename or user-provided title
  storagePath: string;            // gs://... or bucket-relative path to the uploaded script asset
  fileType: 'pdf' | 'image' | 'unknown';
  createdAt: string;
  updatedAt?: string;
  characters?: string[];          // Populated by OCR parse
  sceneIds?: string[];            // References into scenes collection
  parseStatus?: 'pending' | 'parsed' | 'error';
  parseError?: string;
};

export type SceneDoc = {
  id: string;
  ownerId: string;                // UID of the owner
  scriptId: string;               // Parent script
  name: string;                   // Scene label (e.g., "Act 1, Scene 2")
  order: number;                  // Sort order
  characters: string[];           // Characters present in scene
  lines: Array<{
    id: string;                   // Stable ID for caching TTS
    speaker: string;              // Character name
    text: string;                 // Dialogue text
    stageDirections?: string;     // Optional directions tied to the line
    ttsAudioPath?: string;        // Cached audio path for non-user speakers
  }>;
  createdAt: string;
  updatedAt?: string;
};

export type RehearsalSession = {
  id: string;
  ownerId: string;                // UID
  scriptId: string;
  sceneId: string;
  role: string;                   // The user's chosen character
  startedAt: string;
  completedAt?: string;
  transcript?: Array<{
    ts: number;                   // timestamp seconds from start
    text: string;                 // STT text
  }>;
  notes?: Array<{
    lineId: string;
    score: number;                // 0-1 similarity score
    missed?: string[];            // missed words
    paraphrased?: string[];       // detected paraphrases
    pickupDelayMs?: number;       // time after cue
    paceWpm?: number;             // words per minute
    feedback?: string;            // human-readable summary
  }>;
};

// Entitlements/plan
export type Plan = {
  id: string;                     // Usually "plan" or a subscription doc id
  userId: string;
  subscription?: {
    active: boolean;
    product?: string;            // e.g., "line-notes-monthly"
    renewsAt?: string;
  };
  perScriptUnlocks?: string[];    // scriptIds with one-time purchase
};
