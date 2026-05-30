// ============================================================================
// COGALLERY TYPES - HIERARCHICAL MODEL
// ============================================================================
// Represents: Rooms > Events > Photos > Reactions/Comments

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export type UserRole = 'owner' | 'editor' | 'viewer'

export interface User {
  id: string
  email?: string
  displayName: string
  avatarUrl?: string
  isGuest: boolean
  createdAt: string
}

// ============================================================================
// ROOM TYPES (Top-level container: trips, vacations)
// ============================================================================

export interface Room {
  id: string
  creatorId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  isArchived: boolean
  thumbnailUrl?: string
  archivedAt?: string
}

export interface RoomMember {
  id: string
  roomId: string
  userId: string
  displayName?: string
  role: UserRole
  status: 'pending' | 'approved' | 'rejected'
  invitedById?: string
  invitedAt: string
}

export interface RoomWithMembers extends Room {
  members: RoomMember[]
  memberCount: number
  eventCount: number
  photoCount: number
}

// ============================================================================
// EVENT TYPES (Within rooms: days, occasions, themes)
// ============================================================================

export interface Event {
  id: string
  roomId: string
  creatorId: string
  title: string
  description?: string
  notes?: string
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
}

export interface EventMember {
  id: string
  eventId: string
  userId: string
  displayName?: string
  role: UserRole
  status: 'pending' | 'approved' | 'rejected'
  joinedAt: string
}

export interface EventWithDetails extends Event {
  members: EventMember[]
  photoCount: number
  participantCount: number
}

// ============================================================================
// PHOTO TYPES
// ============================================================================

export type MediaType = 'image' | 'video'

export interface Photo {
  id: string
  eventId: string
  roomId: string
  uploaderId: string
  filename: string
  contentHash?: string
  fileSizeBytes: number
  mediaType: MediaType
  s3Key: string
  s3Url: string
  thumbnailUrl?: string
  thumbnailBase64?: string
  
  // EXIF metadata
  takenAt?: string
  cameraMake?: string
  cameraModel?: string
  iso?: number
  aperture?: number
  
  // Location
  latitude?: number
  longitude?: number
  
  description?: string
  createdAt: string
}

export interface PhotoWithReactions extends Photo {
  reactions: Reaction[]
  comments: Comment[]
  reactionCount: number
  commentCount: number
}

// ============================================================================
// REACTION TYPES
// ============================================================================

export interface Reaction {
  id: string
  photoId: string
  userId: string
  emoji: string
  createdAt: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  userIds: string[]
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface Comment {
  id: string
  photoId: string
  userId: string
  body: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// CONTRIBUTION TYPES (Per-user stats in rooms)
// ============================================================================

export interface UserContribution {
  id: string
  roomId: string
  userId: string
  photoCount: number
  videoCount: number
  totalSizeBytes: number
  lastUploadAt?: string
}

export interface ContributionLeaderboard {
  roomId: string
  entries: (UserContribution & { displayName: string })[]
  totalPhotos: number
  totalVideos: number
}

// ============================================================================
// ACTIVITY LOG TYPES
// ============================================================================

export type ActivityAction = 
  | 'photo_uploaded' 
  | 'video_uploaded' 
  | 'user_invited' 
  | 'user_joined'
  | 'event_created'
  | 'room_archived'
  | 'photo_deleted'

export interface ActivityLog {
  id: string
  roomId: string
  userId?: string
  action: ActivityAction
  objectType?: 'photo' | 'room' | 'event' | 'user'
  objectId?: string
  details?: Record<string, any>
  createdAt: string
}

// ============================================================================
// REAL-TIME EVENT TYPES
// ============================================================================

export type RealtimeEvent =
  | { type: 'photo_uploaded'; photo: Photo }
  | { type: 'photo_deleted'; photoId: string }
  | { type: 'reaction_added'; photoId: string; emoji: string; userId: string }
  | { type: 'reaction_removed'; photoId: string; emoji: string; userId: string }
  | { type: 'comment_added'; comment: Comment }
  | { type: 'user_joined'; userId: string; role: UserRole }
  | { type: 'event_created'; event: Event }
  | { type: 'room_archived'; roomId: string }

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
