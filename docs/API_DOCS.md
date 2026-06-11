# CoGallery - API Documentation

## Base URL

**Development:** `http://localhost:3000/api`  
**Production:** `https://api.cogallery.app/api`

## Authentication

All requests must include JWT token in header:

```
Authorization: Bearer {access_token}
```

Obtain token via authentication endpoints or Supabase client.

---

## Authentication Endpoints

### Sign Up (Email)

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "displayName": "John Doe"
}
```

---

### Log In (Email)

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

---



### Get Current User

```http
GET /auth/user
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "profileImage": "https://...",
  "createdAt": "2026-05-27T10:30:00Z"
}
```

---

### Log Out

```http
POST /auth/logout
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true
}
```

---

## Events Endpoints

### Create Event

```http
POST /events
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Bali Trip 2026",
  "description": "Best trip ever!",
  "isPublic": false,
  "eventStartDate": "2026-06-15",
  "eventEndDate": "2026-06-20",
  "location": "Bali, Indonesia"
}
```

**Response:**
```json
{
  "id": "event-uuid",
  "title": "Bali Trip 2026",
  "createdBy": "user-uuid",
  "createdAt": "2026-05-27T10:30:00Z",
  "isPublic": false,
  "eventStartDate": "2026-06-15",
  "eventEndDate": "2026-06-20",
  "location": "Bali, Indonesia",
  "status": "active"
}
```

---

### List User's Events

```http
GET /events?limit=20&offset=0
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "total": 5,
  "events": [
    {
      "id": "event-uuid",
      "title": "Bali Trip 2026",
      "description": "Best trip ever!",
      "createdBy": "user-uuid",
      "createdAt": "2026-05-27T10:30:00Z",
      "photoCount": 342,
      "memberCount": 6,
      "coverPhoto": "https://..."
    }
  ]
}
```

---

### Get Event Details

```http
GET /events/:eventId
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "event-uuid",
  "title": "Bali Trip 2026",
  "description": "Best trip ever!",
  "createdBy": "user-uuid",
  "createdAt": "2026-05-27T10:30:00Z",
  "isPublic": false,
  "eventStartDate": "2026-06-15",
  "eventEndDate": "2026-06-20",
  "location": "Bali, Indonesia",
  "status": "active",
  "members": [
    {
      "id": "user-uuid",
      "displayName": "John Doe",
      "role": "creator",
      "joinedAt": "2026-05-27T10:30:00Z"
    }
  ],
  "photoCount": 342,
  "commentCount": 156
}
```

---

### Update Event

```http
PUT /events/:eventId
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description",
  "isPublic": true
}
```

**Response:** Updated event object

---

### Delete Event

```http
DELETE /events/:eventId
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Event deleted"
}
```

---

### Join Event with Code

```http
POST /events/join
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "eventCode": "ABC123"
}
```

**Response:**
```json
{
  "id": "event-uuid",
  "title": "Bali Trip 2026",
  "joinedAt": "2026-05-27T10:30:00Z"
}
```

---

## Photos Endpoints

### Get Upload URL (Presigned S3 URL)

```http
POST /events/:eventId/photos/upload-url
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "fileName": "photo.jpg",
  "fileType": "image/jpeg",
  "fileSize": 5242880
}
```

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/cogallery-photos/...",
  "photoId": "photo-uuid",
  "expiresIn": 3600
}
```

---

### Confirm Photo Upload

```http
POST /events/:eventId/photos/confirm
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "photoId": "photo-uuid",
  "s3Key": "events/event-uuid/originals/photo-uuid.jpg",
  "fileSize": 5242880,
  "width": 4000,
  "height": 3000,
  "exifData": {
    "dateTime": "2026-06-15T14:30:00Z",
    "cameraModel": "iPhone 15 Pro",
    "lat": -8.6500,
    "lng": 115.2167
  }
}
```

**Response:**
```json
{
  "id": "photo-uuid",
  "eventId": "event-uuid",
  "uploadedBy": "user-uuid",
  "uploadedAt": "2026-05-27T10:30:00Z",
  "fileName": "photo.jpg",
  "fileSize": 5242880,
  "width": 4000,
  "height": 3000,
  "displayUrl": "https://cloudfront.../photo.jpg"
}
```

