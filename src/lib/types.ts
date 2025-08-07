

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
  url?: string;
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
  id:string;
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