---

### Get Event Photos (Paginated)

```http
GET /events/:eventId/photos?page=1&limit=50&sort=date_desc
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50, max: 100)
- `sort` (string): Sort order (date_desc, date_asc, uploader, popular)
- `uploadedBy` (uuid): Filter by uploader
- `startDate` (date): Filter by start date
- `endDate` (date): Filter by end date

**Response:**
```json
{
  "total": 342,
  "page": 1,
  "limit": 50,
  "photos": [
    {
      "id": "photo-uuid",
      "eventId": "event-uuid",
      "uploadedBy": {
        "id": "user-uuid",
        "displayName": "John Doe"
      },
      "fileName": "photo.jpg",
      "uploadedAt": "2026-06-15T14:30:00Z",
      "width": 4000,
      "height": 3000,
      "displayUrl": "https://cloudfront.../photo.jpg",
      "thumbnailUrl": "https://cloudfront.../photo_thumb.jpg",
      "viewCount": 23,
      "downloadCount": 5,
      "commentCount": 3,
      "reactionCount": 7
    }
  ]
}
```

---

### Delete Photo

```http
DELETE /events/:eventId/photos/:photoId
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Photo deleted"
}
```

---

## Download Endpoints

### Download Single Photo

```http
GET /events/:eventId/photos/:photoId/download
Authorization: Bearer {access_token}
```

**Response:** Binary image file with headers:
```
Content-Type: image/jpeg
Content-Disposition: attachment; filename="photo.jpg"
Cache-Control: public, max-age=31536000
```

---

### Download Event as ZIP

```http
GET /events/:eventId/download-zip?photoIds=uuid1,uuid2,uuid3
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `photoIds` (string): Comma-separated photo UUIDs (optional, all if not provided)
- `includeMeta` (boolean): Include metadata JSON (default: true)

**Response:** ZIP file
```
Content-Type: application/zip
Content-Disposition: attachment; filename="event-bali-2026.zip"
```

---

## Comments Endpoints

### Add Comment

```http
POST /events/:eventId/photos/:photoId/comments
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "content": "Beautiful photo!"
}
```

**Response:**
```json
{
  "id": "comment-uuid",
  "photoId": "photo-uuid",
  "userId": "user-uuid",
  "userName": "John Doe",
  "content": "Beautiful photo!",
  "createdAt": "2026-05-27T10:30:00Z"
}
```

---

### Delete Comment

```http
DELETE /events/:eventId/photos/:photoId/comments/:commentId
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true
}
```

---

## Reactions Endpoints

### Add Reaction

```http
POST /events/:eventId/photos/:photoId/reactions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "reactionType": "like"
}
```

**Valid Reaction Types:** like, love, laugh, wow, sad, angry

**Response:**
```json
{
  "id": "reaction-uuid",
  "photoId": "photo-uuid",
  "userId": "user-uuid",
  "reactionType": "like",
  "createdAt": "2026-05-27T10:30:00Z"
}
```

---

### Remove Reaction

```http
DELETE /events/:eventId/photos/:photoId/reactions/:reactionType
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true
}
```

---



## Error Responses

### 400 Bad Request
```json
{
  "error": "bad_request",
  "message": "Invalid event ID format"
}
```

### 401 Unauthorized
```json
{
  "error": "unauthorized",
  "message": "Authentication token missing or invalid"
}
```

### 403 Forbidden
```json
{
  "error": "forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Event not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Try again in 60 seconds."
}
```

### 500 Internal Server Error
```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

- **Authenticated users:** 100 requests/minute
- **Upload:** 10 files/minute per user

---

## Webhooks (Future)

```
POST https://your-server.com/webhooks/cogallery
Content-Type: application/json
Authorization: Bearer {webhook_secret}

Events:
- event.created
- event.updated
- event.deleted
- photo.uploaded
- photo.deleted
```

---

**API Documentation Version:** 1.0  
**Last Updated:** May 27, 2026  
**Status:** Ready for Implementation ✅
